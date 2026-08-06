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
} from "../../application";
import { BrowserGameIdGenerator } from "../identity";
import {
  BrowserWallClock,
  closeCaissaDatabase,
  createCaissaDatabase,
  createPersistenceRepositories,
  type CreateCaissaDatabaseOptions,
} from "../persistence";
import { BrowserMonotonicClock, type MonotonicClock } from "../time";

export interface CaissaApplication {
  readonly historyService: GameHistoryService;
  readonly monotonicClock: MonotonicClock;
  readonly newGameService: NewGameService;
  readonly recoveryService: ActiveGameRecoveryService;
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

  // These adapters belong to this graph even though the current read-only slice has no actions for them.
  void options.analysisCacheRepository;
  void options.preferencesRepository;

  let closed = false;
  return Object.freeze({
    close() {
      if (closed) return;
      closed = true;
      options.close?.();
    },
    historyService,
    monotonicClock: options.monotonicClock,
    newGameService,
    recoveryService,
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
