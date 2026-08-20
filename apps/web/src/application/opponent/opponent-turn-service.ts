import {
  parseRequestId,
  type MonotonicTimestampMs,
  type RequestId,
  type OpponentRequestFailureReason,
  type UciMove,
} from "@caissa/chess-core";

import type { GameSessionCoordinator } from "../game-session";
import type { OpponentMoveContext, OpponentProvider, RequestIdFactory } from "./opponent-port";
import { DEFAULT_OPPONENT_PROFILE_ID, type OpponentProfileId } from "./opponent-profiles";

export type OpponentTurnOutcome =
  | { readonly status: "committed" }
  | { readonly status: "completed" }
  | { readonly status: "not-opponent-turn" }
  | { readonly status: "superseded" }
  | { readonly reason: OpponentRequestFailureReason; readonly status: "degraded" }
  | { readonly status: "failed" };

export interface OpponentTurnRequest {
  readonly coordinator: GameSessionCoordinator;
  readonly profileId: OpponentProfileId;
}

export interface OpponentTurnService {
  /** Cancels any in-flight proposal so a new position can take over immediately. */
  cancel(): void;
  runTurn(request: OpponentTurnRequest): Promise<OpponentTurnOutcome>;
}

export interface MonotonicClockPort {
  now(): MonotonicTimestampMs;
}

export interface CreateOpponentTurnServiceOptions {
  readonly monotonicClock: MonotonicClockPort;
  readonly provider: OpponentProvider;
  readonly requestIdFactory: RequestIdFactory;
}

export function createOpponentTurnService(
  options: CreateOpponentTurnServiceOptions,
): OpponentTurnService {
  return new DefaultOpponentTurnService(options);
}

class DefaultOpponentTurnService implements OpponentTurnService {
  constructor(private readonly options: CreateOpponentTurnServiceOptions) {}

  cancel(): void {
    this.options.provider.cancel();
  }

  async runTurn(request: OpponentTurnRequest): Promise<OpponentTurnOutcome> {
    const { coordinator } = request;
    const before = coordinator.getSession();
    if (before.lifecycle.phase !== "opponent-turn" && before.lifecycle.phase !== "degraded") {
      return frozen({ status: "not-opponent-turn" });
    }
    if (before.configuration.participants[before.position.turn].kind !== "external-opponent") {
      return frozen({ status: "not-opponent-turn" });
    }

    const opened = await coordinator.requestOpponentMove({
      expectedRevision: before.revision,
      requestId: this.createRequestId(),
    });
    if (opened.status === "rejected") return frozen({ status: "superseded" });
    if (opened.status !== "applied") return frozen({ status: "failed" });

    const pending = opened.session.activeOpponentRequest;
    if (!pending) return frozen({ status: "failed" });

    const remaining = remainingMs(opened.session, pending.requestedColor);
    const context: OpponentMoveContext = Object.freeze({
      color: pending.requestedColor,
      fen: pending.expectedFen,
      moves: historyMoves(opened.session.history),
      profileId: request.profileId,
      startsFromInitialPosition: opened.session.configuration.initialPosition.kind === "standard",
      ...(remaining === undefined ? {} : { remainingMs: remaining }),
    });

    let proposal: Awaited<ReturnType<OpponentProvider["proposeMove"]>>;
    try {
      proposal = await this.options.provider.proposeMove(context);
    } catch {
      proposal = Object.freeze({ reason: "internal-provider-error" as const, status: "failed" });
    }

    if (proposal.status === "failed") {
      return this.degrade(coordinator, pending.requestId, proposal.reason);
    }

    const committed = await coordinator.commitOpponentMove(
      Object.freeze({
        expectedFen: pending.expectedFen,
        expectedPly: pending.expectedPly,
        expectedRevision: pending.expectedRevision,
        move: proposal.move,
        requestId: pending.requestId,
        requestedColor: pending.requestedColor,
      }),
      this.options.monotonicClock.now(),
    );

    if (committed.status === "applied") return frozen({ status: "committed" });
    if (committed.status === "completed") return frozen({ status: "completed" });
    if (committed.status === "rejected") {
      const reason: OpponentRequestFailureReason =
        committed.domainResult.reason === "illegal-move" ||
        committed.domainResult.reason === "promotion-required"
          ? "illegal-move"
          : "request-cancelled";
      if (reason === "request-cancelled") return frozen({ status: "superseded" });
      return this.degrade(coordinator, pending.requestId, reason);
    }
    return frozen({ status: "failed" });
  }

  private async degrade(
    coordinator: GameSessionCoordinator,
    requestId: RequestId,
    reason: OpponentRequestFailureReason,
  ): Promise<OpponentTurnOutcome> {
    const rejected = await coordinator.rejectOpponentRequest({ reason, requestId });
    return rejected.status === "applied"
      ? frozen({ reason, status: "degraded" })
      : frozen({ status: "superseded" });
  }

  private createRequestId(): RequestId {
    return parseRequestId(this.options.requestIdFactory.create());
  }
}

export const DEFAULT_TURN_PROFILE_ID: OpponentProfileId = DEFAULT_OPPONENT_PROFILE_ID;

function historyMoves(history: readonly { readonly uci: UciMove }[]): readonly UciMove[] {
  return Object.freeze(history.map((record) => record.uci));
}

function remainingMs(
  session: ReturnType<GameSessionCoordinator["getSession"]>,
  color: "black" | "white",
): number | undefined {
  const clock = session.clock;
  if (clock.status === "untimed") return undefined;
  return clock.remaining[color];
}

function frozen(outcome: OpponentTurnOutcome): OpponentTurnOutcome {
  return Object.freeze(outcome);
}
