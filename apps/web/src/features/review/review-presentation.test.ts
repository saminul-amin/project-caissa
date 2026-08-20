import { describe, expect, it } from "vitest";

import type { GameReviewReport, ReviewedMove } from "../../application/review";
import {
  createAccuracyCard,
  createEvaluationCurve,
  createMoveRow,
  formatEvaluation,
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
