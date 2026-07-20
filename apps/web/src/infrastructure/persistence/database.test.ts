import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { parseEpochTimestampMs } from "../../application/persistence";
import {
  CAISSA_DATABASE_VERSION,
  closeCaissaDatabase,
  createCaissaDatabase,
  createPersistenceRepositories,
  deleteCaissaDatabase,
  openCaissaDatabase,
  type CaissaDatabase,
} from "./index";
import { mapPersistenceError } from "./error-mapper";
import { migrateToVersionOne } from "./migrations";
import {
  createAbandonedRecord,
  createCacheEntry,
  createCheckpoint,
  FixedWallClock,
} from "../../test/persistence-test-kit";

describe("CaissaDatabase Version 1", () => {
  const databases: CaissaDatabase[] = [];

  afterEach(async () => {
    for (const database of databases) await database.delete();
    databases.length = 0;
  });

  function create(name: string, factory = new IDBFactory()): CaissaDatabase {
    const database = createCaissaDatabase({
      IDBKeyRange,
      indexedDB: factory,
      name,
    });
    databases.push(database);
    return database;
  }

  it("creates all five explicit Version 1 tables", async () => {
    const database = create("schema-tables");
    await database.open();

    expect(database.tables.map((table) => table.name).sort()).toEqual([
      "activeGames",
      "analysisCache",
      "completedGames",
      "preferences",
      "reviews",
    ]);
    expect(database.verno).toBe(CAISSA_DATABASE_VERSION);
  });

  it("creates only the required Version 1 indexes", async () => {
    const database = create("schema-indexes");
    await database.open();

    expect(indexNames(database, "activeGames")).toEqual(["gameId", "updatedAt"]);
    expect(indexNames(database, "completedGames")).toEqual([
      "completedAt",
      "resultType",
      "whiteParticipantKind",
      "blackParticipantKind",
      "[completedAt+gameId]",
    ]);
    expect(indexNames(database, "reviews")).toEqual(["status", "updatedAt"]);
  });

  it("closes and explicitly reopens a database", async () => {
    const database = create("close-reopen");
    expect((await openCaissaDatabase(database)).status).toBe("opened");
    closeCaissaDatabase(database);

    expect((await openCaissaDatabase(database)).status).toBe("opened");
    expect(database.isOpen()).toBe(true);
  });

  it("keeps isolated test factories from sharing data", async () => {
    const first = create("same-name", new IDBFactory());
    const second = create("same-name", new IDBFactory());
    await first.open();
    await second.open();
    await first.activeGames.put({
      checkpoint: createCheckpoint("ready", "isolated"),
      gameId: "isolated",
      key: "active",
      recordVersion: 1,
      updatedAt: 1_000,
    });

    expect(await first.activeGames.count()).toBe(1);
    expect(await second.activeGames.count()).toBe(0);
  });

  it("deletes an isolated development/test database", async () => {
    const factory = new IDBFactory();
    const first = create("delete-database", factory);
    await first.open();
    await first.preferences.put({
      key: "preferences",
      recordVersion: 1,
      updatedAt: 1_000,
      values: {},
    });

    expect(await deleteCaissaDatabase(first, "test")).toEqual({ status: "deleted" });
    databases.splice(databases.indexOf(first), 1);
    const second = create("delete-database", factory);
    await second.open();
    expect(await second.preferences.count()).toBe(0);
  });

  it("preserves Version 1 records across close and reopen", async () => {
    const database = create("record-reopen");
    await database.open();
    const repositories = createPersistenceRepositories({
      database,
      wallClock: new FixedWallClock(),
    });
    await repositories.gameRepository.saveActiveGame(createCheckpoint("paused", "reopen-game"));
    database.close();
    await database.open();

    expect((await repositories.gameRepository.getActiveGame()).status).toBe("found");
  });

  it("maps a migration/open failure without leaking the raw error", () => {
    const mapped = mapPersistenceError({ name: "OpenFailedError", payload: "raw" }, "migration.v1");
    expect(mapped).toEqual({
      code: "storage-unavailable",
      operation: "migration.v1",
      retryable: true,
    });
    expect(mapped).not.toHaveProperty("payload");
  });

  it("keeps the Version 1 migration seam idempotent", () => {
    expect(() => {
      migrateToVersionOne({ version: 0 });
      migrateToVersionOne({ version: 1 });
    }).not.toThrow();
  });

  it("maps quota-style browser errors safely", () => {
    expect(mapPersistenceError({ name: "QuotaExceededError" }, "active-game.save")).toEqual({
      code: "quota-exceeded",
      operation: "active-game.save",
      retryable: true,
    });
  });

  it("keeps active-game deletion independent from completed history", async () => {
    const database = create("active-independent");
    await database.open();
    const repositories = createPersistenceRepositories({
      database,
      wallClock: new FixedWallClock(parseEpochTimestampMs(5_000)),
    });
    const completed = createAbandonedRecord("completed-preserved", 2_000);
    await repositories.gameRepository.saveCompletedGame(completed);
    await repositories.gameRepository.saveActiveGame(createCheckpoint("ready", "active-cleared"));

    await repositories.gameRepository.clearActiveGame();

    expect((await repositories.gameRepository.getCompletedGame(completed.gameId)).status).toBe(
      "found",
    );
  });

  it("keeps cache clearing independent from completed and active games", async () => {
    const database = create("cache-independent");
    await database.open();
    const repositories = createPersistenceRepositories({
      database,
      wallClock: new FixedWallClock(),
    });
    const completed = createAbandonedRecord("cache-completed", 2_000);
    await repositories.gameRepository.saveCompletedGame(completed);
    await repositories.gameRepository.saveActiveGame(createCheckpoint("ready", "cache-active"));
    await repositories.analysisCacheRepository.set(createCacheEntry());

    await repositories.analysisCacheRepository.clear();

    expect((await repositories.gameRepository.getActiveGame()).status).toBe("found");
    expect((await repositories.gameRepository.getCompletedGame(completed.gameId)).status).toBe(
      "found",
    );
  });
});

function indexNames(database: CaissaDatabase, tableName: string): readonly string[] {
  return database.table(tableName).schema.indexes.map((index) => index.name);
}
