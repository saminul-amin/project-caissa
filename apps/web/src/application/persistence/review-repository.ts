import type { GameId } from "@caissa/chess-core";
import { z } from "zod";

import type { PersistenceError } from "./errors";
import type { CorruptedRecordMetadata, PersistenceWriteResult } from "./results";
import type { EpochTimestampMs } from "./time";

export const REVIEW_SCHEMA_VERSION = 1 as const;
export const REVIEW_GENERATION_STATUSES = [
  "not-started",
  "in-progress",
  "partial",
  "completed",
  "failed",
] as const;

export type ReviewSchemaVersion = typeof REVIEW_SCHEMA_VERSION;
export type ReviewGenerationStatus = (typeof REVIEW_GENERATION_STATUSES)[number];

export interface ReviewProvenance {
  readonly identifier: string;
  readonly provider: "deterministic" | "maia" | "stockfish";
  readonly version: string;
}

/** Metadata-only Version 1 foundation; detailed guided-review payloads are deferred. */
export interface StoredReviewRecord {
  readonly gameId: GameId;
  readonly generatedAt?: EpochTimestampMs;
  readonly provenance: readonly ReviewProvenance[];
  readonly reviewVersion: ReviewSchemaVersion;
  readonly status: ReviewGenerationStatus;
  readonly updatedAt: EpochTimestampMs;
}

export type ReviewWriteResult = PersistenceWriteResult;
export type ReviewReadResult =
  | { readonly record: StoredReviewRecord; readonly status: "found" }
  | { readonly status: "not-found" }
  | { readonly corruption: CorruptedRecordMetadata; readonly status: "corrupted" }
  | { readonly error: PersistenceError; readonly status: "failed" };

export interface ReviewRepository {
  saveReview(record: StoredReviewRecord): Promise<ReviewWriteResult>;
  getReview(gameId: GameId): Promise<ReviewReadResult>;
  deleteReview(gameId: GameId): Promise<ReviewWriteResult>;
  clearReviews(): Promise<ReviewWriteResult>;
}

const provenanceSchema = z
  .object({
    identifier: z.string().trim().min(1).max(128),
    provider: z.enum(["deterministic", "maia", "stockfish"]),
    version: z.string().trim().min(1).max(64),
  })
  .strict();

export const reviewRecordInputSchema = z
  .object({
    gameId: z.string(),
    generatedAt: z.number().int().nonnegative().optional(),
    provenance: z.array(provenanceSchema).max(8),
    reviewVersion: z.literal(REVIEW_SCHEMA_VERSION),
    status: z.enum(REVIEW_GENERATION_STATUSES),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();
