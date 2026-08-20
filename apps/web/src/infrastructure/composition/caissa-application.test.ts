import { ChessJsRulesAdapter, parseGameId, parseMonotonicTimestampMs } from "@caissa/chess-core";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_USER_PREFERENCES,
  type AnalysisCacheRepository,
  type PreferencesRepository,
} from "../../application";
import {
  MemoryGameRepository,
  MemoryReviewRepository,
} from "../../test/application-service-test-kit";
import { FixedWallClock } from "../../test/persistence-test-kit";
import { createBrowserCaissaApplication, createCaissaApplication } from "./caissa-application";

const preferencesRepository: PreferencesRepository = {
  getPreferences: () =>
    Promise.resolve({ preferences: DEFAULT_USER_PREFERENCES, status: "default" }),
  resetPreferences: () => Promise.resolve({ status: "saved" }),
  savePreferences: () => Promise.resolve({ status: "saved" }),
};

const analysisCacheRepository: AnalysisCacheRepository = {
  clear: () => Promise.resolve({ status: "saved" }),
  delete: () => Promise.resolve({ status: "saved" }),
  deleteExpired: () => Promise.resolve({ deletedCount: 0, status: "cleaned" }),
  get: () => Promise.resolve({ status: "miss" }),
  set: () => Promise.resolve({ status: "saved" }),
};

describe("application composition", () => {
  it("constructs the required services from injected ports without exposing repositories", () => {
    const close = vi.fn();
    const app = createCaissaApplication({
      analysisCacheRepository,
      close,
      createRules: () => new ChessJsRulesAdapter(),
      gameIdGenerator: { create: () => parseGameId("composition-game") },
      gameRepository: new MemoryGameRepository(),
      monotonicClock: { now: () => parseMonotonicTimestampMs(10) },
      preferencesRepository,
      reviewRepository: new MemoryReviewRepository(),
      wallClock: new FixedWallClock(),
    });
    expect(app.startupService).toBeDefined();
    expect(app.recoveryService).toBeDefined();
    expect(app.historyService).toBeDefined();
    expect(app.newGameService).toBeDefined();
    expect("database" in app).toBe(false);
    expect("repositories" in app).toBe(false);
    app.close();
    app.close();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("creates one independent browser database graph per application instance", async () => {
    const indexedDB = new IDBFactory();
    const first = createBrowserCaissaApplication({
      IDBKeyRange,
      databaseName: "composition-browser-first",
      indexedDB,
    });
    const second = createBrowserCaissaApplication({
      IDBKeyRange,
      databaseName: "composition-browser-second",
      indexedDB,
    });
    expect(first).not.toBe(second);
    expect(first.startupService).not.toBe(second.startupService);
    expect(
      await first.newGameService.createGame({
        setup: {
          allowUndo: true,
          mode: "local-human-vs-human",
          opponentProfileId: "club",
          orientation: "white",
          timeControlId: "untimed",
        },
      }),
    ).toMatchObject({ status: "created" });
    first.close();
    second.close();
  });

  it("supports the database-name alias and optional cleanup", () => {
    const indexedDB = new IDBFactory();
    const alias = createBrowserCaissaApplication({
      IDBKeyRange,
      indexedDB,
      name: "composition-alias",
    });
    alias.close();

    const withoutCleanup = createCaissaApplication({
      analysisCacheRepository,
      createRules: () => new ChessJsRulesAdapter(),
      gameIdGenerator: { create: () => parseGameId("composition-without-cleanup") },
      gameRepository: new MemoryGameRepository(),
      monotonicClock: { now: () => parseMonotonicTimestampMs(10) },
      preferencesRepository,
      reviewRepository: new MemoryReviewRepository(),
      wallClock: new FixedWallClock(),
    });
    expect(() => {
      withoutCleanup.close();
    }).not.toThrow();
  });

  it("uses platform IndexedDB defaults when no browser overrides are supplied", () => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("IDBKeyRange", IDBKeyRange);
    try {
      const application = createBrowserCaissaApplication();
      application.close();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
