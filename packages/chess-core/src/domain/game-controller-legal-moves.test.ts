import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci } from "./chess-rules";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { createGameController } from "./game-controller";
import { parseGameId, parseSquare } from "./primitives";

function createController(fen?: string) {
  return createGameController({
    configuration: {
      allowUndo: false,
      gameId: parseGameId("legal-move-read-test"),
      initialPosition: fen ? { fen, kind: "fen" } : { kind: "standard" },
      participants: { black: { kind: "human" }, white: { kind: "human" } },
      timeControl: { kind: "untimed" },
    },
    rules: new ChessJsRulesAdapter(),
  });
}

describe("GameController legal-move read boundary", () => {
  it("returns immutable legal moves without changing the authoritative session", () => {
    const controller = createController();
    const prior = controller.getSession();

    const moves = controller.getLegalMoves();

    expect(moves).toHaveLength(20);
    expect(moves.some((move) => move.uci === "e2e4")).toBe(true);
    expect(Object.isFrozen(moves)).toBe(true);
    expect(moves.every((move) => Object.isFrozen(move))).toBe(true);
    expect(controller.getSession()).toBe(prior);
    expect(controller.getSession().revision).toBe(0);
  });

  it("filters by source square and reflects the position after a committed move", () => {
    const controller = createController();
    expect(controller.getLegalMoves({ from: parseSquare("e2") }).map((move) => move.uci)).toEqual([
      "e2e3",
      "e2e4",
    ]);

    controller.start(parseMonotonicTimestampMs(0));
    controller.submitHumanMove({
      expectedRevision: controller.getSession().revision,
      move: moveInputFromUci("e2e4"),
      now: parseMonotonicTimestampMs(1),
    });

    expect(controller.getLegalMoves({ from: parseSquare("e2") })).toEqual([]);
    expect(controller.getLegalMoves({ from: parseSquare("e7") }).map((move) => move.uci)).toEqual([
      "e7e6",
      "e7e5",
    ]);
  });

  it("returns no moves for a terminal position", () => {
    const controller = createController("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
    expect(controller.getLegalMoves()).toEqual([]);
  });
});
