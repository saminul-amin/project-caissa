import type { PersistenceError, PersistenceRejectionReason } from "./errors";

export type DurableRecordType =
  "active-game" | "analysis-cache" | "completed-game" | "preferences" | "review";

export type CorruptionCategory =
  | "invalid-cache-key"
  | "invalid-checkpoint"
  | "invalid-record"
  | "invalid-result"
  | "invalid-review-status"
  | "invalid-revision"
  | "invalid-timestamp"
  | "mismatched-game-id"
  | "missing-pgn"
  | "unsupported-record-version";

/** Safe metadata only. Raw stored values never cross the repository boundary. */
export interface CorruptedRecordMetadata {
  readonly category: CorruptionCategory;
  readonly rawRecoveryMayBePossible: boolean;
  readonly recordKey: string;
  readonly recordType: DurableRecordType;
}

export type PersistenceWriteResult =
  | { readonly status: "saved" }
  | {
      readonly reason: PersistenceRejectionReason;
      readonly status: "rejected";
    }
  | {
      readonly error: PersistenceError;
      readonly status: "failed";
    };

export type PersistenceDeleteResult =
  | { readonly status: "deleted" }
  | {
      readonly error: PersistenceError;
      readonly status: "failed";
    };

export type PersistenceClearResult =
  | { readonly status: "cleared" }
  | {
      readonly error: PersistenceError;
      readonly status: "failed";
    };
