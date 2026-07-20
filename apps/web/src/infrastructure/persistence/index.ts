export { BrowserWallClock } from "./browser-wall-clock";
export {
  CaissaDatabase,
  closeCaissaDatabase,
  createCaissaDatabase,
  deleteCaissaDatabase,
  openCaissaDatabase,
  type CreateCaissaDatabaseOptions,
  type DatabaseDeleteResult,
  type DatabaseOpenResult,
} from "./database";
export {
  createBrowserPersistence,
  createPersistenceRepositories,
  type CreatePersistenceRepositoriesOptions,
  type PersistenceRepositorySet,
} from "./create-persistence";
export { DexieAnalysisCacheRepository } from "./dexie-analysis-cache-repository";
export { DexieGameRepository } from "./dexie-game-repository";
export { DexiePreferencesRepository } from "./dexie-preferences-repository";
export { DexieReviewRepository } from "./dexie-review-repository";
export { CAISSA_DATABASE_VERSION } from "./schema";
export {
  ACTIVE_GAME_KEY,
  ACTIVE_GAME_RECORD_VERSION,
  ANALYSIS_CACHE_RECORD_VERSION,
  COMPLETED_GAME_RECORD_VERSION,
  PREFERENCES_KEY,
  PREFERENCES_RECORD_VERSION,
  REVIEW_RECORD_VERSION,
} from "./storage-records";
