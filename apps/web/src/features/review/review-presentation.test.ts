import { describe, expect, it } from "vitest";

import type { GameReviewReport, ReviewedMove } from "../../application/review";
import {
  accuracyBarPercent,
  createAccuracyCard,
  createEvaluationCurve,
  createMoveRow,
  createReviewBoardModel,
  curveMarkerPosition,
  defaultReviewPly,
  findReviewedMove,
  formatEvaluation,
  stepKeyMoment,
  stepReviewPly,
  summaryHeadline,
  toSvgPolyline,
} from "./review-presentation";

function move(overrides: Partial<ReviewedMove> = {}): ReviewedMove {
  return {
    classification: "good",
    engineBestMove: "e2e4" as never,
    engineBestMoveSan: "e4" as never,
    expectedScoreLoss: 0.03,
    fenBefore: "8/8/8/8/8/8/8/8 w - - 0 1" as never,
    moveNumber: 1,
    mover: "white",
    ply: 1,
    san: "d4" as never,
    scoreAfterCentipawns: 30,
    uci: "d2d4" as never,
    winProbabilityAfter: 0.55,
    winProbabilityBefore: 0.58,
    ...overrides,
  };
}

function report(overrides: Partial<GameReviewReport> = {}): GameReviewReport {
  return {
    analysisDepth: 14,
    black: {
      accuracyPercent: 80.1,
      bestMoves: 1,
      blunders: 2,
      inaccuracies: 3,
      mistakes: 4,
      moveCount: 10,
    },
    engineId: "engine",
    engineVersion: "1.0",
    gameId: "game" as never,
    keyMoments: [],
    moves: [move()],
    white: {
      accuracyPercent: undefined,
      bestMoves: 0,
      blunders: 0,
      inaccuracies: 0,
      mistakes: 0,
      moveCount: 0,
    },
    ...overrides,
  };
}

describe("createAccuracyCard", () => {
  it("renders an accuracy percentage and the counts", () => {
    const card = createAccuracyCard("black", "Black", report().black);
    expect(card.accuracyLabel).toBe("80.1%");
    expect(card.countsLabel).toBe("1 best · 3 inaccuracies · 4 mistakes · 2 blunders");
  });

  it("shows a dash when a side played no moves", () => {
    expect(createAccuracyCard("white", "White", report().white).accuracyLabel).toBe("—");
  });
});

describe("createEvaluationCurve", () => {
  it("expresses every point from White's perspective", () => {
    const curve = createEvaluationCurve(
      report({
        moves: [
          move({ mover: "white", ply: 1, winProbabilityAfter: 0.7 }),
          move({ mover: "black", ply: 2, winProbabilityAfter: 0.7 }),
        ],
      }),
    );
    expect(curve[0]?.height).toBeCloseTo(0.7, 10);
    expect(curve[1]?.height).toBeCloseTo(0.3, 10);
  });

  it("clamps a non-finite probability to the middle", () => {
    const curve = createEvaluationCurve(
      report({ moves: [move({ winProbabilityAfter: Number.NaN })] }),
    );
    expect(curve[0]?.height).toBe(0.5);
  });
});

describe("toSvgPolyline", () => {
  it("returns nothing for an empty curve", () => {
    expect(toSvgPolyline([], 100, 50)).toBe("");
  });

  it("draws a flat line through a single point", () => {
    expect(toSvgPolyline([{ height: 0.9, ply: 1 }], 100, 50)).toBe("0,25 100,25");
  });

  it("spreads points across the width and inverts the vertical axis", () => {
    expect(
      toSvgPolyline(
        [
          { height: 1, ply: 1 },
          { height: 0, ply: 2 },
          { height: 0.5, ply: 3 },
        ],
        100,
        50,
      ),
    ).toBe("0,0 50,50 100,25");
  });
});

describe("createMoveRow", () => {
  it("numbers White and Black moves distinctly", () => {
    expect(createMoveRow(move({ mover: "white", moveNumber: 7 })).numberLabel).toBe("7.");
    expect(createMoveRow(move({ mover: "black", moveNumber: 7 })).numberLabel).toBe("7…");
  });

  it("suggests an alternative only for costly moves", () => {
    expect(createMoveRow(move({ classification: "good" })).suggestionLabel).toBeUndefined();
    expect(createMoveRow(move({ classification: "blunder" })).suggestionLabel).toBe(
      "Engine prefers e4",
    );
  });

  it("omits a suggestion when the engine move could not be translated", () => {
    expect(
      createMoveRow(move({ classification: "mistake", engineBestMoveSan: undefined }))
        .suggestionLabel,
    ).toBeUndefined();
  });
});

describe("formatEvaluation", () => {
  it("always reads from White's point of view", () => {
    expect(formatEvaluation(150, "white")).toBe("+1.5");
    expect(formatEvaluation(150, "black")).toBe("-1.5");
    expect(formatEvaluation(0, "white")).toBe("0.0");
  });
});

describe("summaryHeadline", () => {
  it("adapts to how many key moments were found", () => {
    expect(summaryHeadline(report({ keyMoments: [] }))).toContain("No costly mistakes");
    expect(
      summaryHeadline(report({ keyMoments: [{ explanation: "e", headline: "h", ply: 1 }] })),
    ).toContain("One moment");
    expect(
      summaryHeadline(
        report({
          keyMoments: [
            { explanation: "e", headline: "h", ply: 1 },
            { explanation: "e", headline: "h", ply: 9 },
          ],
        }),
      ),
    ).toContain("2 moments");
  });
});

describe("review board and navigation", () => {
  const threeMoves = report({
    keyMoments: [{ explanation: "x", headline: "Move 2: Bc4", ply: 3 }],
    moves: [
      move({ ply: 1, winProbabilityAfter: 0.6 }),
      move({ mover: "black", ply: 2, winProbabilityAfter: 0.5 }),
      move({
        moveNumber: 2,
        ply: 3,
        san: "Bc4" as never,
        uci: "f1c4" as never,
        winProbabilityAfter: 0.2,
      }),
    ],
  });

  it("shows the position before the move with the move itself marked", () => {
    const model = createReviewBoardModel(
      move({ moveNumber: 2, san: "Bc4" as never, uci: "f1c4" as never }),
    );
    expect(model.fen).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
    expect(model.lastMove).toEqual({ from: "f1", to: "c4" });
    expect(model.turn).toBe("white");
    expect(model.description).toBe("Position before move 2, Bc4 by White");
    expect(createReviewBoardModel(move({ mover: "black" })).description).toContain("by Black");
  });

  it("opens on the first key moment, or the last move when nothing stood out", () => {
    expect(defaultReviewPly(threeMoves)).toBe(3);
    expect(defaultReviewPly(report({ keyMoments: [], moves: threeMoves.moves }))).toBe(3);
    expect(defaultReviewPly(report({ keyMoments: [], moves: [] }))).toBeUndefined();
    expect(findReviewedMove(threeMoves, 2)?.mover).toBe("black");
    expect(findReviewedMove(threeMoves, 9)).toBeUndefined();
  });

  it("steps through plies and clamps at both ends", () => {
    expect(stepReviewPly(threeMoves, 2, "next")).toBe(3);
    expect(stepReviewPly(threeMoves, 3, "next")).toBe(3);
    expect(stepReviewPly(threeMoves, 2, "previous")).toBe(1);
    expect(stepReviewPly(threeMoves, 1, "previous")).toBe(1);
    expect(stepReviewPly(threeMoves, 2, "first")).toBe(1);
    expect(stepReviewPly(threeMoves, 2, "last")).toBe(3);
    expect(stepReviewPly(report({ moves: [] }), 4, "next")).toBe(4);
  });

  it("steps between key moments in either direction", () => {
    expect(stepKeyMoment(threeMoves, 1, "next")).toBe(3);
    expect(stepKeyMoment(threeMoves, 3, "next")).toBeUndefined();
    expect(stepKeyMoment(threeMoves, 3, "previous")).toBeUndefined();
    expect(
      stepKeyMoment(
        report({
          keyMoments: [
            { explanation: "", headline: "", ply: 1 },
            { explanation: "", headline: "", ply: 3 },
          ],
        }),
        3,
        "previous",
      ),
    ).toBe(1);
  });

  it("places the curve marker as chart percentages", () => {
    const curve = createEvaluationCurve(threeMoves);
    expect(curveMarkerPosition(curve, 1)).toEqual({ leftPercent: 0, topPercent: 40 });
    expect(curveMarkerPosition(curve, 2)).toEqual({ leftPercent: 50, topPercent: 50 });
    expect(curveMarkerPosition(curve, 3)).toEqual({ leftPercent: 100, topPercent: 80 });
    expect(curveMarkerPosition(curve, 7)).toBeUndefined();
    expect(
      curveMarkerPosition(createEvaluationCurve(report({ moves: [move({ ply: 1 })] })), 1)
        ?.leftPercent,
    ).toBe(50);
  });

  it("turns accuracy into a bar length and leaves unknown accuracy empty", () => {
    expect(accuracyBarPercent({ ...threeMoves.black, accuracyPercent: 80.1 })).toBe(80.1);
    expect(accuracyBarPercent({ ...threeMoves.black, accuracyPercent: undefined })).toBe(0);
    expect(accuracyBarPercent({ ...threeMoves.black, accuracyPercent: 140 })).toBe(100);
  });
});
