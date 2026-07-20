import { parseGameId, type GameId } from "@caissa/chess-core";

import type {
  CompletedGameRecord,
  CompletedGameSummary,
  CorruptedRecordMetadata,
  GameRepository,
  PersistenceError,
  ReviewReadResult,
  ReviewRepository,
  StoredReviewRecord,
} from "../persistence";
import {
  CLEAR_HISTORY_CONFIRMATION,
  DELETE_COMPLETED_GAME_CONFIRMATION,
  type ClearHistoryCommand,
  type DeleteCompletedGameCommand,
  type GameHistoryDetail,
  type GameHistoryDetailResult,
  type GameHistoryListItem,
  type GameHistoryListResult,
  type GameHistoryMutationResult,
  type GameHistoryService,
  type HistoryReviewSummary,
  type OptionalCleanupWarning,
  type PgnExportResult,
} from "./game-history-types";

export interface CreateGameHistoryServiceOptions {
  readonly gameRepository: GameRepository;
  readonly reviewRepository: ReviewRepository;
}

export function createGameHistoryService(
  options: CreateGameHistoryServiceOptions,
): GameHistoryService {
  return new DefaultGameHistoryService(options);
}

class DefaultGameHistoryService implements GameHistoryService {
  constructor(private readonly options: CreateGameHistoryServiceOptions) {}

  async listGames(
    query?: Parameters<GameRepository["listCompletedGames"]>[0],
  ): Promise<GameHistoryListResult> {
    let listed: Awaited<ReturnType<GameRepository["listCompletedGames"]>>;
    try {
      listed = await this.options.gameRepository.listCompletedGames(query);
    } catch {
      return failedResult(unknownStorageError("history.list"));
    }
    if (listed.status === "rejected") return Object.freeze(listed);
    if (listed.status === "failed") return failedResult(listed.error);

    const items = await Promise.all(
      listed.items.map(async (summary) =>
        toHistoryListItem(summary, await this.readReviewSummary(summary.gameId)),
      ),
    );
    return Object.freeze({
      corruptions: Object.freeze(listed.corruptions.map(freezeCorruption)),
      items: Object.freeze(items),
      status: "listed" as const,
      ...(listed.nextCursor === undefined
        ? {}
        : {
            nextCursor: Object.freeze({
              completedAt: listed.nextCursor.completedAt,
              gameId: listed.nextCursor.gameId,
            }),
          }),
    });
  }

  async getGame(gameId: GameId): Promise<GameHistoryDetailResult> {
    let read: Awaited<ReturnType<GameRepository["getCompletedGame"]>>;
    try {
      read = await this.options.gameRepository.getCompletedGame(parseGameId(gameId));
    } catch {
      return failedResult(unknownStorageError("history.detail"));
    }
    if (read.status === "not-found") return Object.freeze(read);
    if (read.status === "corrupted") {
      return Object.freeze({ corruption: freezeCorruption(read.corruption), status: "corrupted" });
    }
    if (read.status === "failed") return failedResult(read.error);

    const review = await this.readReview(read.record.gameId);
    return Object.freeze({
      detail: toHistoryDetail(read.record, review),
      status: "found" as const,
    });
  }

  async createPgnExport(gameId: GameId): Promise<PgnExportResult> {
    let read: Awaited<ReturnType<GameRepository["getCompletedGame"]>>;
    try {
      read = await this.options.gameRepository.getCompletedGame(parseGameId(gameId));
    } catch {
      return failedResult(unknownStorageError("history.export"));
    }
    if (read.status === "not-found") return Object.freeze(read);
    if (read.status === "corrupted") {
      return Object.freeze({ corruption: freezeCorruption(read.corruption), status: "corrupted" });
    }
    if (read.status === "failed") return failedResult(read.error);

    return Object.freeze({
      descriptor: Object.freeze({
        content: read.record.pgn,
        filename: createSafePgnFilename(read.record),
        mimeType: "application/x-chess-pgn" as const,
      }),
      status: "ready" as const,
    });
  }

  async deleteGame(command: DeleteCompletedGameCommand): Promise<GameHistoryMutationResult> {
    if (!isConfirmedDelete(command)) {
      return Object.freeze({ reason: "confirmation-required", status: "rejected" });
    }
    let gameDeletion: Awaited<ReturnType<GameRepository["deleteCompletedGame"]>>;
    try {
      gameDeletion = await this.options.gameRepository.deleteCompletedGame(command.gameId);
    } catch {
      return failedResult(unknownStorageError("history.delete"));
    }
    if (gameDeletion.status === "failed") return failedResult(gameDeletion.error);

    const cleanup = await this.deleteReview(command.gameId);
    return cleanup
      ? Object.freeze({ status: "deleted-with-cleanup-warning", warning: cleanup })
      : Object.freeze({ status: "deleted" });
  }

  async clearHistory(command: ClearHistoryCommand): Promise<GameHistoryMutationResult> {
    if (!isConfirmedClear(command)) {
      return Object.freeze({ reason: "confirmation-required", status: "rejected" });
    }
    let gameClear: Awaited<ReturnType<GameRepository["clearCompletedGames"]>>;
    try {
      gameClear = await this.options.gameRepository.clearCompletedGames();
    } catch {
      return failedResult(unknownStorageError("history.clear"));
    }
    if (gameClear.status === "failed") return failedResult(gameClear.error);

    const cleanup = await this.clearReviews();
    return cleanup
      ? Object.freeze({ status: "cleared-with-cleanup-warning", warning: cleanup })
      : Object.freeze({ status: "cleared" });
  }

  private async readReviewSummary(gameId: GameId): Promise<HistoryReviewSummary> {
    const read = await this.readReviewResult(gameId);
    return read.status === "found"
      ? Object.freeze({ reviewStatus: read.record.status, status: "available" })
      : read.status === "not-found"
        ? Object.freeze({ status: "not-available" })
        : Object.freeze({ status: "unavailable" });
  }

  private async readReview(gameId: GameId): Promise<StoredReviewRecord | undefined> {
    const read = await this.readReviewResult(gameId);
    return read.status === "found" ? read.record : undefined;
  }

  private async readReviewResult(gameId: GameId): Promise<ReviewReadResult> {
    try {
      return await this.options.reviewRepository.getReview(gameId);
    } catch {
      return {
        error: unknownStorageError("history.review-read"),
        status: "failed",
      };
    }
  }

  private async deleteReview(gameId: GameId): Promise<OptionalCleanupWarning | undefined> {
    try {
      const result = await this.options.reviewRepository.deleteReview(gameId);
      if (result.status === "saved") return undefined;
      return cleanupWarning(
        result.status === "failed" ? result.error : validationError("history.review-delete"),
      );
    } catch {
      return cleanupWarning(unknownStorageError("history.review-delete"));
    }
  }

  private async clearReviews(): Promise<OptionalCleanupWarning | undefined> {
    try {
      const result = await this.options.reviewRepository.clearReviews();
      if (result.status === "saved") return undefined;
      return cleanupWarning(
        result.status === "failed" ? result.error : validationError("history.review-clear"),
      );
    } catch {
      return cleanupWarning(unknownStorageError("history.review-clear"));
    }
  }
}

function toHistoryListItem(
  summary: CompletedGameSummary,
  review: HistoryReviewSummary,
): GameHistoryListItem {
  return Object.freeze({
    completedAt: summary.completedAt,
    gameId: summary.gameId,
    moveCount: summary.moveCount,
    participants: Object.freeze({
      black: freezeParticipant(summary.participants.black),
      white: freezeParticipant(summary.participants.white),
    }),
    result: summary.result,
    review,
    revision: summary.revision,
    timeControl: summary.timeControl,
  });
}

function toHistoryDetail(
  record: CompletedGameRecord,
  review: StoredReviewRecord | undefined,
): GameHistoryDetail {
  const summary = toHistoryListItem(
    {
      completedAt: record.completedAt,
      gameId: record.gameId,
      moveCount: record.checkpoint.history.length,
      participants: record.checkpoint.configuration.participants,
      result: record.result,
      revision: record.checkpoint.revision,
      timeControl: record.checkpoint.configuration.timeControl,
    },
    review
      ? Object.freeze({ reviewStatus: review.status, status: "available" })
      : Object.freeze({ status: "not-available" }),
  );
  return Object.freeze({
    checkpoint: record.checkpoint,
    completedAt: record.completedAt,
    gameId: record.gameId,
    pgn: record.pgn,
    result: record.result,
    review,
    summary,
    ...(record.startedAt === undefined ? {} : { startedAt: record.startedAt }),
  });
}

function freezeParticipant(participant: {
  readonly kind: "external-opponent" | "human";
  readonly label?: string;
}) {
  return Object.freeze({
    kind: participant.kind,
    ...(participant.label === undefined ? {} : { label: participant.label }),
  });
}

function createSafePgnFilename(record: CompletedGameRecord): string {
  const safeGameId = String(record.gameId)
    .replace(/[^A-Za-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return `caissa-${String(record.completedAt)}-${safeGameId || "game"}.pgn`;
}

function isConfirmedDelete(value: unknown): value is DeleteCompletedGameCommand {
  if (!isRecord(value) || value.confirmation !== DELETE_COMPLETED_GAME_CONFIRMATION) return false;
  try {
    return typeof value.gameId === "string" && parseGameId(value.gameId) === value.gameId;
  } catch {
    return false;
  }
}

function isConfirmedClear(value: unknown): value is ClearHistoryCommand {
  return isRecord(value) && value.confirmation === CLEAR_HISTORY_CONFIRMATION;
}

function cleanupWarning(error: PersistenceError): OptionalCleanupWarning {
  return Object.freeze({ error: freezeError(error), resource: "review-metadata" });
}

function failedResult(error: PersistenceError) {
  const safeError = freezeError(error);
  return Object.freeze({
    error: safeError,
    status: isStorageUnavailable(safeError) ? "storage-unavailable" : "failed",
  } as const);
}

function isStorageUnavailable(error: PersistenceError): boolean {
  return error.code === "storage-unavailable" || error.code === "database-closed";
}

function unknownStorageError(operation: string): PersistenceError {
  return Object.freeze({ code: "unknown-storage-error", operation, retryable: true });
}

function validationError(operation: string): PersistenceError {
  return Object.freeze({ code: "validation-failed", operation, retryable: false });
}

function freezeError(error: PersistenceError): PersistenceError {
  return Object.freeze({
    code: error.code,
    operation: error.operation,
    retryable: error.retryable,
  });
}

function freezeCorruption(corruption: CorruptedRecordMetadata): CorruptedRecordMetadata {
  return Object.freeze({
    category: corruption.category,
    rawRecoveryMayBePossible: corruption.rawRecoveryMayBePossible,
    recordKey: corruption.recordKey,
    recordType: corruption.recordType,
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
