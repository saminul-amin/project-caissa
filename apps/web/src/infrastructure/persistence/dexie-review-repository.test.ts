import { parseGameId } from "@caissa/chess-core";
import { afterEach, describe, expect, it } from "vitest";

import { REVIEW_RECORD_VERSION } from "./storage-records";
import {
  createAbandonedRecord,
  createCheckpoint,
  createPersistenceTestContext,
  createReviewRecord,
  destroyPersistenceTestContext,
  type PersistenceTestContext,
} from "../../test/persistence-test-kit";

describe("DexieReviewRepository", () => {
  let context: PersistenceTestContext | undefined;

  afterEach(async () => {
    if (context) await destroyPersistenceTestContext(context.database);
    context = undefined;
  });

  async function setup(): Promise<PersistenceTestContext> {
    context = await createPersistenceTestContext();
    return context;
  }

  it("saves review metadata without generating a review", async () => {
    const { database, reviewRepository } = await setup();

    expect(await reviewRepository.saveReview(createReviewRecord("review-save"))).toEqual({
      status: "saved",
    });
    expect(await database.reviews.count()).toBe(1);
  });

  it("reads validated review metadata", async () => {
    const { reviewRepository } = await setup();
    const record = createReviewRecord("review-read", "partial");
    await reviewRepository.saveReview(record);

    const result = await reviewRepository.getReview(record.gameId);

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.record.status).toBe("partial");
      expect(result.record.updatedAt).toBe(1_000);
    }
  });

  it("returns not-found when review metadata is absent", async () => {
    const { reviewRepository } = await setup();
    expect(await reviewRepository.getReview(parseGameId("review-missing"))).toEqual({
      status: "not-found",
    });
  });

  it("upserts review-generation status for the same game", async () => {
    const { reviewRepository, wallClock } = await setup();
    const first = createReviewRecord("review-update", "in-progress");
    await reviewRepository.saveReview(first);
    wallClock.set(3_000);
    await reviewRepository.saveReview(createReviewRecord("review-update", "completed"));

    const result = await reviewRepository.getReview(first.gameId);

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.record.status).toBe("completed");
      expect(result.record.updatedAt).toBe(3_000);
    }
  });

  it("deletes one review without deleting a game", async () => {
    const { gameRepository, reviewRepository } = await setup();
    const review = createReviewRecord("review-delete");
    await reviewRepository.saveReview(review);
    const active = createCheckpoint("ready", "review-delete");
    await gameRepository.saveActiveGame(active);

    expect(await reviewRepository.deleteReview(review.gameId)).toEqual({ status: "saved" });
    expect((await gameRepository.getActiveGame()).status).toBe("found");
  });

  it("clears all reviews without changing completed history", async () => {
    const { gameRepository, reviewRepository } = await setup();
    const game = createAbandonedRecord("review-clear", 2_000);
    await gameRepository.saveCompletedGame(game);
    await reviewRepository.saveReview(createReviewRecord("review-clear", "failed"));

    expect(await reviewRepository.clearReviews()).toEqual({ status: "saved" });
    expect((await gameRepository.getCompletedGame(game.gameId)).status).toBe("found");
  });

  it("rejects an invalid review status", async () => {
    const { reviewRepository } = await setup();
    const invalid = {
      ...createReviewRecord("review-invalid"),
      status: "invented-status",
    };

    expect(await reviewRepository.saveReview(invalid as never)).toEqual({
      reason: "validation-failed",
      status: "rejected",
    });
  });

  it("reports mismatched review game IDs as corruption", async () => {
    const { database, reviewRepository } = await setup();
    await database.table<unknown, string>("reviews").put({
      gameId: "review-key",
      provenance: [],
      recordGameId: "different-review",
      recordVersion: REVIEW_RECORD_VERSION,
      reviewVersion: 1,
      status: "not-started",
      updatedAt: 1_000,
    });

    expect(await reviewRepository.getReview(parseGameId("review-key"))).toMatchObject({
      corruption: { category: "mismatched-game-id" },
      status: "corrupted",
    });
  });

  it("validates review storage-record versions", async () => {
    const { database, reviewRepository } = await setup();
    await database.table<unknown, string>("reviews").put({
      gameId: "review-version",
      provenance: [],
      recordGameId: "review-version",
      recordVersion: 99,
      reviewVersion: 1,
      status: "not-started",
      updatedAt: 1_000,
    });

    expect(await reviewRepository.getReview(parseGameId("review-version"))).toMatchObject({
      corruption: { category: "unsupported-record-version" },
      status: "corrupted",
    });
  });

  it("stores metadata only and exposes no review-generation payload", async () => {
    const { reviewRepository } = await setup();
    const record = createReviewRecord("review-metadata-only", "completed");
    await reviewRepository.saveReview(record);

    const result = await reviewRepository.getReview(record.gameId);

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.record).not.toHaveProperty("payload");
      expect(result.record).not.toHaveProperty("explanation");
    }
  });
});
