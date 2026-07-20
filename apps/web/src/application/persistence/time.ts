import { PersistenceValidationError } from "./errors";

declare const epochTimestampBrand: unique symbol;

/** Wall-clock time used only for durable-record metadata. */
export type EpochTimestampMs = number & {
  readonly [epochTimestampBrand]: "EpochTimestampMs";
};

export interface WallClock {
  nowEpochMs(): EpochTimestampMs;
}

export function parseEpochTimestampMs(value: unknown): EpochTimestampMs {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PersistenceValidationError("Epoch timestamp must be a non-negative safe integer.");
  }

  return value as EpochTimestampMs;
}
