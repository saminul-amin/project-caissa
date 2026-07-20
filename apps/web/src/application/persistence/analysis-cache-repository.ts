import type { Fen, GameId } from "@caissa/chess-core";

import { PersistenceValidationError } from "./errors";
import type { PersistenceError } from "./errors";
import type { CorruptedRecordMetadata, PersistenceWriteResult } from "./results";
import type { EpochTimestampMs } from "./time";

declare const analysisCacheKeyBrand: unique symbol;

export const ANALYSIS_CACHE_SCHEMA_VERSION = 1 as const;
export type AnalysisCacheSchemaVersion = typeof ANALYSIS_CACHE_SCHEMA_VERSION;
export type AnalysisCacheKey = string & {
  readonly [analysisCacheKeyBrand]: "AnalysisCacheKey";
};

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface AnalysisCacheIdentity {
  readonly analysisProfile: string;
  readonly configurationVersion: string;
  readonly engineId: string;
  readonly engineVersion: string;
  readonly fen: Fen;
}

export interface AnalysisCacheEntry {
  readonly cacheVersion: AnalysisCacheSchemaVersion;
  readonly createdAt: EpochTimestampMs;
  readonly expiresAt?: EpochTimestampMs;
  readonly identity: AnalysisCacheIdentity;
  readonly key: AnalysisCacheKey;
  readonly payload: JsonValue;
}

export type AnalysisCacheReadResult =
  | { readonly entry: AnalysisCacheEntry; readonly status: "hit" }
  | { readonly status: "miss" }
  | { readonly expiredAt: EpochTimestampMs; readonly status: "expired" }
  | { readonly corruption: CorruptedRecordMetadata; readonly status: "corrupted" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export type AnalysisCacheWriteResult = PersistenceWriteResult;
export type AnalysisCacheCleanupResult =
  | { readonly deletedCount: number; readonly status: "cleaned" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export interface AnalysisCacheRepository {
  get(key: AnalysisCacheKey): Promise<AnalysisCacheReadResult>;
  set(entry: AnalysisCacheEntry): Promise<AnalysisCacheWriteResult>;
  delete(key: AnalysisCacheKey): Promise<AnalysisCacheWriteResult>;
  clear(): Promise<AnalysisCacheWriteResult>;
  deleteExpired(now: EpochTimestampMs): Promise<AnalysisCacheCleanupResult>;
}

const maximumCacheKeyLength = 4_096;
const maximumIdentityPartLength = 512;

/** Length-prefixed segments are collision-free for the exact Version 1 identity strings. */
export function createAnalysisCacheKey(identity: AnalysisCacheIdentity): AnalysisCacheKey {
  const parts = [
    identity.fen,
    identity.analysisProfile,
    identity.engineId,
    identity.engineVersion,
    identity.configurationVersion,
  ];

  if (
    parts.some(
      (part) =>
        typeof part !== "string" || part.length === 0 || part.length > maximumIdentityPartLength,
    )
  ) {
    throw new PersistenceValidationError("Analysis-cache identity contains an invalid part.");
  }

  return parseAnalysisCacheKey(
    `v1:${parts.map((part) => `${String(part.length)}:${part}`).join("")}`,
  );
}

export function parseAnalysisCacheKey(value: unknown): AnalysisCacheKey {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumCacheKeyLength ||
    !value.startsWith("v1:") ||
    hasControlCharacters(value)
  ) {
    throw new PersistenceValidationError("Analysis-cache key is invalid.");
  }

  return value as AnalysisCacheKey;
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit < 32 || codeUnit === 127) return true;
  }
  return false;
}

/** Optional owner link reserved for later cache cleanup; no game deletion uses this value. */
export type AnalysisCacheOwnerGameId = GameId;
