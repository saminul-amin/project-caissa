import { parseMonotonicTimestampMs, type MonotonicTimestampMs } from "@caissa/chess-core";

export interface MonotonicClock {
  now(): MonotonicTimestampMs;
}

export interface PerformanceClockSource {
  now(): number;
}

/** Isolates the browser's fractional high-resolution clock behind integer domain time. */
export class BrowserMonotonicClock implements MonotonicClock {
  constructor(private readonly source: PerformanceClockSource = performance) {}

  now(): MonotonicTimestampMs {
    const value = this.source.now();
    if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.trunc(value))) {
      return parseMonotonicTimestampMs(value);
    }
    return parseMonotonicTimestampMs(Math.trunc(value));
  }
}
