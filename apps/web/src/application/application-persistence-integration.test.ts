import { ChessJsRulesAdapter } from "@caissa/chess-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createGameStartupService } from "./bootstrap";
import { createGameSessionCoordinator } from "./game-session";
import { CLEAR_HISTORY_CONFIRMATION, createGameHistoryService } from "./history";
import { DEFAULT_USER_PREFERENCES } from "./persistence";
import { DISCARD_ACTIVE_GAME_CONFIRMATION, createActiveGameRecoveryService } from "./recovery";
import { at, createControllerFixture } from "../test/application-service-test-kit";
import {
  createAbandonedRecord,
  createCacheEntry,
  createCheckpoint,
  createPersistenceTestContext,
  createReviewRecord,
  destroyPersistenceTestContext,
  type PersistenceTestContext,
} from "../test/persistence-test-kit";

describe("application services with Dexie adapters", () => {
  let context: PersistenceTestContext;

  beforeEach(async () => {
    context = await createPersistenceTestContext();
  });

  afterEach(async () => {
    await destroyPersistenceTestContext(context.database);
  });

  it("finalizes a completed session and atomically removes its matching active slot", async () => {
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture({ id: "integrated-finalization" }),
      gameRepository: context.gameRepository,
      wallClock: context.wallClock,
    });
    await coordinator.start(at(0));
    expect((await context.gameRepository.getActiveGame()).status).toBe("found");

    const completed = await coordinator.abandon({ now: at(1) });

    expect(completed).toMatchObject({
      persistence: { status: "finalized" },
      status: "completed",
    });
    expect((await context.gameRepository.getActiveGame()).status).toBe("not-found");
    expect(
      (await context.gameRepository.getCompletedGame(coordinator.getSession().gameId)).status,
    ).toBe("found");
  });

  it("explicit active-game discard preserves every unrelated durable collection", async () => {
    const active = createCheckpoint("ready", "integrated-discard-active");
    const completed = createAbandonedRecord("integrated-discard-history", 5_000);
    const review = createReviewRecord(completed.gameId);
    const cache = createCacheEntry();
    await context.gameRepository.saveActiveGame(active);
    await context.gameRepository.saveCompletedGame(completed);
    await context.preferencesRepository.savePreferences(DEFAULT_USER_PREFERENCES);
    await context.reviewRepository.saveReview(review);
    await context.analysisCacheRepository.set(cache);
    const startupService = createGameStartupService({
      createRules: () => new ChessJsRulesAdapter(),
      gameRepository: context.gameRepository,
      wallClock: context.wallClock,
    });

    await createActiveGameRecoveryService({
      gameRepository: context.gameRepository,
      startupService,
    }).discardActiveGame({ confirmation: DISCARD_ACTIVE_GAME_CONFIRMATION });

    expect((await context.gameRepository.getActiveGame()).status).toBe("not-found");
    expect((await context.gameRepository.getCompletedGame(completed.gameId)).status).toBe("found");
    expect((await context.preferencesRepository.getPreferences()).status).toBe("found");
    expect((await context.reviewRepository.getReview(review.gameId)).status).toBe("found");
    expect((await context.analysisCacheRepository.get(cache.key)).status).toBe("hit");
  });

  it("clear history removes games and reviews while preserving active, preferences, and cache", async () => {
    const active = createCheckpoint("ready", "integrated-clear-active");
    const completed = createAbandonedRecord("integrated-clear-history", 6_000);
    const review = createReviewRecord(completed.gameId);
    const cache = createCacheEntry();
    await context.gameRepository.saveActiveGame(active);
    await context.gameRepository.saveCompletedGame(completed);
    await context.preferencesRepository.savePreferences(DEFAULT_USER_PREFERENCES);
    await context.reviewRepository.saveReview(review);
    await context.analysisCacheRepository.set(cache);

    const result = await createGameHistoryService({
      gameRepository: context.gameRepository,
      reviewRepository: context.reviewRepository,
    }).clearHistory({ confirmation: CLEAR_HISTORY_CONFIRMATION });

    expect(result.status).toBe("cleared");
    expect((await context.gameRepository.getCompletedGame(completed.gameId)).status).toBe(
      "not-found",
    );
    expect((await context.reviewRepository.getReview(review.gameId)).status).toBe("not-found");
    expect((await context.gameRepository.getActiveGame()).status).toBe("found");
    expect((await context.preferencesRepository.getPreferences()).status).toBe("found");
    expect((await context.analysisCacheRepository.get(cache.key)).status).toBe("hit");
  });
});
