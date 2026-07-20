import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseEpochTimestampMs } from "../../application/persistence";
import { CAISSA_DATABASE_NAME, createPersistenceConfiguration } from "../config/persistence-config";
import { BrowserWallClock } from "./browser-wall-clock";
import { createBrowserPersistence, createCaissaDatabase } from "./index";
import { mapPersistenceError, mapTransactionError } from "./error-mapper";

describe("persistence composition boundaries", () => {
  const databases = [] as ReturnType<typeof createCaissaDatabase>[];

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const database of databases) {
      if (database.isOpen()) await database.delete();
      else database.close();
    }
    databases.length = 0;
  });

  it("uses one explicit production database name", () => {
    expect(createPersistenceConfiguration()).toEqual({ databaseName: CAISSA_DATABASE_NAME });
    expect(createPersistenceConfiguration(" isolated ")).toEqual({ databaseName: "isolated" });
  });

  it("rejects empty and unbounded database names", () => {
    expect(() => createPersistenceConfiguration(" ")).toThrow("database name");
    expect(() => createPersistenceConfiguration("x".repeat(129))).toThrow("database name");
  });

  it("isolates the ambient Date.now call in BrowserWallClock", () => {
    vi.spyOn(Date, "now").mockReturnValue(42_000);
    expect(new BrowserWallClock().nowEpochMs()).toBe(parseEpochTimestampMs(42_000));
  });

  it("creates repository sets without a hidden database singleton", () => {
    const first = createBrowserPersistence({ databaseName: "factory-first" });
    const second = createBrowserPersistence({ databaseName: "factory-second" });
    databases.push(first.database, second.database);

    expect(first.database).not.toBe(second.database);
    expect(first.gameRepository).not.toBe(second.gameRepository);
  });

  it("accepts injected IndexedDB implementations", async () => {
    const database = createCaissaDatabase({
      IDBKeyRange,
      indexedDB: new IDBFactory(),
      name: "injected-indexeddb",
    });
    databases.push(database);
    await database.open();
    expect(database.isOpen()).toBe(true);
  });

  it("maps transaction and unknown failures to stable safe categories", () => {
    expect(mapPersistenceError(new DOMException("aborted", "AbortError"), "transaction")).toEqual({
      code: "transaction-failed",
      operation: "transaction",
      retryable: true,
    });
    expect(mapPersistenceError("raw failure", "unknown")).toEqual({
      code: "unknown-storage-error",
      operation: "unknown",
      retryable: true,
    });
    expect(mapTransactionError(new Error("internal"), "transaction.write")).toEqual({
      code: "transaction-failed",
      operation: "transaction.write",
      retryable: true,
    });
  });
});
