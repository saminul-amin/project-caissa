/**
 * Deterministic move assessment.
 *
 * Centipawns are a poor scale for judging human decisions: losing 100 centipawns from a
 * level position matters far more than losing it while already winning. Every judgement
 * here is therefore made on expected-score change, not raw centipawns.
 */

export const MOVE_CLASSIFICATIONS = [
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
] as const;

export type MoveClassification = (typeof MOVE_CLASSIFICATIONS)[number];

export interface PositionScore {
  readonly centipawns?: number;
  /** Positive means the side to move mates in this many moves. */
  readonly mateInMoves?: number;
}

/** Centipawn ceiling used when a forced mate is converted to a comparable score. */
const mateEquivalentCentipawns = 2_000;
const maximumComparableCentipawns = 1_500;

/** Logistic scale factor. 0.00368 is the widely used Lichess win-probability constant. */
const winProbabilityScale = 0.00368208;

const thresholds: readonly {
  readonly classification: MoveClassification;
  readonly loss: number;
}[] = Object.freeze([
  { classification: "blunder", loss: 0.2 },
  { classification: "mistake", loss: 0.1 },
  { classification: "inaccuracy", loss: 0.05 },
  { classification: "good", loss: 0.02 },
  { classification: "excellent", loss: 0 },
]);

/** Converts an engine score, always from the side to move, to comparable centipawns. */
export function toComparableCentipawns(score: PositionScore): number {
  if (score.mateInMoves !== undefined && score.mateInMoves !== 0) {
    const sign = score.mateInMoves > 0 ? 1 : -1;
    const distancePenalty = Math.min(Math.abs(score.mateInMoves), 20) * 10;
    return sign * (mateEquivalentCentipawns - distancePenalty);
  }
  const centipawns = score.centipawns ?? 0;
  return clamp(centipawns, -maximumComparableCentipawns, maximumComparableCentipawns);
}

/** Expected score in `[0, 1]` for the side to move. */
export function winProbability(centipawns: number): number {
  return 1 / (1 + Math.exp(-winProbabilityScale * centipawns));
}

export interface MoveAssessmentInput {
  /** Best available score for the mover, before the move, from the mover's perspective. */
  readonly bestScoreBefore: PositionScore;
  readonly playedIsEngineBest: boolean;
  /** Score after the played move, already converted to the mover's perspective. */
  readonly scoreAfter: PositionScore;
}

export interface MoveAssessment {
  readonly classification: MoveClassification;
  /** Expected-score loss in `[0, 1]`. */
  readonly expectedScoreLoss: number;
  readonly moveAccuracyPercent: number;
  readonly winProbabilityAfter: number;
  readonly winProbabilityBefore: number;
}

export function assessMove(input: MoveAssessmentInput): MoveAssessment {
  const before = winProbability(toComparableCentipawns(input.bestScoreBefore));
  const after = winProbability(toComparableCentipawns(input.scoreAfter));
  const loss = clamp(before - after, 0, 1);

  return Object.freeze({
    classification: input.playedIsEngineBest ? "best" : classifyLoss(loss),
    expectedScoreLoss: loss,
    moveAccuracyPercent: moveAccuracyPercent(loss),
    winProbabilityAfter: after,
    winProbabilityBefore: before,
  });
}

export function classifyLoss(loss: number): MoveClassification {
  for (const threshold of thresholds) {
    if (loss >= threshold.loss) return threshold.classification;
  }
  return "excellent";
}

/**
 * Per-move accuracy on the published Lichess curve, which maps expected-score loss to a
 * 0-100 scale. It is an estimate of decision quality, not a measurement of skill.
 */
export function moveAccuracyPercent(expectedScoreLoss: number): number {
  const lossPercent = clamp(expectedScoreLoss, 0, 1) * 100;
  const raw = 103.1668 * Math.exp(-0.04354 * lossPercent) - 3.1669;
  return clamp(raw, 0, 100);
}

/** Mean per-move accuracy. Returns undefined when a side made no moves. */
export function averageAccuracyPercent(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

export function describeClassification(classification: MoveClassification): string {
  switch (classification) {
    case "best":
      return "Best move";
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "inaccuracy":
      return "Inaccuracy";
    case "mistake":
      return "Mistake";
    case "blunder":
      return "Blunder";
  }
}

export function isCostlyClassification(classification: MoveClassification): boolean {
  return (
    classification === "inaccuracy" || classification === "mistake" || classification === "blunder"
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
