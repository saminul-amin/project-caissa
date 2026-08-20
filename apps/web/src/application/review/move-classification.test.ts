import { describe, expect, it } from "vitest";

import {
  assessMove,
  averageAccuracyPercent,
  classifyLoss,
  describeClassification,
  isCostlyClassification,
  moveAccuracyPercent,
  toComparableCentipawns,
  winProbability,
  MOVE_CLASSIFICATIONS,
} from "./move-classification";

describe("toComparableCentipawns", () => {
  it("keeps ordinary centipawn scores", () => {
    expect(toComparableCentipawns({ centipawns: 145 })).toBe(145);
    expect(toComparableCentipawns({ centipawns: -30 })).toBe(-30);
  });

  it("clamps extreme centipawn scores so one position cannot dominate the scale", () => {
    expect(toComparableCentipawns({ centipawns: 90_000 })).toBe(1_500);
    expect(toComparableCentipawns({ centipawns: -90_000 })).toBe(-1_500);
  });

  it("ranks a faster mate above a slower one and respects the sign", () => {
    const fast = toComparableCentipawns({ mateInMoves: 1 });
    const slow = toComparableCentipawns({ mateInMoves: 8 });
    expect(fast).toBeGreaterThan(slow);
    expect(toComparableCentipawns({ mateInMoves: -1 })).toBe(-fast);
  });

  it("treats a missing score as level", () => {
    expect(toComparableCentipawns({})).toBe(0);
    expect(toComparableCentipawns({ mateInMoves: 0 })).toBe(0);
  });
});

describe("winProbability", () => {
  it("is one half at a level evaluation", () => {
    expect(winProbability(0)).toBeCloseTo(0.5, 10);
  });

  it("increases with the evaluation and stays inside the unit interval", () => {
    expect(winProbability(300)).toBeGreaterThan(winProbability(100));
    expect(winProbability(-2_000)).toBeGreaterThan(0);
    expect(winProbability(2_000)).toBeLessThan(1);
  });
});

describe("classifyLoss", () => {
  it.each([
    [0, "excellent"],
    [0.01, "excellent"],
    [0.03, "good"],
    [0.07, "inaccuracy"],
    [0.14, "mistake"],
    [0.45, "blunder"],
  ])("maps an expected-score loss of %s to %s", (loss, expected) => {
    expect(classifyLoss(loss)).toBe(expected);
  });
});

describe("assessMove", () => {
  it("labels the engine's own choice as the best move even when the position worsens", () => {
    const assessment = assessMove({
      bestScoreBefore: { centipawns: -400 },
      playedIsEngineBest: true,
      scoreAfter: { centipawns: -450 },
    });
    expect(assessment.classification).toBe("best");
  });

  it("labels a large expected-score drop as a blunder", () => {
    const assessment = assessMove({
      bestScoreBefore: { centipawns: 40 },
      playedIsEngineBest: false,
      scoreAfter: { centipawns: -600 },
    });
    expect(assessment.classification).toBe("blunder");
    expect(assessment.expectedScoreLoss).toBeGreaterThan(0.2);
    expect(assessment.moveAccuracyPercent).toBeLessThan(60);
  });

  it("does not punish a move that keeps the evaluation", () => {
    const assessment = assessMove({
      bestScoreBefore: { centipawns: 20 },
      playedIsEngineBest: false,
      scoreAfter: { centipawns: 20 },
    });
    expect(assessment.classification).toBe("excellent");
    expect(assessment.expectedScoreLoss).toBe(0);
    expect(assessment.moveAccuracyPercent).toBeCloseTo(100, 0);
  });

  it("never reports a negative loss when the played move improves on the search", () => {
    const assessment = assessMove({
      bestScoreBefore: { centipawns: 0 },
      playedIsEngineBest: false,
      scoreAfter: { centipawns: 500 },
    });
    expect(assessment.expectedScoreLoss).toBe(0);
  });

  it("treats walking into a forced mate as the worst outcome", () => {
    const assessment = assessMove({
      bestScoreBefore: { centipawns: 0 },
      playedIsEngineBest: false,
      scoreAfter: { mateInMoves: -2 },
    });
    expect(assessment.classification).toBe("blunder");
    expect(assessment.winProbabilityAfter).toBeLessThan(assessment.winProbabilityBefore);
  });
});

describe("accuracy", () => {
  it("returns 100 for a perfect move and decreases monotonically", () => {
    expect(moveAccuracyPercent(0)).toBeCloseTo(100, 0);
    expect(moveAccuracyPercent(0.1)).toBeGreaterThan(moveAccuracyPercent(0.3));
    expect(moveAccuracyPercent(1)).toBeGreaterThanOrEqual(0);
  });

  it("guards against non-finite input", () => {
    expect(moveAccuracyPercent(Number.NaN)).toBeCloseTo(100, 0);
  });

  it("averages to one decimal place and reports nothing for an empty side", () => {
    expect(averageAccuracyPercent([90, 80])).toBe(85);
    expect(averageAccuracyPercent([90.05, 90.05])).toBe(90.1);
    expect(averageAccuracyPercent([])).toBeUndefined();
  });
});

describe("classification vocabulary", () => {
  it("describes every classification", () => {
    for (const classification of MOVE_CLASSIFICATIONS) {
      expect(describeClassification(classification).length).toBeGreaterThan(0);
    }
  });

  it("marks only the costly classifications as costly", () => {
    expect(MOVE_CLASSIFICATIONS.filter(isCostlyClassification)).toEqual([
      "inaccuracy",
      "mistake",
      "blunder",
    ]);
  });
});
