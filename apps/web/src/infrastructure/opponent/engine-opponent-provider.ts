import { moveInputFromUci } from "@caissa/chess-core";

import {
  findOpponentProfile,
  type OpponentMoveContext,
  type OpponentMoveResult,
  type OpponentProfile,
  type OpponentProvider,
} from "../../application/opponent";
import type { ChessEnginePort, EngineFailureReason } from "../engine";

export interface DelayPort {
  /** Resolves after the delay, or earlier when the returned turn is cancelled. */
  wait(delayMs: number): Promise<void>;
}

export interface RandomSource {
  /** Uniform value in `[0, 1)`. */
  next(): number;
}

export interface CreateEngineOpponentProviderOptions {
  readonly delay?: DelayPort;
  readonly engine: ChessEnginePort;
  readonly random?: RandomSource;
  /** Overrides the profile catalogue in tests. */
  readonly resolveProfile?: (context: OpponentMoveContext) => OpponentProfile;
}

const timerDelay: DelayPort = Object.freeze({
  wait(delayMs: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  },
});

const mathRandom: RandomSource = Object.freeze({
  next() {
    return Math.random();
  },
});

/**
 * Engine-backed opponent.
 *
 * Search time is bounded by the profile and further bounded by the opponent clock, so a
 * blitz game never stalls behind a long search. A short, varied pause is added before the
 * move is proposed: instant replies feel mechanical, and the pause is presentation only.
 */
export function createEngineOpponentProvider(
  options: CreateEngineOpponentProviderOptions,
): OpponentProvider {
  const delay = options.delay ?? timerDelay;
  const random = options.random ?? mathRandom;
  const resolveProfile =
    options.resolveProfile ??
    ((context: OpponentMoveContext) => findOpponentProfile(context.profileId));

  let generation = 0;

  return Object.freeze({
    providerId: `engine:${options.engine.engineId}`,

    cancel() {
      generation += 1;
      options.engine.stop();
    },

    async proposeMove(context: OpponentMoveContext): Promise<OpponentMoveResult> {
      const turn = (generation += 1);
      const profile = resolveProfile(context);
      const moveTimeMs = boundedMoveTimeMs(profile, context.remainingMs);

      const search = await options.engine.search({
        fen: context.fen,
        limits: {
          movetimeMs: moveTimeMs,
          ...(profile.strength.searchDepth === undefined
            ? {}
            : { depth: profile.strength.searchDepth }),
        },
        moves: context.moves.map((move) => String(move)),
        newGame: context.moves.length === 0,
        options: {
          multiPv: 1,
          skillLevel: profile.strength.skillLevel,
          ...(profile.strength.limitStrengthElo === undefined
            ? {}
            : { limitStrengthElo: profile.strength.limitStrengthElo }),
        },
        startsFromInitialPosition: context.startsFromInitialPosition,
      });

      if (turn !== generation) {
        return Object.freeze({ reason: "request-cancelled" as const, status: "failed" });
      }
      if (search.status === "failed") {
        return Object.freeze({ reason: mapEngineFailure(search.reason), status: "failed" });
      }
      if (search.status === "no-move") {
        return Object.freeze({ reason: "invalid-response" as const, status: "failed" });
      }

      let move;
      try {
        move = moveInputFromUci(search.bestMove);
      } catch {
        return Object.freeze({ reason: "invalid-response" as const, status: "failed" });
      }

      const pause = remainingThinkTimeMs(profile, moveTimeMs, random.next());
      if (pause > 0) await delay.wait(pause);
      if (turn !== generation) {
        return Object.freeze({ reason: "request-cancelled" as const, status: "failed" });
      }

      return Object.freeze({ move, status: "proposed" as const });
    },
  });
}

const clockSafetyDivisor = 12;
const minimumMoveTimeMs = 80;
const lowClockThresholdMs = 5_000;

export function boundedMoveTimeMs(profile: OpponentProfile, remainingMs?: number): number {
  const base = profile.strength.moveTimeMs;
  if (remainingMs === undefined) return base;
  if (remainingMs <= lowClockThresholdMs) return minimumMoveTimeMs;
  return Math.max(minimumMoveTimeMs, Math.min(base, Math.floor(remainingMs / clockSafetyDivisor)));
}

export function remainingThinkTimeMs(
  profile: OpponentProfile,
  spentMs: number,
  randomValue: number,
): number {
  const span = Math.max(0, profile.thinkTime.maximumMs - profile.thinkTime.minimumMs);
  const target = profile.thinkTime.minimumMs + Math.floor(span * clampUnit(randomValue));
  return Math.max(0, target - spentMs);
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999_999, Math.max(0, value));
}

function mapEngineFailure(reason: EngineFailureReason) {
  switch (reason) {
    case "cancelled":
      return "request-cancelled" as const;
    case "timeout":
      return "timeout" as const;
    case "load-failed":
    case "unsupported":
    case "terminated":
      return "unavailable" as const;
    case "protocol-error":
      return "invalid-response" as const;
  }
}
