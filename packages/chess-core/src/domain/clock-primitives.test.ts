import { describe, expect, it } from "vitest";

import { DomainValidationError } from "./errors";
import {
  parseClockDurationMs,
  parseClockIncrementMs,
  parseMonotonicTimestampMs,
} from "./clock-primitives";

describe("clock domain primitives", () => {
  it("accepts finite nonnegative safe integers", () => {
    expect(parseClockDurationMs(300_000)).toBe(300_000);
    expect(parseClockIncrementMs(2_000)).toBe(2_000);
    expect(parseMonotonicTimestampMs(12_345)).toBe(12_345);
  });

  it.each([
    ["negative duration", () => parseClockDurationMs(-1), "invalid-clock-duration"],
    ["fractional duration", () => parseClockDurationMs(1.5), "invalid-clock-duration"],
    ["infinite duration", () => parseClockDurationMs(Infinity), "invalid-clock-duration"],
    [
      "unsafe duration",
      () => parseClockDurationMs(Number.MAX_SAFE_INTEGER + 1),
      "invalid-clock-duration",
    ],
    ["negative increment", () => parseClockIncrementMs(-1), "invalid-clock-increment"],
    ["fractional increment", () => parseClockIncrementMs(0.5), "invalid-clock-increment"],
    ["invalid timestamp", () => parseMonotonicTimestampMs(-1), "invalid-monotonic-timestamp"],
    ["fractional timestamp", () => parseMonotonicTimestampMs(1.25), "invalid-monotonic-timestamp"],
  ])("rejects an invalid %s", (_label, parse, expectedCode) => {
    expect(parse).toThrow(DomainValidationError);

    try {
      parse();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).code).toBe(expectedCode);
    }
  });
});
