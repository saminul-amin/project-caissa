import { describe, expect, it } from "vitest";

import { BrowserMonotonicClock } from "./browser-monotonic-clock";

describe("BrowserMonotonicClock", () => {
  it("isolates and explicitly quantizes performance time through the domain parser", () => {
    const clock = new BrowserMonotonicClock({ now: () => 1_234.75 });
    expect(clock.now()).toBe(1_234);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    "rejects an invalid platform value %s",
    (value) => {
      const clock = new BrowserMonotonicClock({ now: () => value });
      expect(() => clock.now()).toThrow();
    },
  );
});
