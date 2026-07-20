import type {
  AnalysisCacheRepository,
  GameRepository,
  PreferencesRepository,
  ReviewRepository,
  WallClock,
} from "../../application/persistence";
import {
  createPersistenceConfiguration,
  type PersistenceConfiguration,
} from "../config/persistence-config";
import { BrowserWallClock } from "./browser-wall-clock";
import { createCaissaDatabase, type CaissaDatabase } from "./database";
import { DexieAnalysisCacheRepository } from "./dexie-analysis-cache-repository";
import { DexieGameRepository } from "./dexie-game-repository";
import { DexiePreferencesRepository } from "./dexie-preferences-repository";
import { DexieReviewRepository } from "./dexie-review-repository";

export interface PersistenceRepositorySet {
  readonly analysisCacheRepository: AnalysisCacheRepository;
  readonly database: CaissaDatabase;
  readonly gameRepository: GameRepository;
  readonly preferencesRepository: PreferencesRepository;
  readonly reviewRepository: ReviewRepository;
}

export interface CreatePersistenceRepositoriesOptions {
  readonly database: CaissaDatabase;
  readonly wallClock: WallClock;
}

export function createPersistenceRepositories(
  options: CreatePersistenceRepositoriesOptions,
): PersistenceRepositorySet {
  return Object.freeze({
    analysisCacheRepository: new DexieAnalysisCacheRepository(options.database, options.wallClock),
    database: options.database,
    gameRepository: new DexieGameRepository(options.database, options.wallClock),
    preferencesRepository: new DexiePreferencesRepository(options.database, options.wallClock),
    reviewRepository: new DexieReviewRepository(options.database, options.wallClock),
  });
}

/** Convenience composition root; it creates dependencies but does not open a hidden singleton. */
export function createBrowserPersistence(
  configuration: PersistenceConfiguration = createPersistenceConfiguration(),
): PersistenceRepositorySet {
  const database = createCaissaDatabase({ name: configuration.databaseName });
  return createPersistenceRepositories({ database, wallClock: new BrowserWallClock() });
}
