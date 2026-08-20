import { ChessJsRulesAdapter, type ChessRulesPort } from "@caissa/chess-core";

import {
  createGameHistoryService,
  createGameStartupService,
  createNewGameService,
  createActiveGameRecoveryService,
  type AnalysisCacheRepository,
  type GameHistoryService,
  type GameIdGenerator,
  type GameRepository,
  type GameStartupService,
  type NewGameService,
  type PreferencesRepository,
  type ReviewRepository,
  type WallClock,
  type ActiveGameRecoveryService,
  type OpponentRuntime,
  type PreferencesService,
  type GameReviewService,
  createPreferencesService,
  createGameReviewService,
} from "../../application";
import { createEngineAnalysisAdapter } from "../engine";
import { BrowserGameIdGenerator } from "../identity";
import { BrowserRequestIdGenerator, createEngineOpponentRuntime } from "../opponent";
import {
  BrowserWallClock,
  closeCaissaDatabase,
  createCaissaDatabase,
  createPersistenceRepositories,
  type CreateCaissaDatabaseOptions,
} from "../persistence";
import { BrowserMonotonicClock, type MonotonicClock } from "../time";

export interface CaissaApplication {
  readonly analysisCacheRepository: AnalysisCacheRepository;
  readonly historyService: GameHistoryService;
  readonly monotonicClock: MonotonicClock;
  readonly newGameService: NewGameService;
  readonly opponentRuntime: OpponentRuntime;
  readonly preferencesService: PreferencesService;
  readonly recoveryService: ActiveGameRecoveryService;
  readonly reviewService: GameReviewService;
  readonly startupService: GameStartupService;
  close(): void;
}

export interface CreateCaissaApplicationOptions {
  readonly analysisCacheRepository: AnalysisCacheRepository;
  readonly close?: () => void;
  readonly createRules: () => ChessRulesPort;
  readonly gameIdGenerator: GameIdGenerator;
  readonly gameRepository: GameRepository;
  readonly monotonicClock: MonotonicClock;
  readonly opponentRuntime?: OpponentRuntime;
  readonly preferencesRepository: PreferencesRepository;
  readonly reviewRepository: ReviewRepository;
  readonly wallClock: WallClock;
}

export interface CreateBrowserCaissaApplicationOptions extends CreateCaissaDatabaseOptions {
  readonly databaseName?: string;
}

export function createCaissaApplication(
  options: CreateCaissaApplicationOptions,
): CaissaApplication {
  const startupService = createGameStartupService({
    createRules: options.createRules,
    gameRepository: options.gameRepository,
    wallClock: options.wallClock,
  });
  const recoveryService = createActiveGameRecoveryService({
    gameRepository: options.gameRepository,
    startupService,
  });
  const historyService = createGameHistoryService({
    gameRepository: options.gameRepository,
    reviewRepository: options.reviewRepository,
  });
  const newGameService = createNewGameService({
    createRules: options.createRules,
    gameIdGenerator: options.gameIdGenerator,
    gameRepository: options.gameRepository,
    wallClock: options.wallClock,
  });

  const preferencesService = createPreferencesService({
    preferencesRepository: options.preferencesRepository,
  });
  const reviewService = createGameReviewService({
    analysisCacheRepository: options.analysisCacheRepository,
    analysisEngine: createEngineAnalysisAdapter(),
    createRules: options.createRules,
    historyService,
    reviewRepository: options.reviewRepository,
    wallClock: options.wallClock,
  });
  const opponentRuntime =
    options.opponentRuntime ??
    createEngineOpponentRuntime({
      monotonicClock: options.monotonicClock,
      requestIdFactory: new BrowserRequestIdGenerator(),
    });

  let closed = false;
  return Object.freeze({
    analysisCacheRepository: options.analysisCacheRepository,
    close() {
      if (closed) return;
      closed = true;
      opponentRuntime.dispose();
      options.close?.();
    },
    historyService,
    monotonicClock: options.monotonicClock,
    newGameService,
    opponentRuntime,
    preferencesService,
    recoveryService,
    reviewService,
    startupService,
  });
}

export function createBrowserCaissaApplication(
  options: CreateBrowserCaissaApplicationOptions = {},
): CaissaApplication {
  const database = createCaissaDatabase({
    ...(options.IDBKeyRange ? { IDBKeyRange: options.IDBKeyRange } : {}),
    ...(options.indexedDB ? { indexedDB: options.indexedDB } : {}),
    ...(options.databaseName || options.name ? { name: options.databaseName ?? options.name } : {}),
  });
  const wallClock = new BrowserWallClock();
  const repositories = createPersistenceRepositories({ database, wallClock });

  return createCaissaApplication({
    ...repositories,
    close: () => {
      closeCaissaDatabase(database);
    },
    createRules: () => new ChessJsRulesAdapter(),
    gameIdGenerator: new BrowserGameIdGenerator(),
    monotonicClock: new BrowserMonotonicClock(),
    wallClock,
  });
}
