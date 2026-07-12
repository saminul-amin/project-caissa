import { describe, expect, it } from "vitest";

import { GameControllerError } from "./errors";
import {
  createAbandonedGameResult,
  createGameResultFromTerminalState,
  createTimeoutGameResult,
} from "./game-result";
import {
  createGameConfiguration,
  createInitialClock,
  initialSessionRevision,
} from "./game-session";

describe("game result model", () => {
  it("creates decisive checkmate results for both colors", () => {
    expect(
      createGameResultFromTerminalState({
        loser: "black",
        reason: "checkmate",
        status: "checkmate",
        winner: "white",
      }),
    ).toEqual({
      isDraw: false,
      loser: "black",
      pgnResult: "1-0",
      reason: "checkmate",
      status: "decisive",
      winner: "white",
    });

    expect(
      createGameResultFromTerminalState({
        loser: "white",
        reason: "checkmate",
        status: "checkmate",
        winner: "black",
      }),
    ).toMatchObject({ pgnResult: "0-1", winner: "black" });
  });

  it.each([
    "stalemate",
    "insufficient-material",
    "threefold-repetition",
    "fifty-move-rule",
  ] as const)("creates an unambiguous draw result for %s", (reason) => {
    expect(createGameResultFromTerminalState({ reason, status: "draw" })).toEqual({
      isDraw: true,
      pgnResult: "1/2-1/2",
      reason,
      status: "draw",
    });
  });

  it("applies the explicit Version 1 timeout-win policy", () => {
    expect(createTimeoutGameResult("white")).toEqual({
      isDraw: false,
      loser: "white",
      pgnResult: "0-1",
      reason: "timeout",
      status: "decisive",
      winner: "black",
    });
    expect(createTimeoutGameResult("black")).toMatchObject({
      loser: "black",
      pgnResult: "1-0",
      winner: "white",
    });
  });

  it("creates unawarded and explicitly awarded abandonment results", () => {
    expect(createAbandonedGameResult()).toEqual({
      isDraw: false,
      reason: "abandoned",
      status: "abandoned",
    });
    expect(createAbandonedGameResult("white")).toEqual({
      isDraw: false,
      loser: "black",
      pgnResult: "1-0",
      reason: "abandoned",
      status: "abandoned",
      winner: "white",
    });
  });
});

describe("game configuration model", () => {
  it("validates, normalizes, and deeply freezes a standard configuration", () => {
    const configuration = createGameConfiguration({
      allowUndo: false,
      gameId: "game-standard-001",
      initialPosition: { kind: "standard" },
      participants: {
        black: { kind: "external-opponent", label: "  Practice Opponent  " },
        white: { kind: "human", label: "Player" },
      },
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });

    expect(configuration).toEqual({
      allowUndo: false,
      gameId: "game-standard-001",
      initialPosition: { kind: "standard" },
      participants: {
        black: { kind: "external-opponent", label: "Practice Opponent" },
        white: { kind: "human", label: "Player" },
      },
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.isFrozen(configuration.participants)).toBe(true);
    expect(Object.isFrozen(configuration.participants.white)).toBe(true);
    expect(Object.isFrozen(configuration.timeControl)).toBe(true);
  });

  it("supports human-versus-human, untimed, and unlabeled participants", () => {
    const configuration = createGameConfiguration({
      allowUndo: true,
      gameId: "game-local-001",
      initialPosition: { kind: "standard" },
      participants: {
        black: { kind: "human" },
        white: { kind: "human" },
      },
      timeControl: { kind: "untimed" },
    });

    expect(configuration.participants).toEqual({
      black: { kind: "human" },
      white: { kind: "human" },
    });
    expect(createInitialClock(configuration).status).toBe("untimed");
    expect(initialSessionRevision()).toBe(0);
  });

  it("supports increment clocks and structurally valid custom FEN starts", () => {
    const configuration = createGameConfiguration({
      allowUndo: false,
      gameId: "game-fen-001",
      initialPosition: {
        fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
        kind: "fen",
      },
      participants: {
        black: { kind: "external-opponent" },
        white: { kind: "external-opponent" },
      },
      timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
    });

    expect(configuration.initialPosition).toMatchObject({ kind: "fen" });
    expect(configuration.timeControl).toEqual({
      incrementMs: 2_000,
      initialMs: 180_000,
      kind: "increment",
    });
  });

  it.each([
    ["non-object configuration", null],
    [
      "missing participants",
      {
        allowUndo: false,
        gameId: "game-1",
        initialPosition: { kind: "standard" },
        timeControl: { kind: "untimed" },
      },
    ],
    [
      "invalid participant kind",
      baseConfiguration({ black: { kind: "robot" }, white: { kind: "human" } }),
    ],
    [
      "non-text participant label",
      baseConfiguration({ black: { kind: "human", label: 42 }, white: { kind: "human" } }),
    ],
    [
      "empty participant label",
      baseConfiguration({ black: { kind: "human", label: "   " }, white: { kind: "human" } }),
    ],
    [
      "control character in participant label",
      baseConfiguration({
        black: { kind: "human", label: "bad\u0000label" },
        white: { kind: "human" },
      }),
    ],
    [
      "oversized participant label",
      baseConfiguration({
        black: { kind: "human", label: "x".repeat(81) },
        white: { kind: "human" },
      }),
    ],
    ["missing game ID", { ...baseConfiguration(), gameId: undefined }],
    ["invalid game ID", { ...baseConfiguration(), gameId: "invalid game" }],
    ["invalid undo policy", { ...baseConfiguration(), allowUndo: "yes" }],
    ["missing time control", { ...baseConfiguration(), timeControl: undefined }],
    ["invalid time-control kind", { ...baseConfiguration(), timeControl: { kind: "delay" } }],
    [
      "missing sudden-death duration",
      { ...baseConfiguration(), timeControl: { kind: "sudden-death" } },
    ],
    [
      "negative sudden-death duration",
      { ...baseConfiguration(), timeControl: { initialMs: -1, kind: "sudden-death" } },
    ],
    [
      "missing increment values",
      { ...baseConfiguration(), timeControl: { initialMs: 1_000, kind: "increment" } },
    ],
    ["missing initial position", { ...baseConfiguration(), initialPosition: undefined }],
    ["custom position without FEN", { ...baseConfiguration(), initialPosition: { kind: "fen" } }],
    [
      "malformed custom FEN",
      { ...baseConfiguration(), initialPosition: { fen: "bad-fen", kind: "fen" } },
    ],
  ])("rejects an invalid configuration: %s", (_label, value) => {
    expect(() => createGameConfiguration(value)).toThrow(GameControllerError);

    try {
      createGameConfiguration(value);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(GameControllerError);
      expect((error as GameControllerError).code).toBe("invalid-game-configuration");
    }
  });
});

function baseConfiguration(
  participants: unknown = {
    black: { kind: "human" },
    white: { kind: "human" },
  },
): Readonly<Record<string, unknown>> {
  return {
    allowUndo: false,
    gameId: "game-valid-001",
    initialPosition: { kind: "standard" },
    participants,
    timeControl: { kind: "untimed" },
  };
}
