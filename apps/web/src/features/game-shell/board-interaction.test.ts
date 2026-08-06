import { parseSanMove, parseSquare, parseUciMove, type LegalMove } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import {
  createSourceSelection,
  moveFeedbackMessage,
  projectBoardSelection,
  type MoveFeedbackMessageKey,
} from "./board-interaction";

describe("board interaction projections", () => {
  it("keeps idle and rejected states free of stale board highlights", () => {
    expect(projectBoardSelection({ status: "idle" })).toEqual({
      captureTargets: [],
      legalTargets: [],
      selectedSource: undefined,
    });
    expect(
      projectBoardSelection({ messageKey: "illegal-destination", status: "rejected" }),
    ).toEqual({
      captureTargets: [],
      legalTargets: [],
      selectedSource: undefined,
    });
  });

  it("derives unique quiet and capture targets from authoritative legal moves", () => {
    const source = parseSquare("e7");
    const selection = createSourceSelection(source, [
      legalMove("e7", "e8", "e8=Q+", "e7e8q", { promotion: "queen" }),
      legalMove("e7", "e8", "e8=N", "e7e8n", { promotion: "knight" }),
      legalMove("e7", "d8", "exd8=Q", "e7d8q", {
        captured: "rook",
        promotion: "queen",
      }),
    ]);
    expect(selection.legalTargets).toEqual([parseSquare("e8"), parseSquare("d8")]);
    expect(selection.captureTargets).toEqual([parseSquare("d8")]);
    expect(projectBoardSelection(selection)).toEqual({
      captureTargets: [parseSquare("d8")],
      legalTargets: [parseSquare("e8"), parseSquare("d8")],
      selectedSource: source,
    });
  });

  it("copies and freezes legal-move data owned by the transient selection", () => {
    const input = [legalMove("e2", "e4", "e4", "e2e4")];
    const selection = createSourceSelection(parseSquare("e2"), input);
    expect(Object.isFrozen(selection)).toBe(true);
    expect(Object.isFrozen(selection.legalMoves)).toBe(true);
    expect(Object.isFrozen(selection.legalMoves[0])).toBe(true);
    expect(selection.legalMoves[0]).not.toBe(input[0]);
  });

  it.each([
    ["illegal-move", "not available"],
    ["illegal-destination", "not available"],
    ["no-legal-moves", "no available move"],
    ["position-changed", "position changed"],
    ["wrong-turn", "not that participant's turn"],
    ["game-not-started", "Begin the game"],
    ["game-paused", "paused"],
    ["game-completed", "complete"],
    ["clock-expired", "clock expired"],
    ["persistence-pending", "must be saved"],
    ["promotion-required", "promotion piece"],
    ["operation-in-progress", "previous action"],
    ["no-active-game", "not available right now"],
    ["invalid-state", "not available right now"],
    ["temporarily-unavailable", "not available right now"],
  ] satisfies readonly (readonly [MoveFeedbackMessageKey, string])[])(
    "maps %s to calm visible copy",
    (messageKey, expected) => {
      expect(moveFeedbackMessage(messageKey)).toContain(expected);
    },
  );
});

function legalMove(
  from: string,
  to: string,
  san: string,
  uci: string,
  extra: Pick<LegalMove, "captured" | "promotion"> = {},
): LegalMove {
  return Object.freeze({
    color: "white",
    from: parseSquare(from),
    piece: "pawn",
    san: parseSanMove(san),
    to: parseSquare(to),
    uci: parseUciMove(uci),
    ...extra,
  });
}
