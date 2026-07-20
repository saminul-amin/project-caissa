import {
  createAnalysisCacheKey,
  parseAnalysisCacheKey,
  parseEpochTimestampMs,
  type AnalysisCacheCleanupResult,
  type AnalysisCacheEntry,
  type AnalysisCacheKey,
  type AnalysisCacheReadResult,
  type AnalysisCacheRepository,
  type AnalysisCacheWriteResult,
  type EpochTimestampMs,
  type WallClock,
} from "../../application/persistence";
import type { CaissaDatabase } from "./database";
import { mapPersistenceError } from "./error-mapper";
import { corruptedRecord } from "./record-safety";
import { ANALYSIS_CACHE_RECORD_VERSION, type AnalysisCacheStorageRecord } from "./storage-records";
import { cloneForStorage, validateAnalysisCacheStorageRecord } from "./validation";

export class DexieAnalysisCacheRepository implements AnalysisCacheRepository {
  constructor(
    private readonly database: CaissaDatabase,
    private readonly wallClock: WallClock,
  ) {}

  async get(key: AnalysisCacheKey): Promise<AnalysisCacheReadResult> {
    try {
      const safeKey = parseAnalysisCacheKey(key);
      const stored: unknown = await this.database.analysisCache.get(safeKey);
      if (stored === undefined) return { status: "miss" };

      const validation = validateAnalysisCacheStorageRecord(stored);
      if (validation.status === "invalid") {
        return {
          corruption: corruptedRecord("analysis-cache", safeKey, validation.category, false),
          status: "corrupted",
        };
      }

      const now = this.wallClock.nowEpochMs();
      if (
        validation.value.entry.expiresAt !== undefined &&
        validation.value.entry.expiresAt <= now
      ) {
        await this.database.analysisCache.delete(safeKey);
        return { expiredAt: validation.value.entry.expiresAt, status: "expired" };
      }
      return { entry: validation.value.entry, status: "hit" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "analysis-cache.read"), status: "failed" };
    }
  }

  async set(entry: AnalysisCacheEntry): Promise<AnalysisCacheWriteResult> {
    try {
      const key = parseAnalysisCacheKey(entry.key);
      if (createAnalysisCacheKey(entry.identity) !== key) {
        return { reason: "validation-failed", status: "rejected" };
      }
      const createdAt = parseEpochTimestampMs(entry.createdAt);
      const expiresAt =
        entry.expiresAt === undefined ? undefined : parseEpochTimestampMs(entry.expiresAt);
      const storage: AnalysisCacheStorageRecord = cloneForStorage({
        analysisProfile: entry.identity.analysisProfile,
        cacheVersion: entry.cacheVersion,
        createdAt,
        engineId: entry.identity.engineId,
        engineVersion: entry.identity.engineVersion,
        identity: entry.identity,
        key,
        payload: entry.payload,
        recordVersion: ANALYSIS_CACHE_RECORD_VERSION,
        ...(expiresAt === undefined ? {} : { expiresAt }),
      });
      const validation = validateAnalysisCacheStorageRecord(storage);
      if (validation.status === "invalid") {
        return { reason: "validation-failed", status: "rejected" };
      }

      await this.database.analysisCache.put(storage);
      return { status: "saved" };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "PersistenceValidationError") {
        return { reason: "validation-failed", status: "rejected" };
      }
      return { error: mapPersistenceError(error, "analysis-cache.save"), status: "failed" };
    }
  }

  async delete(key: AnalysisCacheKey): Promise<AnalysisCacheWriteResult> {
    try {
      await this.database.analysisCache.delete(parseAnalysisCacheKey(key));
      return { status: "saved" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "analysis-cache.delete"), status: "failed" };
    }
  }

  async clear(): Promise<AnalysisCacheWriteResult> {
    try {
      await this.database.analysisCache.clear();
      return { status: "saved" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "analysis-cache.clear"), status: "failed" };
    }
  }

  async deleteExpired(now: EpochTimestampMs): Promise<AnalysisCacheCleanupResult> {
    try {
      const safeNow = parseEpochTimestampMs(now);
      const deletedCount = await this.database.analysisCache
        .where("expiresAt")
        .belowOrEqual(safeNow)
        .delete();
      return { deletedCount, status: "cleaned" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "analysis-cache.cleanup"), status: "failed" };
    }
  }
}
