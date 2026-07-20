import { afterEach, describe, expect, it } from "vitest";

import {
  createAnalysisCacheKey,
  parseEpochTimestampMs,
  type AnalysisCacheEntry,
} from "../../application/persistence";
import { ANALYSIS_CACHE_RECORD_VERSION } from "./storage-records";
import {
  createCacheEntry,
  createCheckpoint,
  createPersistenceTestContext,
  destroyPersistenceTestContext,
  type PersistenceTestContext,
} from "../../test/persistence-test-kit";

describe("DexieAnalysisCacheRepository", () => {
  let context: PersistenceTestContext | undefined;

  afterEach(async () => {
    if (context) await destroyPersistenceTestContext(context.database);
    context = undefined;
  });

  async function setup(): Promise<PersistenceTestContext> {
    context = await createPersistenceTestContext();
    return context;
  }

  it("returns a cache miss for an unknown key", async () => {
    const { analysisCacheRepository } = await setup();
    const entry = createCacheEntry();
    expect(await analysisCacheRepository.get(entry.key)).toEqual({ status: "miss" });
  });

  it("returns a validated cache hit", async () => {
    const { analysisCacheRepository } = await setup();
    const entry = createCacheEntry({ expiresAt: 5_000 });
    await analysisCacheRepository.set(entry);

    const result = await analysisCacheRepository.get(entry.key);

    expect(result.status).toBe("hit");
    if (result.status === "hit") expect(result.entry).toEqual(entry);
  });

  it("writes a versioned cache entry", async () => {
    const { analysisCacheRepository, database } = await setup();
    const entry = createCacheEntry();

    expect(await analysisCacheRepository.set(entry)).toEqual({ status: "saved" });
    expect(await database.analysisCache.count()).toBe(1);
  });

  it("overwrites an identical key", async () => {
    const { analysisCacheRepository } = await setup();
    const first = createCacheEntry({ payload: { value: 1 } });
    const second = createCacheEntry({ payload: { value: 2 } });
    await analysisCacheRepository.set(first);
    await analysisCacheRepository.set(second);

    const result = await analysisCacheRepository.get(first.key);

    expect(result.status).toBe("hit");
    if (result.status === "hit") expect(result.entry.payload).toEqual({ value: 2 });
  });

  it("returns expired at the exact expiry boundary", async () => {
    const { analysisCacheRepository, wallClock } = await setup();
    const entry = createCacheEntry({ expiresAt: 2_000 });
    await analysisCacheRepository.set(entry);
    wallClock.set(2_000);

    expect(await analysisCacheRepository.get(entry.key)).toEqual({
      expiredAt: parseEpochTimestampMs(2_000),
      status: "expired",
    });
  });

  it("lazily deletes an expired entry after reporting it", async () => {
    const { analysisCacheRepository, database, wallClock } = await setup();
    const entry = createCacheEntry({ expiresAt: 1_500 });
    await analysisCacheRepository.set(entry);
    wallClock.set(2_000);

    await analysisCacheRepository.get(entry.key);

    expect(await database.analysisCache.count()).toBe(0);
  });

  it("bulk-deletes only expired entries", async () => {
    const { analysisCacheRepository, database } = await setup();
    await analysisCacheRepository.set(
      createCacheEntry({ analysisProfile: "expired-a", expiresAt: 1_500 }),
    );
    await analysisCacheRepository.set(
      createCacheEntry({ analysisProfile: "expired-b", expiresAt: 2_000 }),
    );
    await analysisCacheRepository.set(
      createCacheEntry({ analysisProfile: "fresh", expiresAt: 3_000 }),
    );

    expect(await analysisCacheRepository.deleteExpired(parseEpochTimestampMs(2_000))).toEqual({
      deletedCount: 2,
      status: "cleaned",
    });
    expect(await database.analysisCache.count()).toBe(1);
  });

  it("isolates a corrupted cache record behind safe metadata", async () => {
    const { analysisCacheRepository, database } = await setup();
    const entry = createCacheEntry();
    await putRawCache(database, entry, { payload: undefined });

    expect(await analysisCacheRepository.get(entry.key)).toMatchObject({
      corruption: { recordType: "analysis-cache" },
      status: "corrupted",
    });
  });

  it("keeps corrupted cache data from affecting authoritative game records", async () => {
    const { analysisCacheRepository, database, gameRepository } = await setup();
    const checkpoint = createCheckpoint("ready", "cache-isolation-game");
    await gameRepository.saveActiveGame(checkpoint);
    const entry = createCacheEntry();
    await putRawCache(database, entry, { payload: undefined });

    expect((await analysisCacheRepository.get(entry.key)).status).toBe("corrupted");

    expect((await gameRepository.getActiveGame()).status).toBe("found");
  });

  it("changes cache identity when the engine version changes", () => {
    const first = createCacheEntry({ engineVersion: "1.0.0" });
    const second = createCacheEntry({ engineVersion: "2.0.0" });
    expect(first.key).not.toBe(second.key);
  });

  it("changes cache identity when the analysis profile changes", () => {
    const first = createCacheEntry({ analysisProfile: "quick" });
    const second = createCacheEntry({ analysisProfile: "deep" });
    expect(first.key).not.toBe(second.key);
  });

  it("clears cache without deleting games", async () => {
    const { analysisCacheRepository, gameRepository } = await setup();
    await analysisCacheRepository.set(createCacheEntry());
    await gameRepository.saveActiveGame(createCheckpoint("ready", "clear-cache-game"));

    expect(await analysisCacheRepository.clear()).toEqual({ status: "saved" });
    expect((await gameRepository.getActiveGame()).status).toBe("found");
  });

  it("validates cache record versions", async () => {
    const { analysisCacheRepository, database } = await setup();
    const entry = createCacheEntry();
    await putRawCache(database, entry, { recordVersion: 99 });

    expect(await analysisCacheRepository.get(entry.key)).toMatchObject({
      corruption: { category: "unsupported-record-version" },
      status: "corrupted",
    });
  });

  it("isolates stored cache payloads from caller mutation", async () => {
    const { analysisCacheRepository } = await setup();
    const payload = { nested: { score: 1 } };
    const entry = createCacheEntry({ payload });
    await analysisCacheRepository.set(entry);
    payload.nested.score = 99;

    const result = await analysisCacheRepository.get(entry.key);

    expect(result.status).toBe("hit");
    if (result.status === "hit") expect(result.entry.payload).toEqual({ nested: { score: 1 } });
  });

  it("rejects a key that does not match its complete identity", async () => {
    const { analysisCacheRepository } = await setup();
    const entry = createCacheEntry();
    const changedIdentity = { ...entry.identity, analysisProfile: "changed" };
    const forged = { ...entry, identity: changedIdentity } as AnalysisCacheEntry;

    expect(await analysisCacheRepository.set(forged)).toEqual({
      reason: "validation-failed",
      status: "rejected",
    });
    expect(createAnalysisCacheKey(changedIdentity)).not.toBe(entry.key);
  });
});

async function putRawCache(
  database: PersistenceTestContext["database"],
  entry: AnalysisCacheEntry,
  changes: Readonly<Record<string, unknown>>,
): Promise<void> {
  await database.table<unknown, string>("analysisCache").put({
    analysisProfile: entry.identity.analysisProfile,
    cacheVersion: entry.cacheVersion,
    createdAt: entry.createdAt,
    engineId: entry.identity.engineId,
    engineVersion: entry.identity.engineVersion,
    identity: entry.identity,
    key: entry.key,
    payload: entry.payload,
    recordVersion: ANALYSIS_CACHE_RECORD_VERSION,
    ...changes,
  });
}
