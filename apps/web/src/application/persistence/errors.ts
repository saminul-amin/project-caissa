export type PersistenceErrorCode =
  | "database-closed"
  | "quota-exceeded"
  | "storage-unavailable"
  | "transaction-failed"
  | "unknown-storage-error"
  | "unsupported-schema"
  | "validation-failed";

export interface PersistenceError {
  readonly code: PersistenceErrorCode;
  readonly operation: string;
  readonly retryable: boolean;
}

export type PersistenceRejectionReason =
  | "invalid-query"
  | "mismatched-game-id"
  | "missing-pgn"
  | "missing-result"
  | "not-completed"
  | "stale-revision"
  | "validation-failed";

/** Typed construction error for invalid values at the persistence application boundary. */
export class PersistenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceValidationError";
  }
}
