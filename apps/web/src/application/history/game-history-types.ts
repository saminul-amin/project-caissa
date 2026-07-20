import type {
  GameId,
  GameParticipant,
  GameResult,
  GameSessionCheckpoint,
  Pgn,
  SessionRevision,
  TimeControl,
} from "@caissa/chess-core";

import type {
  CompletedGameCursor,
  CompletedGameQuery,
  CorruptedRecordMetadata,
  EpochTimestampMs,
  PersistenceError,
  ReviewGenerationStatus,
  StoredReviewRecord,
} from "../persistence";

export type HistoryReviewSummary =
  | { readonly status: "not-available" }
  | {
      readonly reviewStatus: ReviewGenerationStatus;
      readonly status: "available";
    }
  | { readonly status: "unavailable" };

export interface GameHistoryParticipantReadModel {
  readonly kind: GameParticipant["kind"];
  readonly label?: string;
}

export interface GameHistoryListItem {
  readonly completedAt: EpochTimestampMs;
  readonly gameId: GameId;
  readonly moveCount: number;
  readonly participants: Readonly<{
    readonly black: GameHistoryParticipantReadModel;
    readonly white: GameHistoryParticipantReadModel;
  }>;
  readonly result: GameResult;
  readonly review: HistoryReviewSummary;
  readonly revision: SessionRevision;
  readonly timeControl: TimeControl;
}

export interface GameHistoryDetail {
  readonly checkpoint: GameSessionCheckpoint;
  readonly completedAt: EpochTimestampMs;
  readonly gameId: GameId;
  readonly pgn: Pgn;
  readonly result: GameResult;
  readonly review: StoredReviewRecord | undefined;
  readonly startedAt?: EpochTimestampMs;
  readonly summary: GameHistoryListItem;
}

export type GameHistoryListResult =
  | {
      readonly corruptions: readonly CorruptedRecordMetadata[];
      readonly items: readonly GameHistoryListItem[];
      readonly nextCursor?: CompletedGameCursor;
      readonly status: "listed";
    }
  | { readonly reason: "invalid-query"; readonly status: "rejected" }
  | { readonly error: PersistenceError; readonly status: "storage-unavailable" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export type GameHistoryDetailResult =
  | { readonly detail: GameHistoryDetail; readonly status: "found" }
  | { readonly status: "not-found" }
  | { readonly corruption: CorruptedRecordMetadata; readonly status: "corrupted" }
  | { readonly error: PersistenceError; readonly status: "storage-unavailable" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export interface PgnExportDescriptor {
  readonly content: Pgn;
  readonly filename: string;
  readonly mimeType: "application/x-chess-pgn";
}

export type PgnExportResult =
  | { readonly descriptor: PgnExportDescriptor; readonly status: "ready" }
  | { readonly status: "not-found" }
  | { readonly corruption: CorruptedRecordMetadata; readonly status: "corrupted" }
  | { readonly error: PersistenceError; readonly status: "storage-unavailable" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export const DELETE_COMPLETED_GAME_CONFIRMATION = "delete-completed-game" as const;
export const CLEAR_HISTORY_CONFIRMATION = "clear-completed-game-history" as const;

export interface DeleteCompletedGameCommand {
  readonly confirmation: typeof DELETE_COMPLETED_GAME_CONFIRMATION;
  readonly gameId: GameId;
}

export interface ClearHistoryCommand {
  readonly confirmation: typeof CLEAR_HISTORY_CONFIRMATION;
}

export interface OptionalCleanupWarning {
  readonly error: PersistenceError;
  readonly resource: "review-metadata";
}

export type GameHistoryMutationResult =
  | { readonly status: "deleted" | "cleared" }
  | {
      readonly status: "deleted-with-cleanup-warning" | "cleared-with-cleanup-warning";
      readonly warning: OptionalCleanupWarning;
    }
  | { readonly reason: "confirmation-required"; readonly status: "rejected" }
  | { readonly error: PersistenceError; readonly status: "storage-unavailable" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export interface GameHistoryService {
  listGames(query?: CompletedGameQuery): Promise<GameHistoryListResult>;
  getGame(gameId: GameId): Promise<GameHistoryDetailResult>;
  createPgnExport(gameId: GameId): Promise<PgnExportResult>;
  deleteGame(command: DeleteCompletedGameCommand): Promise<GameHistoryMutationResult>;
  clearHistory(command: ClearHistoryCommand): Promise<GameHistoryMutationResult>;
}
