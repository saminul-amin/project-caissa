import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { createGameController } from "./game-controller";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { moveInputFromUci } from "./chess-rules";
import { parseGameId, parseUciMove } from "./primitives";

describe("GameController PGN export", () => {
  it("delegates to the authoritative rules state without changing the session", () => {
    const controller = createGameController({
      configuration: {
        allowUndo: true,
        gameId: parseGameId("controller-pgn"),
        initialPosition: { kind: "standard" },
        participants: {
          black: { kind: "human" },
          white: { kind: "human" },
        },
        timeControl: { kind: "untimed" },
      },
      rules: new ChessJsRulesAdapter(),
    });
    expect(controller.start(parseMonotonicTimestampMs(0)).status).toBe("applied");
    expect(
      controller.submitHumanMove({
        move: moveInputFromUci(parseUciMove("e2e4")),
        now: parseMonotonicTimestampMs(1),
      }).status,
    ).toBe("applied");
    const before = controller.getSession();

    expect(controller.exportPgn()).toContain("1. e4");
    expect(controller.getSession()).toBe(before);
    expect(controller.getSession().revision).toBe(before.revision);
  });
});
