import type {
  GameId,
  GameParticipant,
  GameResult,
  GameSessionCheckpoint,
  Pgn,
  SessionRevision,
  TimeControl,
} from "@caissa/chess-core";

import type { PersistenceError, PersistenceRejectionReason } from "./errors";
import type {
  CorruptedRecordMetadata,
  PersistenceClearResult,
  PersistenceDeleteResult,
  PersistenceWriteResult,
} from "./results";
import type { EpochTimestampMs } from "./time";

export const DEFAULT_COMPLETED_GAME_PAGE_SIZE = 25;
export const MAXIMUM_COMPLETED_GAME_PAGE_SIZE = 100;

export interface CompletedGameRecord {
  readonly checkpoint: GameSessionCheckpoint;
  readonly completedAt: EpochTimestampMs;
  readonly gameId: GameId;
  readonly pgn: Pgn;
  readonly result: GameResult;
  readonly startedAt?: EpochTimestampMs;
}

export interface CompletedGameCursor {
  readonly completedAt: EpochTimestampMs;
  readonly gameId: GameId;
}

export type CompletedGameSort = "completed-asc" | "completed-desc";

export interface CompletedGameQuery {
  readonly cursor?: CompletedGameCursor;
  readonly limit?: number;
  readonly sort?: CompletedGameSort;
}

export interface CompletedGameParticipantSummary {
  readonly kind: GameParticipant["kind"];
  readonly label?: string;
}

export interface CompletedGameSummary {
  readonly completedAt: EpochTimestampMs;
  readonly gameId: GameId;
  readonly moveCount: number;
  readonly participants: {
    readonly black: CompletedGameParticipantSummary;
    readonly white: CompletedGameParticipantSummary;
  };
  readonly result: GameResult;
  readonly revision: SessionRevision;
  readonly timeControl: TimeControl;
}

export type GamePersistenceResult = PersistenceWriteResult;

export type GameCheckpointReadResult =
  | {
      readonly checkpoint: GameSessionCheckpoint;
      readonly status: "found";
      readonly updatedAt: EpochTimestampMs;
    }
  | { readonly status: "not-found" }
  | {
      readonly corruption: CorruptedRecordMetadata;
      readonly status: "corrupted";
    }
  | { readonly error: PersistenceError; readonly status: "failed" };

export type CompletedGameReadResult =
  | { readonly record: CompletedGameRecord; readonly status: "found" }
  | { readonly status: "not-found" }
  | {
      readonly corruption: CorruptedRecordMetadata;
      readonly status: "corrupted";
    }
  | { readonly error: PersistenceError; readonly status: "failed" };

export type CompletedGameListResult =
  | {
      readonly corruptions: readonly CorruptedRecordMetadata[];
      readonly items: readonly CompletedGameSummary[];
      readonly nextCursor?: CompletedGameCursor;
      readonly status: "listed";
    }
  | {
      readonly reason: Extract<PersistenceRejectionReason, "invalid-query">;
      readonly status: "rejected";
    }
  | { readonly error: PersistenceError; readonly status: "failed" };

export interface GameRepository {
  saveActiveGame(checkpoint: GameSessionCheckpoint): Promise<GamePersistenceResult>;
  getActiveGame(): Promise<GameCheckpointReadResult>;
  clearActiveGame(): Promise<PersistenceClearResult>;
  saveCompletedGame(record: CompletedGameRecord): Promise<GamePersistenceResult>;
  finalizeGame(record: CompletedGameRecord): Promise<GamePersistenceResult>;
  getCompletedGame(gameId: GameId): Promise<CompletedGameReadResult>;
  listCompletedGames(query?: CompletedGameQuery): Promise<CompletedGameListResult>;
  deleteCompletedGame(gameId: GameId): Promise<PersistenceDeleteResult>;
  clearCompletedGames(): Promise<PersistenceClearResult>;
}
