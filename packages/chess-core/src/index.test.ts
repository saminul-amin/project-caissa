import { describe, expect, it } from "vitest";

import { CHESS_CORE_VERSION, createClock, parseClockDurationMs } from "./index";

describe("chess core public API", () => {
  it("exports the foundation package version", () => {
    expect(CHESS_CORE_VERSION).toBe("0.1.0");
  });

  it("exports the intentional deterministic clock entry points", () => {
    expect(
      createClock({ initialMs: parseClockDurationMs(60_000), kind: "sudden-death" }),
    ).toMatchObject({ status: "idle" });
  });
});
