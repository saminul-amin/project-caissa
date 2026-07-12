import { describe, expect, it } from "vitest";

import {
  CHESS_CORE_VERSION,
  ChessJsRulesAdapter,
  GAME_SESSION_CHECKPOINT_VERSION,
  createClock,
  createGameController,
  createGameConfiguration,
  createGameLifecycleState,
  parseClockDurationMs,
  parseUndoPlyCount,
  restoreGameController,
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

  it("exports the intentional authoritative controller entry point", () => {
    expect(
      createGameController({
        configuration: {
          allowUndo: false,
          gameId: "public-controller",
          initialPosition: { kind: "standard" },
          participants: {
            black: { kind: "external-opponent" },
            white: { kind: "human" },
          },
          timeControl: { kind: "untimed" },
        },
        rules: new ChessJsRulesAdapter(),
      }).getSession(),
    ).toMatchObject({ lifecycle: { phase: "ready" }, revision: 0 });
  });

  it("exports bounded undo, checkpoint, and reconstruction entry points", () => {
    expect(parseUndoPlyCount(2)).toBe(2);
    const controller = createGameController({
      configuration: {
        allowUndo: true,
        gameId: "public-recovery",
        initialPosition: { kind: "standard" },
        participants: { black: { kind: "human" }, white: { kind: "human" } },
        timeControl: { kind: "untimed" },
      },
      rules: new ChessJsRulesAdapter(),
    });
    const checkpoint = controller.exportCheckpoint();
    expect(checkpoint.checkpointVersion).toBe(GAME_SESSION_CHECKPOINT_VERSION);
    expect(
      restoreGameController({
        checkpoint,
        createRules: () => new ChessJsRulesAdapter(),
      }).status,
    ).toBe("restored");
  });
});
