import {
  ChessJsRulesAdapter,
  parseFen,
  parseGameId,
  parsePgn,
  parseSessionRevision,
  restoreGameController,
  type GameId,
  type GameSessionCheckpoint,
} from "@caissa/chess-core";
import { z } from "zod";

import {
  ANALYSIS_CACHE_SCHEMA_VERSION,
  createAnalysisCacheKey,
  parseAnalysisCacheKey,
  parseEpochTimestampMs,
  type AnalysisCacheEntry,
  type AnalysisCacheIdentity,
  type CorruptionCategory,
  type JsonValue,
  type StoredReviewRecord,
} from "../../application/persistence";
import type { CompletedGameRecord } from "../../application/persistence";
import { reviewRecordInputSchema } from "../../application/persistence/review-repository";
import {
  ACTIVE_GAME_KEY,
  ACTIVE_GAME_RECORD_VERSION,
  ANALYSIS_CACHE_RECORD_VERSION,
  COMPLETED_GAME_RECORD_VERSION,
  REVIEW_RECORD_VERSION,
  type ActiveGameStorageRecord,
  type AnalysisCacheStorageRecord,
  type CompletedGameStorageRecord,
  type ReviewStorageRecord,
} from "./storage-records";

type ValidationResult<Value> =
  | { readonly status: "valid"; readonly value: Value }
  | { readonly category: CorruptionCategory; readonly status: "invalid" };

const nonNegativeSafeInteger = z.number().int().nonnegative();

const checkpointStructureSchema = z
  .object({
    activeOpponentRequest: z.unknown().optional(),
    checkpointVersion: nonNegativeSafeInteger,
    clock: z.object({ status: z.string(), timeControl: z.unknown() }).loose(),
    configuration: z
      .object({
        allowUndo: z.boolean(),
        gameId: z.string(),
        initialPosition: z.unknown(),
        participants: z.unknown(),
        timeControl: z.unknown(),
      })
      .loose(),
    gameId: z.string(),
    history: z.array(
      z
        .object({
          actor: z.string(),
          fenAfter: z.string(),
          fenBefore: z.string(),
          mover: z.string(),
          ply: nonNegativeSafeInteger,
          san: z.string(),
          uci: z.string(),
        })
        .loose(),
    ),
    lifecycle: z.object({ phase: z.string() }).loose(),
    position: z
      .object({
        fen: z.string(),
        inCheck: z.boolean(),
        ply: nonNegativeSafeInteger,
        terminalState: z.unknown(),
        turn: z.string(),
      })
      .loose(),
    result: z.unknown().optional(),
    revision: nonNegativeSafeInteger,
  })
  .loose();

const activeStorageSchema = z
  .object({
    checkpoint: z.unknown(),
    gameId: z.string(),
    key: z.literal(ACTIVE_GAME_KEY),
    recordVersion: z.literal(ACTIVE_GAME_RECORD_VERSION),
    updatedAt: nonNegativeSafeInteger,
  })
  .strict();

const completedStorageSchema = z
  .object({
    blackParticipantKind: z.string(),
    checkpoint: z.unknown(),
    completedAt: nonNegativeSafeInteger,
    gameId: z.string(),
    lastUpdatedAt: nonNegativeSafeInteger,
    pgn: z.unknown(),
    recordVersion: z.literal(COMPLETED_GAME_RECORD_VERSION),
    result: z.unknown(),
    resultType: z.string(),
    revision: nonNegativeSafeInteger,
    startedAt: nonNegativeSafeInteger.optional(),
    whiteParticipantKind: z.string(),
  })
  .strict();

const reviewStorageSchema = z
  .object({
    gameId: z.string(),
    generatedAt: nonNegativeSafeInteger.optional(),
    provenance: z.unknown(),
    recordVersion: z.literal(REVIEW_RECORD_VERSION),
    recordGameId: z.string(),
    reviewVersion: nonNegativeSafeInteger,
    status: z.string(),
    updatedAt: nonNegativeSafeInteger,
  })
  .strict();

const cacheStorageSchema = z
  .object({
    analysisProfile: z.string(),
    cacheVersion: nonNegativeSafeInteger,
    createdAt: nonNegativeSafeInteger,
    engineId: z.string(),
    engineVersion: z.string(),
    expiresAt: nonNegativeSafeInteger.optional(),
    identity: z.unknown(),
    key: z.string(),
    payload: z.unknown(),
    recordVersion: z.literal(ANALYSIS_CACHE_RECORD_VERSION),
  })
  .strict();

const cacheIdentitySchema = z
  .object({
    analysisProfile: z.string().trim().min(1).max(128),
    configurationVersion: z.string().trim().min(1).max(128),
    engineId: z.string().trim().min(1).max(128),
    engineVersion: z.string().trim().min(1).max(128),
    fen: z.string(),
  })
  .strict();

const gameResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      isDraw: z.literal(true),
      pgnResult: z.literal("1/2-1/2"),
      reason: z.enum([
        "fifty-move-rule",
        "insufficient-material",
        "stalemate",
        "threefold-repetition",
      ]),
      status: z.literal("draw"),
    })
    .strict(),
  z
    .object({
      isDraw: z.literal(false),
      loser: z.enum(["white", "black"]),
      pgnResult: z.enum(["1-0", "0-1"]),
      reason: z.enum(["checkmate", "timeout"]),
      status: z.literal("decisive"),
      winner: z.enum(["white", "black"]),
    })
    .strict(),
  z
    .object({
      isDraw: z.literal(false),
      loser: z.enum(["white", "black"]).optional(),
      pgnResult: z.enum(["1-0", "0-1"]).optional(),
      reason: z.literal("abandoned"),
      status: z.literal("abandoned"),
      winner: z.enum(["white", "black"]).optional(),
    })
    .strict(),
]);

export function validateCheckpoint(value: unknown): ValidationResult<GameSessionCheckpoint> {
  const structure = checkpointStructureSchema.safeParse(value);
  if (!structure.success) {
    return { category: detectCheckpointStructuralCategory(value), status: "invalid" };
  }

  const restoration = restoreGameController({
    checkpoint: value,
    createRules: () => new ChessJsRulesAdapter(),
  });
  if (restoration.status === "rejected") {
    return {
      category:
        restoration.reason === "invalid-revision" ? "invalid-revision" : "invalid-checkpoint",
      status: "invalid",
    };
  }

  return { status: "valid", value: restoration.controller.exportCheckpoint() };
}

export function validateActiveStorageRecord(value: unknown): ValidationResult<{
  readonly checkpoint: GameSessionCheckpoint;
  readonly storage: ActiveGameStorageRecord;
}> {
  if (hasUnsupportedRecordVersion(value, ACTIVE_GAME_RECORD_VERSION)) {
    return { category: "unsupported-record-version", status: "invalid" };
  }

  const parsed = activeStorageSchema.safeParse(value);
  if (!parsed.success) {
    return {
      category: hasInvalidTimestamp(value, "updatedAt") ? "invalid-timestamp" : "invalid-record",
      status: "invalid",
    };
  }

  const checkpoint = validateCheckpoint(parsed.data.checkpoint);
  if (checkpoint.status === "invalid") return checkpoint;

  if (checkpoint.value.gameId !== parsed.data.gameId) {
    return { category: "mismatched-game-id", status: "invalid" };
  }

  try {
    parseGameId(parsed.data.gameId);
    parseEpochTimestampMs(parsed.data.updatedAt);
  } catch {
    return { category: "invalid-record", status: "invalid" };
  }

  return { status: "valid", value: { checkpoint: checkpoint.value, storage: parsed.data } };
}

export function validateCompletedStorageRecord(value: unknown): ValidationResult<{
  readonly record: CompletedGameRecord;
  readonly storage: CompletedGameStorageRecord;
}> {
  if (hasUnsupportedRecordVersion(value, COMPLETED_GAME_RECORD_VERSION)) {
    return { category: "unsupported-record-version", status: "invalid" };
  }

  const parsed = completedStorageSchema.safeParse(value);
  if (!parsed.success) {
    return { category: detectCompletedRecordCategory(value), status: "invalid" };
  }

  const checkpoint = validateCheckpoint(parsed.data.checkpoint);
  if (checkpoint.status === "invalid") return checkpoint;

  let gameId: GameId;
  try {
    gameId = parseGameId(parsed.data.gameId);
    parseSessionRevision(parsed.data.revision);
  } catch {
    return { category: "invalid-revision", status: "invalid" };
  }

  if (checkpoint.value.gameId !== gameId || checkpoint.value.revision !== parsed.data.revision) {
    return { category: "mismatched-game-id", status: "invalid" };
  }
  if (
    checkpoint.value.lifecycle.phase !== "completed" &&
    checkpoint.value.lifecycle.phase !== "abandoned"
  ) {
    return { category: "invalid-checkpoint", status: "invalid" };
  }
  if (!checkpoint.value.result || !gameResultSchema.safeParse(parsed.data.result).success) {
    return { category: "invalid-result", status: "invalid" };
  }
  if (!sameJsonValue(checkpoint.value.result, parsed.data.result)) {
    return { category: "invalid-result", status: "invalid" };
  }
  if (typeof parsed.data.pgn !== "string" || parsed.data.pgn.trim().length === 0) {
    return { category: "missing-pgn", status: "invalid" };
  }

  try {
    const completedAt = parseEpochTimestampMs(parsed.data.completedAt);
    const pgn = parsePgn(parsed.data.pgn);
    const startedAt =
      parsed.data.startedAt === undefined
        ? undefined
        : parseEpochTimestampMs(parsed.data.startedAt);
    const record: CompletedGameRecord = Object.freeze({
      checkpoint: checkpoint.value,
      completedAt,
      gameId,
      pgn,
      result: checkpoint.value.result,
      ...(startedAt === undefined ? {} : { startedAt }),
    });
    const storage: CompletedGameStorageRecord = {
      blackParticipantKind: parsed.data.blackParticipantKind,
      checkpoint: parsed.data.checkpoint,
      completedAt: parsed.data.completedAt,
      gameId: parsed.data.gameId,
      lastUpdatedAt: parsed.data.lastUpdatedAt,
      pgn: parsed.data.pgn,
      recordVersion: COMPLETED_GAME_RECORD_VERSION,
      result: parsed.data.result,
      resultType: parsed.data.resultType,
      revision: parsed.data.revision,
      whiteParticipantKind: parsed.data.whiteParticipantKind,
      ...(parsed.data.startedAt === undefined ? {} : { startedAt: parsed.data.startedAt }),
    };
    return { status: "valid", value: { record, storage } };
  } catch {
    return { category: "invalid-timestamp", status: "invalid" };
  }
}

export function validateReviewStorageRecord(value: unknown): ValidationResult<{
  readonly record: StoredReviewRecord;
  readonly storage: ReviewStorageRecord;
}> {
  if (hasUnsupportedRecordVersion(value, REVIEW_RECORD_VERSION)) {
    return { category: "unsupported-record-version", status: "invalid" };
  }

  const storage = reviewStorageSchema.safeParse(value);
  if (!storage.success) {
    return {
      category: hasInvalidTimestamp(value, "updatedAt")
        ? "invalid-timestamp"
        : "invalid-review-status",
      status: "invalid",
    };
  }
  const input = reviewRecordInputSchema.safeParse({
    gameId: storage.data.recordGameId,
    provenance: storage.data.provenance,
    reviewVersion: storage.data.reviewVersion,
    status: storage.data.status,
    updatedAt: storage.data.updatedAt,
    ...(storage.data.generatedAt === undefined ? {} : { generatedAt: storage.data.generatedAt }),
  });
  if (!input.success) {
    return { category: "invalid-review-status", status: "invalid" };
  }

  try {
    const gameId = parseGameId(storage.data.gameId);
    if (parseGameId(storage.data.recordGameId) !== gameId) {
      return { category: "mismatched-game-id", status: "invalid" };
    }
    const updatedAt = parseEpochTimestampMs(storage.data.updatedAt);
    const generatedAt =
      storage.data.generatedAt === undefined
        ? undefined
        : parseEpochTimestampMs(storage.data.generatedAt);
    const record: StoredReviewRecord = Object.freeze({
      gameId,
      provenance: Object.freeze(input.data.provenance.map((item) => Object.freeze(item))),
      reviewVersion: 1,
      status: input.data.status,
      updatedAt,
      ...(generatedAt === undefined ? {} : { generatedAt }),
    });
    const normalizedStorage: ReviewStorageRecord = {
      gameId: storage.data.gameId,
      provenance: storage.data.provenance,
      recordVersion: REVIEW_RECORD_VERSION,
      recordGameId: storage.data.recordGameId,
      reviewVersion: storage.data.reviewVersion,
      status: storage.data.status,
      updatedAt: storage.data.updatedAt,
      ...(storage.data.generatedAt === undefined ? {} : { generatedAt: storage.data.generatedAt }),
    };
    return { status: "valid", value: { record, storage: normalizedStorage } };
  } catch {
    return { category: "invalid-record", status: "invalid" };
  }
}

export function validateAnalysisCacheStorageRecord(value: unknown): ValidationResult<{
  readonly entry: AnalysisCacheEntry;
  readonly storage: AnalysisCacheStorageRecord;
}> {
  if (hasUnsupportedRecordVersion(value, ANALYSIS_CACHE_RECORD_VERSION)) {
    return { category: "unsupported-record-version", status: "invalid" };
  }

  const storage = cacheStorageSchema.safeParse(value);
  if (!storage.success) {
    return { category: detectCacheRecordCategory(value), status: "invalid" };
  }
  if (storage.data.cacheVersion !== ANALYSIS_CACHE_SCHEMA_VERSION) {
    return { category: "unsupported-record-version", status: "invalid" };
  }

  const identityData = cacheIdentitySchema.safeParse(storage.data.identity);
  if (!identityData.success || !isBoundedJsonValue(storage.data.payload)) {
    return { category: "invalid-record", status: "invalid" };
  }

  try {
    const identity: AnalysisCacheIdentity = Object.freeze({
      analysisProfile: identityData.data.analysisProfile,
      configurationVersion: identityData.data.configurationVersion,
      engineId: identityData.data.engineId,
      engineVersion: identityData.data.engineVersion,
      fen: parseFen(identityData.data.fen),
    });
    const key = parseAnalysisCacheKey(storage.data.key);
    if (
      createAnalysisCacheKey(identity) !== key ||
      storage.data.analysisProfile !== identity.analysisProfile ||
      storage.data.engineId !== identity.engineId ||
      storage.data.engineVersion !== identity.engineVersion
    ) {
      return { category: "invalid-cache-key", status: "invalid" };
    }

    const createdAt = parseEpochTimestampMs(storage.data.createdAt);
    const expiresAt =
      storage.data.expiresAt === undefined
        ? undefined
        : parseEpochTimestampMs(storage.data.expiresAt);
    if (expiresAt !== undefined && expiresAt < createdAt) {
      return { category: "invalid-timestamp", status: "invalid" };
    }

    const entry: AnalysisCacheEntry = Object.freeze({
      cacheVersion: ANALYSIS_CACHE_SCHEMA_VERSION,
      createdAt,
      identity,
      key,
      payload: freezeJsonValue(storage.data.payload),
      ...(expiresAt === undefined ? {} : { expiresAt }),
    });
    const normalizedStorage: AnalysisCacheStorageRecord = {
      analysisProfile: storage.data.analysisProfile,
      cacheVersion: storage.data.cacheVersion,
      createdAt: storage.data.createdAt,
      engineId: storage.data.engineId,
      engineVersion: storage.data.engineVersion,
      identity: storage.data.identity,
      key: storage.data.key,
      payload: storage.data.payload,
      recordVersion: ANALYSIS_CACHE_RECORD_VERSION,
      ...(storage.data.expiresAt === undefined ? {} : { expiresAt: storage.data.expiresAt }),
    };
    return { status: "valid", value: { entry, storage: normalizedStorage } };
  } catch {
    return { category: "invalid-cache-key", status: "invalid" };
  }
}

export function cloneForStorage<Value>(value: Value): Value {
  return structuredClone(value);
}

function detectCheckpointStructuralCategory(value: unknown): CorruptionCategory {
  if (isRecord(value) && "revision" in value && !isNonNegativeSafeInteger(value.revision)) {
    return "invalid-revision";
  }
  return "invalid-checkpoint";
}

function detectCompletedRecordCategory(value: unknown): CorruptionCategory {
  if (hasInvalidTimestamp(value, "completedAt") || hasInvalidTimestamp(value, "lastUpdatedAt")) {
    return "invalid-timestamp";
  }
  if (isRecord(value) && (typeof value.pgn !== "string" || value.pgn.trim().length === 0)) {
    return "missing-pgn";
  }
  if (isRecord(value) && !gameResultSchema.safeParse(value.result).success) {
    return "invalid-result";
  }
  return "invalid-record";
}

function detectCacheRecordCategory(value: unknown): CorruptionCategory {
  if (isRecord(value) && typeof value.key !== "string") return "invalid-cache-key";
  if (hasInvalidTimestamp(value, "createdAt") || hasInvalidTimestamp(value, "expiresAt")) {
    return "invalid-timestamp";
  }
  return "invalid-record";
}

function hasUnsupportedRecordVersion(value: unknown, expected: number): boolean {
  return isRecord(value) && "recordVersion" in value && value.recordVersion !== expected;
}

function hasInvalidTimestamp(value: unknown, key: string): boolean {
  if (!isRecord(value) || !(key in value) || value[key] === undefined) return false;
  return !isNonNegativeSafeInteger(value[key]);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function isBoundedJsonValue(value: unknown): value is JsonValue {
  const stack: { readonly depth: number; readonly value: unknown }[] = [{ depth: 0, value }];
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    visited += 1;
    if (visited > 10_000 || current.depth > 32) return false;

    if (
      current.value === null ||
      typeof current.value === "string" ||
      typeof current.value === "boolean"
    ) {
      continue;
    }
    if (typeof current.value === "number") {
      if (!Number.isFinite(current.value)) return false;
      continue;
    }
    if (Array.isArray(current.value)) {
      for (const child of current.value) stack.push({ depth: current.depth + 1, value: child });
      continue;
    }
    if (isRecord(current.value)) {
      for (const child of Object.values(current.value)) {
        stack.push({ depth: current.depth + 1, value: child });
      }
      continue;
    }
    return false;
  }

  try {
    return JSON.stringify(value).length <= 262_144;
  } catch {
    return false;
  }
}

function freezeJsonValue(value: JsonValue): JsonValue {
  if (isJsonArray(value)) {
    return Object.freeze(value.map((item) => freezeJsonValue(item)));
  }
  if (isJsonObject(value)) {
    const frozen: Record<string, JsonValue> = {};
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (item !== undefined) frozen[key] = freezeJsonValue(item);
    }
    return Object.freeze(frozen);
  }
  return value;
}

function isJsonArray(value: JsonValue): value is readonly JsonValue[] {
  return Array.isArray(value);
}

function isJsonObject(value: JsonValue): value is { readonly [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
