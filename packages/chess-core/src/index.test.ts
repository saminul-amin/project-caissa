import { describe, expect, it } from "vitest";

import {
  CHESS_CORE_VERSION,
  createClock,
  createGameConfiguration,
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

  it("exports the intentional game-session model entry points", () => {
    expect(
      createGameConfiguration({
        allowUndo: false,
        gameId: "public-api-game",
        initialPosition: { kind: "standard" },
        participants: {
          black: { kind: "external-opponent" },
          white: { kind: "human" },
        },
        timeControl: { kind: "untimed" },
      }),
    ).toMatchObject({ gameId: "public-api-game" });
  });
});
