import { parseGameId, type GameId } from "@caissa/chess-core";

import {
  parseEpochTimestampMs,
  type ReviewReadResult,
  type ReviewRepository,
  type ReviewWriteResult,
  type StoredReviewRecord,
  type WallClock,
} from "../../application/persistence";
import { reviewRecordInputSchema } from "../../application/persistence/review-repository";
import type { CaissaDatabase } from "./database";
import { mapPersistenceError } from "./error-mapper";
import { corruptedRecord } from "./record-safety";
import { REVIEW_RECORD_VERSION, type ReviewStorageRecord } from "./storage-records";
import { cloneForStorage, validateReviewStorageRecord } from "./validation";

export class DexieReviewRepository implements ReviewRepository {
  constructor(
    private readonly database: CaissaDatabase,
    private readonly wallClock: WallClock,
  ) {}

  async saveReview(record: StoredReviewRecord): Promise<ReviewWriteResult> {
    const input = reviewRecordInputSchema.safeParse(record);
    if (!input.success) return { reason: "validation-failed", status: "rejected" };

    try {
      const gameId = parseGameId(input.data.gameId);
      const generatedAt =
        input.data.generatedAt === undefined
          ? undefined
          : parseEpochTimestampMs(input.data.generatedAt);
      const storage: ReviewStorageRecord = cloneForStorage({
        gameId,
        provenance: input.data.provenance,
        recordVersion: REVIEW_RECORD_VERSION,
        recordGameId: gameId,
        reviewVersion: input.data.reviewVersion,
        status: input.data.status,
        updatedAt: this.wallClock.nowEpochMs(),
        ...(generatedAt === undefined ? {} : { generatedAt }),
      });
      const validation = validateReviewStorageRecord(storage);
      if (validation.status === "invalid") {
        return { reason: "validation-failed", status: "rejected" };
      }
      await this.database.reviews.put(storage);
      return { status: "saved" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "review.save"), status: "failed" };
    }
  }

  async getReview(gameId: GameId): Promise<ReviewReadResult> {
    try {
      const safeGameId = parseGameId(gameId);
      const stored: unknown = await this.database.reviews.get(safeGameId);
      if (stored === undefined) return { status: "not-found" };

      const validation = validateReviewStorageRecord(stored);
      if (validation.status === "invalid") {
        return {
          corruption: corruptedRecord("review", safeGameId, validation.category, false),
          status: "corrupted",
        };
      }
      if (validation.value.record.gameId !== safeGameId) {
        return {
          corruption: corruptedRecord("review", safeGameId, "mismatched-game-id", false),
          status: "corrupted",
        };
      }
      return { record: validation.value.record, status: "found" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "review.read"), status: "failed" };
    }
  }

  async deleteReview(gameId: GameId): Promise<ReviewWriteResult> {
    try {
      await this.database.reviews.delete(parseGameId(gameId));
      return { status: "saved" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "review.delete"), status: "failed" };
    }
  }

  async clearReviews(): Promise<ReviewWriteResult> {
    try {
      await this.database.reviews.clear();
      return { status: "saved" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "review.clear"), status: "failed" };
    }
  }
}
