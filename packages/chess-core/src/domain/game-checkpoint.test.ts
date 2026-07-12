import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci } from "./chess-rules";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { createGameController, type GameController } from "./game-controller";
import { GAME_SESSION_CHECKPOINT_VERSION } from "./game-checkpoint";
import { parseRequestId } from "./primitives";

function create(
  options: {
    readonly black?: "external-opponent" | "human";
    readonly timeControl?: Readonly<Record<string, unknown>>;
  } = {},
): GameController {
  return createGameController({
    configuration: {
      allowUndo: true,
      gameId: "checkpoint-export",
      initialPosition: { kind: "standard" },
      participants: {
        black: { kind: options.black ?? "human", label: "Black" },
        white: { kind: "human", label: "White" },
      },
      timeControl: options.timeControl ?? { kind: "untimed" },
    },
    rules: new ChessJsRulesAdapter(),
  });
}

function now(value: number) {
  return parseMonotonicTimestampMs(value);
}

function start(game: GameController): void {
  expect(game.start(now(0)).status).toBe("applied");
}

function move(game: GameController, uci: string): void {
  expect(game.submitHumanMove({ move: moveInputFromUci(uci), now: now(0) }).status).not.toBe(
    "rejected",
  );
}

describe("versioned game-session checkpoint export", () => {
  it("exports a ready session without changing revision", () => {
    const game = create();
    const prior = game.getSession();
    const checkpoint = game.exportCheckpoint();
    expect(checkpoint).toMatchObject({
      checkpointVersion: GAME_SESSION_CHECKPOINT_VERSION,
      gameId: prior.gameId,
      history: [],
      lifecycle: { phase: "ready" },
      revision: prior.revision,
    });
    expect(game.getSession()).toBe(prior);
  });

  it("exports active position, move history, and clock state", () => {
    const game = create({
      timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
    });
    start(game);
    move(game, "e2e4");
    const checkpoint = game.exportCheckpoint();
    expect(checkpoint).toMatchObject({
      clock: { activeColor: "black", status: "running" },
      history: [{ san: "e4", uci: "e2e4" }],
      lifecycle: { phase: "player-turn" },
      position: { ply: 1, turn: "black" },
    });
  });

  it("preserves a valid awaiting-opponent request", () => {
    const game = create({ black: "external-opponent" });
    start(game);
    move(game, "e2e4");
    game.requestOpponentMove({ requestId: parseRequestId("checkpoint-request") });
    expect(game.exportCheckpoint()).toMatchObject({
      activeOpponentRequest: {
        expectedPly: 1,
        requestId: "checkpoint-request",
        requestedColor: "black",
      },
      lifecycle: { phase: "awaiting-opponent" },
    });
  });

  it("preserves the paused phase and frozen clock", () => {
    const game = create({ timeControl: { initialMs: 60_000, kind: "sudden-death" } });
    start(game);
    game.pause(now(10));
    const checkpoint = game.exportCheckpoint();
    expect(checkpoint).toMatchObject({
      clock: { resumeColor: "white", status: "paused" },
      lifecycle: { phase: "paused", resumePhase: "player-turn" },
    });
    expect(Object.isFrozen(checkpoint.clock)).toBe(true);
  });

  it("preserves a completed result and final history", () => {
    const game = create();
    start(game);
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) move(game, uci);
    expect(game.exportCheckpoint()).toMatchObject({
      history: [{}, {}, {}, { san: "Qh4#" }],
      lifecycle: { phase: "completed" },
      result: { pgnResult: "0-1", reason: "checkmate", winner: "black" },
    });
  });

  it("preserves an abandoned result", () => {
    const game = create();
    start(game);
    game.abandon({ awardedWinner: "white", now: now(0) });
    expect(game.exportCheckpoint()).toMatchObject({
      lifecycle: { phase: "abandoned" },
      result: { pgnResult: "1-0", reason: "abandoned", winner: "white" },
    });
  });

  it("deeply freezes independently copied checkpoint data", () => {
    const game = create();
    start(game);
    move(game, "e2e4");
    const session = game.getSession();
    const checkpoint = game.exportCheckpoint();

    expect(checkpoint.configuration).not.toBe(session.configuration);
    expect(checkpoint.history).not.toBe(session.history);
    expect(checkpoint.history[0]).not.toBe(session.history[0]);
    expect(Object.isFrozen(checkpoint)).toBe(true);
    expect(Object.isFrozen(checkpoint.configuration.participants.white)).toBe(true);
    expect(Object.isFrozen(checkpoint.history)).toBe(true);
    expect(Object.isFrozen(checkpoint.history[0]?.clockBefore)).toBe(true);
    expect(Reflect.set(checkpoint.position, "fen", "forged")).toBe(false);
    expect(
      Reflect.set(checkpoint.configuration.participants.white, "kind", "external-opponent"),
    ).toBe(false);
    expect(game.getSession()).toBe(session);
    expect(game.exportCheckpoint()).toEqual(checkpoint);
  });

  it("contains only domain data and no controller or rules instances", () => {
    const game = create();
    const checkpoint = game.exportCheckpoint();
    expect(Object.values(checkpoint).some((value) => typeof value === "function")).toBe(false);
    expect("rules" in checkpoint).toBe(false);
    expect("controller" in checkpoint).toBe(false);
  });
});
