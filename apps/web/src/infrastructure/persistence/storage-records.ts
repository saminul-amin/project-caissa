export const ACTIVE_GAME_RECORD_VERSION = 1 as const;
export const COMPLETED_GAME_RECORD_VERSION = 1 as const;
export const PREFERENCES_RECORD_VERSION = 1 as const;
export const REVIEW_RECORD_VERSION = 1 as const;
export const ANALYSIS_CACHE_RECORD_VERSION = 1 as const;

export const ACTIVE_GAME_KEY = "active" as const;
export const PREFERENCES_KEY = "preferences" as const;

export interface ActiveGameStorageRecord {
  readonly checkpoint: unknown;
  readonly gameId: string;
  readonly key: typeof ACTIVE_GAME_KEY;
  readonly recordVersion: typeof ACTIVE_GAME_RECORD_VERSION;
  readonly updatedAt: number;
}

export interface CompletedGameStorageRecord {
  readonly blackParticipantKind: string;
  readonly checkpoint: unknown;
  readonly completedAt: number;
  readonly gameId: string;
  readonly lastUpdatedAt: number;
  readonly pgn: unknown;
  readonly recordVersion: typeof COMPLETED_GAME_RECORD_VERSION;
  readonly result: unknown;
  readonly resultType: string;
  readonly revision: number;
  readonly startedAt?: number;
  readonly whiteParticipantKind: string;
}

export interface PreferencesStorageRecord {
  readonly key: typeof PREFERENCES_KEY;
  readonly recordVersion: typeof PREFERENCES_RECORD_VERSION;
  readonly updatedAt: number;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface ReviewStorageRecord {
  readonly gameId: string;
  readonly generatedAt?: number;
  readonly provenance: unknown;
  readonly recordVersion: typeof REVIEW_RECORD_VERSION;
  readonly recordGameId: string;
  readonly reviewVersion: number;
  readonly status: string;
  readonly updatedAt: number;
}

export interface AnalysisCacheStorageRecord {
  readonly analysisProfile: string;
  readonly cacheVersion: number;
  readonly createdAt: number;
  readonly engineId: string;
  readonly engineVersion: string;
  readonly expiresAt?: number;
  readonly identity: unknown;
  readonly key: string;
  readonly payload: unknown;
  readonly recordVersion: typeof ANALYSIS_CACHE_RECORD_VERSION;
}
