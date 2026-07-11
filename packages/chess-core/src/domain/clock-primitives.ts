import { DomainValidationError } from "./errors";

declare const clockBrand: unique symbol;

type ClockBrand<Name extends string> = number & {
  readonly [clockBrand]: Name;
};

export type ClockDurationMs = ClockBrand<"ClockDurationMs">;
export type ClockIncrementMs = ClockBrand<"ClockIncrementMs">;
export type MonotonicTimestampMs = ClockBrand<"MonotonicTimestampMs">;

export function parseClockDurationMs(value: number): ClockDurationMs {
  return parseNonnegativeSafeInteger(
    value,
    "invalid-clock-duration",
    "clock duration",
  ) as ClockDurationMs;
}

export function parseClockIncrementMs(value: number): ClockIncrementMs {
  return parseNonnegativeSafeInteger(
    value,
    "invalid-clock-increment",
    "clock increment",
  ) as ClockIncrementMs;
}

export function parseMonotonicTimestampMs(value: number): MonotonicTimestampMs {
  return parseNonnegativeSafeInteger(
    value,
    "invalid-monotonic-timestamp",
    "monotonic timestamp",
  ) as MonotonicTimestampMs;
}

function parseNonnegativeSafeInteger(
  value: number,
  code: "invalid-clock-duration" | "invalid-clock-increment" | "invalid-monotonic-timestamp",
  label: string,
): number {
  if (!Number.isFinite(value) || !Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(code, `Invalid ${label}: ${String(value)}`);
  }

  return value;
}
