import { describe, expect, it } from "vitest";

import {
  CHESS_CORE_VERSION,
  createClock,
  createGameLifecycleState,
  parseClockDurationMs,
  transitionGameLifecycle,
} from "./index";

describe("chess core public API", () => {
  it("exports the foundation package version", () => {
    expect(CHESS_CORE_VERSION).toBe("0.1.0");
  });

  it("exports the intentional deterministic clock entry points", () => {
    expect(
      createClock({ initialMs: parseClockDurationMs(60_000), kind: "sudden-death" }),
    ).toMatchObject({ status: "idle" });
  });

  it("exports the intentional game-lifecycle entry points", () => {
    expect(
      transitionGameLifecycle(createGameLifecycleState(), { type: "creation-succeeded" }),
    ).toEqual({ status: "applied", state: { phase: "ready" } });
  });
});
