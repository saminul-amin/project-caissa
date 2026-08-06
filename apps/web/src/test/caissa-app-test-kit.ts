import {
  ChessJsRulesAdapter,
  parseGameId,
  parseMonotonicTimestampMs,
  type ChessRulesPort,
} from "@caissa/chess-core";

import {
  DEFAULT_USER_PREFERENCES,
  type AnalysisCacheRepository,
  type PreferencesRepository,
} from "../application";
import { createCaissaApplication, type CaissaApplication } from "../infrastructure/composition";
import { MemoryGameRepository, MemoryReviewRepository } from "./application-service-test-kit";
import { FixedWallClock } from "./persistence-test-kit";

let gameSequence = 0;

export interface TestApplicationContext {
  readonly application: CaissaApplication;
  readonly gameRepository: MemoryGameRepository;
  readonly reviewRepository: MemoryReviewRepository;
}

export interface TestApplicationOptions {
  readonly createRules?: () => ChessRulesPort;
}

export function createTestApplication(
  gameRepository = new MemoryGameRepository(),
  options: TestApplicationOptions = {},
): TestApplicationContext {
  const reviewRepository = new MemoryReviewRepository();
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
  const application = createCaissaApplication({
    analysisCacheRepository,
    createRules: options.createRules ?? (() => new ChessJsRulesAdapter()),
    gameIdGenerator: {
      create: () => {
        gameSequence += 1;
        return parseGameId(`ui-game-${String(gameSequence)}`);
      },
    },
    gameRepository,
    monotonicClock: { now: () => parseMonotonicTimestampMs(1_000) },
    preferencesRepository,
    reviewRepository,
    wallClock: new FixedWallClock(),
  });
  return { application, gameRepository, reviewRepository };
}
