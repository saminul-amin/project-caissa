import type { parseGameId } from "@caissa/chess-core";
import { afterEach, describe, expect, it } from "vitest";

import { PREFERENCES_KEY, PREFERENCES_RECORD_VERSION } from "./storage-records";
import {
  createAbandonedRecord,
  createCacheEntry,
  createCheckpoint,
  createPersistenceTestContext,
  createReviewRecord,
  destroyPersistenceTestContext,
  type PersistenceTestContext,
} from "../../test/persistence-test-kit";

describe("persistence corruption boundaries", () => {
  let context: PersistenceTestContext | undefined;

  afterEach(async () => {
    if (context) await destroyPersistenceTestContext(context.database);
    context = undefined;
  });

  async function setup(): Promise<PersistenceTestContext> {
    context = await createPersistenceTestContext();
    return context;
  }

  it("reports an active storage game-ID mismatch", async () => {
    const { database, gameRepository } = await setup();
    await put(database, "activeGames", {
      checkpoint: createCheckpoint("ready", "checkpoint-id"),
      gameId: "storage-id",
      key: "active",
      recordVersion: 1,
      updatedAt: 1_000,
    });
    expect(await gameRepository.getActiveGame()).toMatchObject({
      corruption: { category: "mismatched-game-id" },
      status: "corrupted",
    });
  });

  it("reports invalid active storage timestamps", async () => {
    const { database, gameRepository } = await setup();
    const checkpoint = createCheckpoint("ready", "invalid-active-time");
    await put(database, "activeGames", {
      checkpoint,
      gameId: checkpoint.gameId,
      key: "active",
      recordVersion: 1,
      updatedAt: -1,
    });
    expect(await gameRepository.getActiveGame()).toMatchObject({
      corruption: { category: "invalid-timestamp" },
      status: "corrupted",
    });
  });

  it("reports completed record versions without deleting the game", async () => {
    const { database, gameRepository } = await setup();
    const record = createAbandonedRecord("completed-version", 2_000);
    await gameRepository.saveCompletedGame(record);
    await mutateCompleted(database, record.gameId, { recordVersion: 2 });

    expect(await gameRepository.getCompletedGame(record.gameId)).toMatchObject({
      corruption: { category: "unsupported-record-version" },
      status: "corrupted",
    });
    expect(await database.completedGames.count()).toBe(1);
  });

  it("reports invalid completed timestamps", async () => {
    const { database, gameRepository } = await setup();
    const record = createAbandonedRecord("completed-time", 2_000);
    await gameRepository.saveCompletedGame(record);
    await mutateCompleted(database, record.gameId, { completedAt: -1 });
    expect(await gameRepository.getCompletedGame(record.gameId)).toMatchObject({
      corruption: { category: "invalid-timestamp" },
      status: "corrupted",
    });
  });

  it("reports invalid completed results", async () => {
    const { database, gameRepository } = await setup();
    const record = createAbandonedRecord("completed-result", 2_000);
    await gameRepository.saveCompletedGame(record);
    await mutateCompleted(database, record.gameId, { result: { status: "invented" } });
    expect(await gameRepository.getCompletedGame(record.gameId)).toMatchObject({
      corruption: { category: "invalid-result" },
      status: "corrupted",
    });
  });

  it("reports stored completed games with missing PGN", async () => {
    const { database, gameRepository } = await setup();
    const record = createAbandonedRecord("completed-pgn", 2_000);
    await gameRepository.saveCompletedGame(record);
    await mutateCompleted(database, record.gameId, { pgn: "" });
    expect(await gameRepository.getCompletedGame(record.gameId)).toMatchObject({
      corruption: { category: "missing-pgn" },
      status: "corrupted",
    });
  });

  it("reports stored revision mismatches", async () => {
    const { database, gameRepository } = await setup();
    const record = createAbandonedRecord("completed-revision", 2_000);
    await gameRepository.saveCompletedGame(record);
    await mutateCompleted(database, record.gameId, { revision: record.checkpoint.revision + 1 });
    expect(await gameRepository.getCompletedGame(record.gameId)).toMatchObject({
      corruption: { category: "mismatched-game-id" },
      status: "corrupted",
    });
  });

  it("isolates corrupt history rows while returning valid summaries", async () => {
    const { database, gameRepository } = await setup();
    const record = createAbandonedRecord("list-valid", 2_000);
    await gameRepository.saveCompletedGame(record);
    await put(database, "completedGames", {
      gameId: "list-corrupt",
      recordVersion: 99,
    });

    const result = await gameRepository.listCompletedGames();

    expect(result.status).toBe("listed");
    if (result.status === "listed") {
      expect(result.items).toHaveLength(1);
      expect(result.corruptions).toHaveLength(1);
    }
  });

  it("rejects invalid bounded history queries", async () => {
    const { gameRepository } = await setup();
    expect(await gameRepository.listCompletedGames({ limit: 0 })).toEqual({
      reason: "invalid-query",
      status: "rejected",
    });
    expect(await gameRepository.listCompletedGames({ sort: "unknown" as never })).toEqual({
      reason: "invalid-query",
      status: "rejected",
    });
  });

  it("preserves an unrelated active slot during finalization", async () => {
    const { gameRepository } = await setup();
    await gameRepository.saveActiveGame(createCheckpoint("ready", "unrelated-active"));
    const completed = createAbandonedRecord("finalized-other", 2_000);

    expect(await gameRepository.finalizeGame(completed)).toEqual({ status: "saved" });
    const active = await gameRepository.getActiveGame();
    expect(active.status).toBe("found");
    if (active.status === "found") expect(active.checkpoint.gameId).toBe("unrelated-active");
  });

  it("rejects invalid preferences before writing", async () => {
    const { database, preferencesRepository } = await setup();
    expect(await preferencesRepository.savePreferences({ theme: "invalid" } as never)).toEqual({
      reason: "validation-failed",
      status: "rejected",
    });
    expect(await database.preferences.count()).toBe(0);
  });

  it("recovers all preferences when the stored timestamp is invalid", async () => {
    const { database, preferencesRepository } = await setup();
    await put(database, "preferences", {
      key: PREFERENCES_KEY,
      recordVersion: PREFERENCES_RECORD_VERSION,
      updatedAt: -1,
      values: {},
    });
    const result = await preferencesRepository.getPreferences();
    expect(result.status).toBe("recovered");
    if (result.status === "recovered") expect(result.recoveredFields).toHaveLength(10);
  });

  it("reports invalid review provenance and retains the metadata", async () => {
    const { database, reviewRepository } = await setup();
    const record = createReviewRecord("review-provenance");
    await reviewRepository.saveReview(record);
    const stored = await database.reviews.get(record.gameId);
    if (!stored) throw new Error("Missing review fixture.");
    await put(database, "reviews", { ...stored, provenance: [{ provider: "unknown" }] });

    expect(await reviewRepository.getReview(record.gameId)).toMatchObject({
      corruption: { category: "invalid-review-status" },
      status: "corrupted",
    });
    expect(await database.reviews.count()).toBe(1);
  });

  it("reports unsupported cache payload versions", async () => {
    const { analysisCacheRepository, database } = await setup();
    const entry = createCacheEntry();
    await putCache(database, entry, { cacheVersion: 2 });
    expect(await analysisCacheRepository.get(entry.key)).toMatchObject({
      corruption: { category: "unsupported-record-version" },
      status: "corrupted",
    });
  });

  it("reports cache expiry earlier than creation", async () => {
    const { analysisCacheRepository, database } = await setup();
    const entry = createCacheEntry();
    await putCache(database, entry, { expiresAt: 999 });
    expect(await analysisCacheRepository.get(entry.key)).toMatchObject({
      corruption: { category: "invalid-timestamp" },
      status: "corrupted",
    });
  });

  it("rejects non-JSON cache payloads and leaves games readable", async () => {
    const { analysisCacheRepository, database, gameRepository } = await setup();
    const entry = createCacheEntry();
    await putCache(database, entry, { payload: Number.NaN });
    await gameRepository.saveActiveGame(createCheckpoint("ready", "non-json-cache-game"));

    expect((await analysisCacheRepository.get(entry.key)).status).toBe("corrupted");
    expect((await gameRepository.getActiveGame()).status).toBe("found");
  });

  it("deletes one cache entry without touching games", async () => {
    const { analysisCacheRepository, gameRepository } = await setup();
    const entry = createCacheEntry();
    await analysisCacheRepository.set(entry);
    await gameRepository.saveActiveGame(createCheckpoint("ready", "cache-delete-game"));

    expect(await analysisCacheRepository.delete(entry.key)).toEqual({ status: "saved" });
    expect(await analysisCacheRepository.get(entry.key)).toEqual({ status: "miss" });
    expect((await gameRepository.getActiveGame()).status).toBe("found");
  });
});

async function put(
  database: PersistenceTestContext["database"],
  table: string,
  value: unknown,
): Promise<void> {
  await database.table<unknown, string>(table).put(value);
}

async function mutateCompleted(
  database: PersistenceTestContext["database"],
  gameId: ReturnType<typeof parseGameId>,
  changes: Readonly<Record<string, unknown>>,
): Promise<void> {
  const stored = await database.completedGames.get(gameId);
  if (!stored) throw new Error("Missing completed fixture.");
  await put(database, "completedGames", { ...stored, ...changes });
}

async function putCache(
  database: PersistenceTestContext["database"],
  entry: ReturnType<typeof createCacheEntry>,
  changes: Readonly<Record<string, unknown>>,
): Promise<void> {
  await put(database, "analysisCache", {
    analysisProfile: entry.identity.analysisProfile,
    cacheVersion: entry.cacheVersion,
    createdAt: entry.createdAt,
    engineId: entry.identity.engineId,
    engineVersion: entry.identity.engineVersion,
    identity: entry.identity,
    key: entry.key,
    payload: entry.payload,
    recordVersion: 1,
    ...changes,
  });
}
