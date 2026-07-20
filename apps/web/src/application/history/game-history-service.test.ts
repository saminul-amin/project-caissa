import { parseGameId } from "@caissa/chess-core";
import { beforeEach, describe, expect, it } from "vitest";

import {
  MemoryGameRepository,
  MemoryReviewRepository,
  retryableStorageError,
} from "../../test/application-service-test-kit";
import {
  createAbandonedRecord,
  createCheckmateRecord,
  createReviewRecord,
} from "../../test/persistence-test-kit";
import { createGameHistoryService } from "./game-history-service";
import {
  CLEAR_HISTORY_CONFIRMATION,
  DELETE_COMPLETED_GAME_CONFIRMATION,
} from "./game-history-types";

describe("GameHistoryService reads", () => {
  let games: MemoryGameRepository;
  let reviews: MemoryReviewRepository;

  beforeEach(() => {
    games = new MemoryGameRepository();
    reviews = new MemoryReviewRepository();
  });

  it("lists completed games as immutable application read models", async () => {
    const first = createAbandonedRecord("history-first", 1_000);
    const second = createCheckmateRecord("history-second", 2_000);
    games.completed.set(first.gameId, first);
    games.completed.set(second.gameId, second);

    const result = await create(games, reviews).listGames();

    expect(result.status).toBe("listed");
    if (result.status !== "listed") return;
    expect(result.items.map((item) => item.gameId)).toEqual([first.gameId, second.gameId]);
    expect(Object.isFrozen(result.items)).toBe(true);
    expect(Object.isFrozen(result.items[0])).toBe(true);
  });

  it("preserves repository pagination and cursor metadata", async () => {
    const record = createAbandonedRecord("history-page", 3_000);
    const cursor = Object.freeze({ completedAt: record.completedAt, gameId: record.gameId });
    games.listImplementation = () => ({
      corruptions: Object.freeze([]),
      items: Object.freeze([
        {
          completedAt: record.completedAt,
          gameId: record.gameId,
          moveCount: 0,
          participants: record.checkpoint.configuration.participants,
          result: record.result,
          revision: record.checkpoint.revision,
          timeControl: record.checkpoint.configuration.timeControl,
        },
      ]),
      nextCursor: cursor,
      status: "listed",
    });

    const result = await create(games, reviews).listGames({ limit: 1 });

    expect(result).toMatchObject({ nextCursor: cursor, status: "listed" });
  });

  it("excludes full PGN, checkpoint, and move history from list items", async () => {
    const record = createCheckmateRecord("history-summary", 3_000);
    games.completed.set(record.gameId, record);

    const result = await create(games, reviews).listGames();

    expect(result.status).toBe("listed");
    if (result.status !== "listed") return;
    expect(result.items[0]).not.toHaveProperty("pgn");
    expect(result.items[0]).not.toHaveProperty("checkpoint");
    expect(result.items[0]).not.toHaveProperty("history");
  });

  it("includes review availability when metadata exists", async () => {
    const record = createAbandonedRecord("history-review", 3_000);
    games.completed.set(record.gameId, record);
    reviews.records.set(record.gameId, createReviewRecord(record.gameId, "partial"));

    const result = await create(games, reviews).listGames();

    expect(result.status).toBe("listed");
    if (result.status !== "listed") return;
    expect(result.items[0]?.review).toEqual({ reviewStatus: "partial", status: "available" });
  });

  it("marks review metadata unavailable without failing the authoritative history list", async () => {
    const record = createAbandonedRecord("history-review-failure", 3_000);
    games.completed.set(record.gameId, record);
    reviews.getImplementation = () => ({ error: retryableStorageError, status: "failed" });

    const result = await create(games, reviews).listGames();

    expect(result.status).toBe("listed");
    if (result.status !== "listed") return;
    expect(result.items[0]?.review.status).toBe("unavailable");
  });

  it("preserves safe corruption metadata from a list result", async () => {
    games.listImplementation = () => ({
      corruptions: Object.freeze([
        {
          category: "invalid-result",
          rawRecoveryMayBePossible: true,
          recordKey: "history-corrupt",
          recordType: "completed-game",
        },
      ]),
      items: Object.freeze([]),
      status: "listed",
    });

    const result = await create(games, reviews).listGames();

    expect(result).toMatchObject({
      corruptions: [{ category: "invalid-result" }],
      status: "listed",
    });
  });

  it("maps an invalid repository query result without inventing storage failure", async () => {
    games.listImplementation = () => ({ reason: "invalid-query", status: "rejected" });

    await expect(create(games, reviews).listGames()).resolves.toEqual({
      reason: "invalid-query",
      status: "rejected",
    });
  });

  it("returns completed-game detail with authoritative PGN and checkpoint", async () => {
    const record = createCheckmateRecord("history-detail", 4_000);
    games.completed.set(record.gameId, record);

    const result = await create(games, reviews).getGame(record.gameId);

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.pgn).toBe(record.pgn);
    expect(result.detail.checkpoint).toBe(record.checkpoint);
    expect(result.detail.summary).not.toHaveProperty("pgn");
  });

  it("includes optional review metadata in history detail", async () => {
    const record = createAbandonedRecord("history-detail-review", 4_000);
    const review = createReviewRecord(record.gameId, "completed");
    games.completed.set(record.gameId, record);
    reviews.records.set(record.gameId, review);

    const result = await create(games, reviews).getGame(record.gameId);

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.review).toBe(review);
  });

  it("keeps authoritative detail available when optional review lookup fails", async () => {
    const record = createAbandonedRecord("history-detail-review-failure", 4_000);
    games.completed.set(record.gameId, record);
    reviews.getImplementation = () => ({ error: retryableStorageError, status: "failed" });

    const result = await create(games, reviews).getGame(record.gameId);

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.detail.review).toBeUndefined();
    expect(result.detail.pgn).toBe(record.pgn);
  });

  it("returns not-found for a missing completed game", async () => {
    await expect(create(games, reviews).getGame(parseGameId("missing-history"))).resolves.toEqual({
      status: "not-found",
    });
  });

  it("reports a corrupted completed game without deleting it", async () => {
    games.getCompletedImplementation = () => ({
      corruption: {
        category: "missing-pgn",
        rawRecoveryMayBePossible: true,
        recordKey: "corrupt-history",
        recordType: "completed-game",
      },
      status: "corrupted",
    });

    const result = await create(games, reviews).getGame(parseGameId("corrupt-history"));

    expect(result).toMatchObject({ corruption: { category: "missing-pgn" }, status: "corrupted" });
    expect(games.calls).toEqual(["get-completed"]);
  });

  it("returns immutable detail data", async () => {
    const record = createAbandonedRecord("history-immutable", 4_000);
    games.completed.set(record.gameId, record);

    const result = await create(games, reviews).getGame(record.gameId);

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(Object.isFrozen(result.detail)).toBe(true);
    expect(Object.isFrozen(result.detail.summary)).toBe(true);
    expect(Object.isFrozen(result.detail.summary.participants)).toBe(true);
  });
});

describe("GameHistoryService PGN export", () => {
  it("creates a plain authoritative PGN export descriptor", async () => {
    const games = new MemoryGameRepository();
    const record = createCheckmateRecord("export-game", 5_000);
    games.completed.set(record.gameId, record);

    const result = await create(games, new MemoryReviewRepository()).createPgnExport(record.gameId);

    expect(result).toEqual({
      descriptor: {
        content: record.pgn,
        filename: "caissa-5000-export-game.pgn",
        mimeType: "application/x-chess-pgn",
      },
      status: "ready",
    });
  });

  it("sanitizes filename characters while retaining a safe game identity", async () => {
    const games = new MemoryGameRepository();
    const record = createAbandonedRecord("export:unsafe:name", 5_001);
    games.completed.set(record.gameId, record);

    const result = await create(games, new MemoryReviewRepository()).createPgnExport(record.gameId);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.descriptor.filename).toBe("caissa-5001-export-unsafe-name.pgn");
    expect(result.descriptor).not.toHaveProperty("blob");
    expect(result.descriptor).not.toHaveProperty("url");
  });

  it("maps missing and corrupted exports explicitly", async () => {
    const games = new MemoryGameRepository();
    const service = create(games, new MemoryReviewRepository());
    await expect(service.createPgnExport(parseGameId("missing-export"))).resolves.toEqual({
      status: "not-found",
    });
    games.getCompletedImplementation = () => ({
      corruption: {
        category: "missing-pgn",
        rawRecoveryMayBePossible: true,
        recordKey: "corrupt-export",
        recordType: "completed-game",
      },
      status: "corrupted",
    });
    await expect(service.createPgnExport(parseGameId("corrupt-export"))).resolves.toMatchObject({
      status: "corrupted",
    });
  });
});

describe("GameHistoryService deletion and cleanup", () => {
  it("requires typed confirmation before deleting a game", async () => {
    const games = new MemoryGameRepository();

    const result = await create(games, new MemoryReviewRepository()).deleteGame({
      confirmation: "yes",
      gameId: parseGameId("delete-unconfirmed"),
    } as never);

    expect(result).toEqual({ reason: "confirmation-required", status: "rejected" });
    expect(games.calls).toEqual([]);
  });

  it("deletes the authoritative game then its matching review", async () => {
    const games = new MemoryGameRepository();
    const reviews = new MemoryReviewRepository();
    const record = createAbandonedRecord("delete-history", 6_000);
    games.completed.set(record.gameId, record);
    reviews.records.set(record.gameId, createReviewRecord(record.gameId));

    const result = await create(games, reviews).deleteGame({
      confirmation: DELETE_COMPLETED_GAME_CONFIRMATION,
      gameId: record.gameId,
    });

    expect(result.status).toBe("deleted");
    expect(games.completed.has(record.gameId)).toBe(false);
    expect(reviews.records.has(record.gameId)).toBe(false);
    expect(games.calls).toEqual(["delete-completed"]);
    expect(reviews.calls).toEqual(["delete-review"]);
  });

  it("treats an absent review as successful cleanup", async () => {
    const games = new MemoryGameRepository();
    const record = createAbandonedRecord("delete-no-review", 6_000);
    games.completed.set(record.gameId, record);

    const result = await create(games, new MemoryReviewRepository()).deleteGame({
      confirmation: DELETE_COMPLETED_GAME_CONFIRMATION,
      gameId: record.gameId,
    });

    expect(result.status).toBe("deleted");
  });

  it("reports review cleanup failure without restoring the deleted game", async () => {
    const games = new MemoryGameRepository();
    const reviews = new MemoryReviewRepository();
    const record = createAbandonedRecord("delete-warning", 6_000);
    games.completed.set(record.gameId, record);
    reviews.deleteImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });

    const result = await create(games, reviews).deleteGame({
      confirmation: DELETE_COMPLETED_GAME_CONFIRMATION,
      gameId: record.gameId,
    });

    expect(result).toMatchObject({
      status: "deleted-with-cleanup-warning",
      warning: { resource: "review-metadata" },
    });
    expect(games.completed.has(record.gameId)).toBe(false);
  });

  it("reports a rejected review cleanup as an explicit warning", async () => {
    const games = new MemoryGameRepository();
    const reviews = new MemoryReviewRepository();
    reviews.deleteImplementation = () => ({
      reason: "validation-failed",
      status: "rejected",
    });

    const result = await create(games, reviews).deleteGame({
      confirmation: DELETE_COMPLETED_GAME_CONFIRMATION,
      gameId: parseGameId("delete-review-rejected"),
    });

    expect(result).toMatchObject({
      status: "deleted-with-cleanup-warning",
      warning: { error: { code: "validation-failed", retryable: false } },
    });
  });

  it("does not affect the active game or analysis cache while deleting history", async () => {
    const games = new MemoryGameRepository();
    const record = createAbandonedRecord("delete-isolated", 6_000);
    games.completed.set(record.gameId, record);
    games.active = record.checkpoint;

    await create(games, new MemoryReviewRepository()).deleteGame({
      confirmation: DELETE_COMPLETED_GAME_CONFIRMATION,
      gameId: record.gameId,
    });

    expect(games.active).toBe(record.checkpoint);
    expect(games.calls).not.toContain("clear-active");
  });

  it("does not attempt optional cleanup when authoritative deletion fails", async () => {
    const games = new MemoryGameRepository();
    const reviews = new MemoryReviewRepository();
    games.deleteImplementation = () => ({ error: retryableStorageError, status: "failed" });

    const result = await create(games, reviews).deleteGame({
      confirmation: DELETE_COMPLETED_GAME_CONFIRMATION,
      gameId: parseGameId("delete-failed"),
    });

    expect(result.status).toBe("storage-unavailable");
    expect(reviews.calls).toEqual([]);
  });

  it("requires typed confirmation before clearing history", async () => {
    const games = new MemoryGameRepository();

    const result = await create(games, new MemoryReviewRepository()).clearHistory({
      confirmation: "clear",
    } as never);

    expect(result.status).toBe("rejected");
    expect(games.calls).toEqual([]);
  });

  it("clears completed games and review metadata", async () => {
    const games = new MemoryGameRepository();
    const reviews = new MemoryReviewRepository();
    const record = createAbandonedRecord("clear-history", 7_000);
    games.completed.set(record.gameId, record);
    reviews.records.set(record.gameId, createReviewRecord(record.gameId));

    const result = await create(games, reviews).clearHistory({
      confirmation: CLEAR_HISTORY_CONFIRMATION,
    });

    expect(result.status).toBe("cleared");
    expect(games.completed.size).toBe(0);
    expect(reviews.records.size).toBe(0);
  });

  it("reports optional review cleanup failure after authoritative history clear", async () => {
    const games = new MemoryGameRepository();
    const reviews = new MemoryReviewRepository();
    reviews.clearImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });

    const result = await create(games, reviews).clearHistory({
      confirmation: CLEAR_HISTORY_CONFIRMATION,
    });

    expect(result).toMatchObject({ status: "cleared-with-cleanup-warning" });
  });

  it("does not clear reviews when authoritative history clear fails", async () => {
    const games = new MemoryGameRepository();
    const reviews = new MemoryReviewRepository();
    games.clearCompletedImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });

    const result = await create(games, reviews).clearHistory({
      confirmation: CLEAR_HISTORY_CONFIRMATION,
    });

    expect(result.status).toBe("storage-unavailable");
    expect(reviews.calls).toEqual([]);
  });

  it("preserves active games, preferences, and analysis cache during history clear", async () => {
    const games = new MemoryGameRepository();
    const active = createAbandonedRecord("clear-isolated", 7_000).checkpoint;
    games.active = active;

    await create(games, new MemoryReviewRepository()).clearHistory({
      confirmation: CLEAR_HISTORY_CONFIRMATION,
    });

    expect(games.active).toBe(active);
    expect(games.calls).toEqual(["clear-completed"]);
  });

  it("maps storage errors and thrown values without leaking raw details", async () => {
    const games = new MemoryGameRepository();
    games.listImplementation = () => Promise.reject(new Error("private storage detail"));

    const result = await create(games, new MemoryReviewRepository()).listGames();

    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).not.toContain("private storage detail");
  });
});

function create(games: MemoryGameRepository, reviews: MemoryReviewRepository) {
  return createGameHistoryService({ gameRepository: games, reviewRepository: reviews });
}
