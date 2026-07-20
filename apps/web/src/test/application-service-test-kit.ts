import {
  ChessJsRulesAdapter,
  createGameController,
  moveInputFromUci,
  parseGameId,
  parseMonotonicTimestampMs,
  parseRequestId,
  parseSessionRevision,
  parseUciMove,
  type GameController,
  type GameId,
  type HumanMoveCommand,
  type GameSessionCheckpoint,
  type OpponentMoveProposal,
} from "@caissa/chess-core";

import type {
  CompletedGameListResult,
  CompletedGameQuery,
  CompletedGameReadResult,
  CompletedGameRecord,
  GameCheckpointReadResult,
  GamePersistenceResult,
  GameRepository,
  PersistenceClearResult,
  PersistenceDeleteResult,
  PersistenceError,
  ReviewReadResult,
  ReviewRepository,
  ReviewWriteResult,
  StoredReviewRecord,
} from "../application/persistence";
import { FixedWallClock } from "./persistence-test-kit";

type MaybePromise<T> = T | Promise<T>;

export const retryableStorageError: PersistenceError = Object.freeze({
  code: "storage-unavailable",
  operation: "test",
  retryable: true,
});

export class MemoryGameRepository implements GameRepository {
  active: GameSessionCheckpoint | undefined;
  readonly completed = new Map<GameId, CompletedGameRecord>();
  readonly calls: string[] = [];
  readonly activeSaves: GameSessionCheckpoint[] = [];
  readonly finalizations: CompletedGameRecord[] = [];
  saveActiveImplementation:
    ((checkpoint: GameSessionCheckpoint) => MaybePromise<GamePersistenceResult>) | undefined;
  finalizeImplementation:
    ((record: CompletedGameRecord) => MaybePromise<GamePersistenceResult>) | undefined;
  getActiveImplementation: (() => MaybePromise<GameCheckpointReadResult>) | undefined;
  listImplementation:
    ((query?: CompletedGameQuery) => MaybePromise<CompletedGameListResult>) | undefined;
  getCompletedImplementation:
    ((gameId: GameId) => MaybePromise<CompletedGameReadResult>) | undefined;
  deleteImplementation: ((gameId: GameId) => MaybePromise<PersistenceDeleteResult>) | undefined;
  clearCompletedImplementation: (() => MaybePromise<PersistenceClearResult>) | undefined;
  clearActiveImplementation: (() => MaybePromise<PersistenceClearResult>) | undefined;

  async saveActiveGame(checkpoint: GameSessionCheckpoint): Promise<GamePersistenceResult> {
    this.calls.push("save-active");
    this.activeSaves.push(checkpoint);
    if (this.saveActiveImplementation) return this.saveActiveImplementation(checkpoint);
    this.active = checkpoint;
    return { status: "saved" };
  }

  async getActiveGame(): Promise<GameCheckpointReadResult> {
    this.calls.push("get-active");
    if (this.getActiveImplementation) return this.getActiveImplementation();
    return this.active
      ? { checkpoint: this.active, status: "found", updatedAt: new FixedWallClock().nowEpochMs() }
      : { status: "not-found" };
  }

  async clearActiveGame(): Promise<PersistenceClearResult> {
    this.calls.push("clear-active");
    if (this.clearActiveImplementation) return this.clearActiveImplementation();
    this.active = undefined;
    return { status: "cleared" };
  }

  saveCompletedGame(record: CompletedGameRecord): Promise<GamePersistenceResult> {
    this.calls.push("save-completed");
    this.completed.set(record.gameId, record);
    return Promise.resolve({ status: "saved" });
  }

  async finalizeGame(record: CompletedGameRecord): Promise<GamePersistenceResult> {
    this.calls.push("finalize");
    this.finalizations.push(record);
    if (this.finalizeImplementation) return this.finalizeImplementation(record);
    this.completed.set(record.gameId, record);
    if (this.active?.gameId === record.gameId) this.active = undefined;
    return { status: "saved" };
  }

  async getCompletedGame(gameId: GameId): Promise<CompletedGameReadResult> {
    this.calls.push("get-completed");
    if (this.getCompletedImplementation) return this.getCompletedImplementation(gameId);
    const record = this.completed.get(gameId);
    return record ? { record, status: "found" } : { status: "not-found" };
  }

  async listCompletedGames(query?: CompletedGameQuery): Promise<CompletedGameListResult> {
    this.calls.push("list-completed");
    if (this.listImplementation) return this.listImplementation(query);
    const items = [...this.completed.values()].map((record) => ({
      completedAt: record.completedAt,
      gameId: record.gameId,
      moveCount: record.checkpoint.history.length,
      participants: record.checkpoint.configuration.participants,
      result: record.result,
      revision: record.checkpoint.revision,
      timeControl: record.checkpoint.configuration.timeControl,
    }));
    return { corruptions: Object.freeze([]), items: Object.freeze(items), status: "listed" };
  }

  async deleteCompletedGame(gameId: GameId): Promise<PersistenceDeleteResult> {
    this.calls.push("delete-completed");
    if (this.deleteImplementation) return this.deleteImplementation(gameId);
    this.completed.delete(gameId);
    return { status: "deleted" };
  }

  async clearCompletedGames(): Promise<PersistenceClearResult> {
    this.calls.push("clear-completed");
    if (this.clearCompletedImplementation) return this.clearCompletedImplementation();
    this.completed.clear();
    return { status: "cleared" };
  }
}

export class MemoryReviewRepository implements ReviewRepository {
  readonly records = new Map<GameId, StoredReviewRecord>();
  readonly calls: string[] = [];
  getImplementation: ((gameId: GameId) => MaybePromise<ReviewReadResult>) | undefined;
  deleteImplementation: ((gameId: GameId) => MaybePromise<ReviewWriteResult>) | undefined;
  clearImplementation: (() => MaybePromise<ReviewWriteResult>) | undefined;

  saveReview(record: StoredReviewRecord): Promise<ReviewWriteResult> {
    this.calls.push("save-review");
    this.records.set(record.gameId, record);
    return Promise.resolve({ status: "saved" });
  }

  async getReview(gameId: GameId): Promise<ReviewReadResult> {
    this.calls.push("get-review");
    if (this.getImplementation) return this.getImplementation(gameId);
    const record = this.records.get(gameId);
    return record ? { record, status: "found" } : { status: "not-found" };
  }

  async deleteReview(gameId: GameId): Promise<ReviewWriteResult> {
    this.calls.push("delete-review");
    if (this.deleteImplementation) return this.deleteImplementation(gameId);
    this.records.delete(gameId);
    return { status: "saved" };
  }

  async clearReviews(): Promise<ReviewWriteResult> {
    this.calls.push("clear-reviews");
    if (this.clearImplementation) return this.clearImplementation();
    this.records.clear();
    return { status: "saved" };
  }
}

export interface ControllerFixtureOptions {
  readonly black?: "external-opponent" | "human";
  readonly fen?: string;
  readonly id?: string;
  readonly timeControl?: unknown;
  readonly white?: "external-opponent" | "human";
}

export function createControllerFixture(options: ControllerFixtureOptions = {}): GameController {
  return createGameController({
    configuration: {
      allowUndo: true,
      gameId: parseGameId(options.id ?? "application-game"),
      initialPosition: options.fen ? { fen: options.fen, kind: "fen" } : { kind: "standard" },
      participants: {
        black: { kind: options.black ?? "human" },
        white: { kind: options.white ?? "human" },
      },
      timeControl: options.timeControl ?? { kind: "untimed" },
    },
    rules: new ChessJsRulesAdapter(),
  });
}

export function humanMove(uci: string, now: number, expectedRevision?: number): HumanMoveCommand {
  return {
    move: moveInputFromUci(parseUciMove(uci)),
    now: parseMonotonicTimestampMs(now),
    ...(expectedRevision === undefined
      ? {}
      : { expectedRevision: parseSessionRevision(expectedRevision) }),
  };
}

export function createOpponentProposal(
  controller: Pick<GameController, "getSession">,
  uci: string,
): OpponentMoveProposal {
  const request = controller.getSession().activeOpponentRequest;
  if (!request) throw new Error("The fixture controller has no active opponent request.");
  return Object.freeze({
    expectedFen: request.expectedFen,
    expectedPly: request.expectedPly,
    expectedRevision: request.expectedRevision,
    move: moveInputFromUci(parseUciMove(uci)),
    requestId: request.requestId,
    requestedColor: request.requestedColor,
  });
}

export function requestId(value = "application-request") {
  return parseRequestId(value);
}

export function at(value: number) {
  return parseMonotonicTimestampMs(value);
}

export interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: T | PromiseLike<T>) => void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, reject, resolve });
}
