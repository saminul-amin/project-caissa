import type { PersistenceError, PersistenceErrorCode } from "../../application/persistence";

const quotaErrorNames = new Set(["QuotaExceededError"]);
const closedErrorNames = new Set(["DatabaseClosedError"]);
const unavailableErrorNames = new Set([
  "InvalidStateError",
  "MissingAPIError",
  "OpenFailedError",
  "SecurityError",
]);
const transactionErrorNames = new Set([
  "AbortError",
  "ConstraintError",
  "DataError",
  "ReadOnlyError",
  "TransactionInactiveError",
]);

export function mapPersistenceError(error: unknown, operation: string): PersistenceError {
  const name = errorName(error);
  const code = mapErrorCode(name);

  return Object.freeze({
    code,
    operation,
    retryable: code !== "validation-failed" && code !== "unsupported-schema",
  });
}

export function mapTransactionError(error: unknown, operation: string): PersistenceError {
  const mapped = mapPersistenceError(error, operation);
  return mapped.code === "unknown-storage-error"
    ? Object.freeze({ ...mapped, code: "transaction-failed" as const })
    : mapped;
}

function errorName(error: unknown): string {
  if (error instanceof Error || error instanceof DOMException) {
    return error.name;
  }

  if (typeof error === "object" && error !== null && "name" in error) {
    const name: unknown = error.name;
    return typeof name === "string" ? name : "";
  }

  return "";
}

function mapErrorCode(name: string): PersistenceErrorCode {
  if (quotaErrorNames.has(name)) return "quota-exceeded";
  if (closedErrorNames.has(name)) return "database-closed";
  if (unavailableErrorNames.has(name)) return "storage-unavailable";
  if (transactionErrorNames.has(name)) return "transaction-failed";
  return "unknown-storage-error";
}
