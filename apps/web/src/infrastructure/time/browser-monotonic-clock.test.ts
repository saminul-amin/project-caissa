import { describe, expect, it } from "vitest";

import { BrowserMonotonicClock } from "./browser-monotonic-clock";

describe("BrowserMonotonicClock", () => {
  it("uses timeOrigin plus now and explicitly quantizes through the domain parser", () => {
    const clock = new BrowserMonotonicClock({ now: () => 1_234.75, timeOrigin: 10_000.5 });
    expect(clock.now()).toBe(11_235);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "rejects an invalid platform value %s",
    (value) => {
      const clock = new BrowserMonotonicClock({ now: () => value, timeOrigin: 10_000 });
      expect(() => clock.now()).toThrow();
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "rejects an invalid time origin %s",
    (value) => {
      const clock = new BrowserMonotonicClock({ now: () => 100, timeOrigin: value });
      expect(() => clock.now()).toThrow();
    },
  );

  it("keeps a later document timestamp ahead of a persisted prior-document timestamp", () => {
    const previousDocument = new BrowserMonotonicClock({
      now: () => 10_000,
      timeOrigin: 1_000_000,
    });
    const persistedTimestamp = previousDocument.now();
    const restoredDocument = new BrowserMonotonicClock({
      now: () => 250,
      timeOrigin: 1_010_500,
    });

    expect(restoredDocument.now()).toBeGreaterThan(persistedTimestamp);
  });
});
