import { parseMonotonicTimestampMs, type MonotonicTimestampMs } from "@caissa/chess-core";

export interface MonotonicClock {
  now(): MonotonicTimestampMs;
}

export interface PerformanceClockSource {
  readonly timeOrigin: number;
  now(): number;
}

/** Isolates cross-navigation browser time behind the integer domain boundary. */
export class BrowserMonotonicClock implements MonotonicClock {
  constructor(private readonly source: PerformanceClockSource = performance) {}

  now(): MonotonicTimestampMs {
    const timeOrigin = this.source.timeOrigin;
    const elapsed = this.source.now();
    if (!isSafeNonNegativePlatformTime(timeOrigin)) {
      return parseMonotonicTimestampMs(timeOrigin);
    }
    if (!isSafeNonNegativePlatformTime(elapsed)) {
      return parseMonotonicTimestampMs(elapsed);
    }

    return parseMonotonicTimestampMs(Math.trunc(timeOrigin + elapsed));
  }
}

function isSafeNonNegativePlatformTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.trunc(value));
}
