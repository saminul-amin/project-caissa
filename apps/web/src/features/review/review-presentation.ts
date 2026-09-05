import type { Square } from "@caissa/chess-core";

import {
  describeClassification,
  type GameReviewReport,
  type MoveClassification,
  type ReviewedMove,
  type ReviewedSideSummary,
} from "../../application/review";

export interface AccuracyCardModel {
  readonly accuracyLabel: string;
  readonly color: "black" | "white";
  readonly countsLabel: string;
  readonly name: string;
}

export interface EvaluationPoint {
  /** 0 at the bottom of the chart, 1 at the top, always from White's point of view. */
  readonly height: number;
  readonly ply: number;
}

export function createAccuracyCard(
  color: "black" | "white",
  name: string,
  summary: ReviewedSideSummary,
): AccuracyCardModel {
  return Object.freeze({
    accuracyLabel:
      summary.accuracyPercent === undefined ? "—" : `${String(summary.accuracyPercent)}%`,
    color,
    countsLabel: `${String(summary.bestMoves)} best · ${String(summary.inaccuracies)} inaccuracies · ${String(summary.mistakes)} mistakes · ${String(summary.blunders)} blunders`,
    name,
  });
}

/**
 * Builds the evaluation curve from White's point of view so a rising line always means
 * White is doing better, which is the only reading that stays intuitive across a game.
 */
export function createEvaluationCurve(report: GameReviewReport): readonly EvaluationPoint[] {
  return Object.freeze(
    report.moves.map((move) => {
      const fromMover = move.winProbabilityAfter;
      const fromWhite = move.mover === "white" ? fromMover : 1 - fromMover;
      return Object.freeze({ height: clampUnit(fromWhite), ply: move.ply });
    }),
  );
}

export function toSvgPolyline(
  points: readonly EvaluationPoint[],
  width: number,
  height: number,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `0,${String(height / 2)} ${String(width)},${String(height / 2)}`;

  const step = width / (points.length - 1);
  return points
    .map(
      (point, index) =>
        `${String(round(index * step))},${String(round((1 - point.height) * height))}`,
    )
    .join(" ");
}

export interface MoveRowModel {
  readonly classification: MoveClassification;
  readonly classificationLabel: string;
  readonly evaluationLabel: string;
  readonly isNoteworthy: boolean;
  readonly numberLabel: string;
  readonly ply: number;
  readonly san: string;
  readonly suggestionLabel: string | undefined;
}

export function createMoveRow(move: ReviewedMove): MoveRowModel {
  const showSuggestion =
    move.classification === "inaccuracy" ||
    move.classification === "mistake" ||
    move.classification === "blunder";

  return Object.freeze({
    classification: move.classification,
    classificationLabel: describeClassification(move.classification),
    evaluationLabel: formatEvaluation(move.scoreAfterCentipawns, move.mover),
    isNoteworthy: showSuggestion,
    numberLabel:
      move.mover === "white" ? `${String(move.moveNumber)}.` : `${String(move.moveNumber)}…`,
    ply: move.ply,
    san: String(move.san),
    suggestionLabel:
      showSuggestion && move.engineBestMoveSan
        ? `Engine prefers ${String(move.engineBestMoveSan)}`
        : undefined,
  });
}

/** Formats a score from the mover's perspective into the conventional White-positive form. */
export function formatEvaluation(centipawnsFromMover: number, mover: "black" | "white"): string {
  const fromWhite = mover === "white" ? centipawnsFromMover : -centipawnsFromMover;
  const pawns = fromWhite / 100;
  const sign = pawns > 0 ? "+" : "";
  return `${sign}${pawns.toFixed(1)}`;
}

export function summaryHeadline(report: GameReviewReport): string {
  const decisive = report.keyMoments.length;
  if (decisive === 0) return "No costly mistakes stood out in this game.";
  return decisive === 1
    ? "One moment changed this game the most."
    : `${String(decisive)} moments changed this game the most.`;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/* Board and navigation --------------------------------------------------------- */

export interface ReviewBoardModel {
  readonly description: string;
  readonly fen: ReviewedMove["fenBefore"];
  readonly lastMove: Readonly<{ readonly from: Square; readonly to: Square }>;
  readonly turn: ReviewedMove["mover"];
}

/**
 * The board shows the position in which a move was chosen, with that move marked. Showing
 * the moment of decision rather than its aftermath is what makes a key moment legible.
 */
export function createReviewBoardModel(move: ReviewedMove): ReviewBoardModel {
  const uci = String(move.uci);
  return Object.freeze({
    description: `Position before move ${String(move.moveNumber)}, ${String(move.san)} by ${move.mover === "white" ? "White" : "Black"}`,
    fen: move.fenBefore,
    lastMove: Object.freeze({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square }),
    turn: move.mover,
  });
}

export function findReviewedMove(report: GameReviewReport, ply: number): ReviewedMove | undefined {
  return report.moves.find((move) => move.ply === ply);
}

/** The first key moment is the natural place to open, falling back to the final move. */
export function defaultReviewPly(report: GameReviewReport): number | undefined {
  return report.keyMoments[0]?.ply ?? report.moves.at(-1)?.ply;
}

export type ReviewStep = "first" | "last" | "next" | "previous";

export function stepReviewPly(
  report: GameReviewReport,
  currentPly: number,
  step: ReviewStep,
): number {
  const plies = report.moves.map((move) => move.ply);
  if (plies.length === 0) return currentPly;
  const index = Math.max(0, plies.indexOf(currentPly));
  switch (step) {
    case "first":
      return plies[0] ?? currentPly;
    case "last":
      return plies.at(-1) ?? currentPly;
    case "next":
      return plies[Math.min(plies.length - 1, index + 1)] ?? currentPly;
    case "previous":
      return plies[Math.max(0, index - 1)] ?? currentPly;
  }
}

/** Steps between key moments; when the current ply is not a key moment, moves to the nearest one in that direction. */
export function stepKeyMoment(
  report: GameReviewReport,
  currentPly: number,
  direction: "next" | "previous",
): number | undefined {
  const plies = report.keyMoments.map((moment) => moment.ply);
  if (direction === "next") return plies.find((ply) => ply > currentPly);
  return plies.filter((ply) => ply < currentPly).at(-1);
}

export interface CurveMarkerPosition {
  /** Percentages of the chart box, so the marker can sit in HTML over a stretched SVG. */
  readonly leftPercent: number;
  readonly topPercent: number;
}

export function curveMarkerPosition(
  points: readonly EvaluationPoint[],
  ply: number,
): CurveMarkerPosition | undefined {
  const index = points.findIndex((point) => point.ply === ply);
  const point = points[index];
  if (!point) return undefined;
  const leftPercent = points.length <= 1 ? 50 : (index / (points.length - 1)) * 100;
  return Object.freeze({
    leftPercent: round(leftPercent),
    topPercent: round((1 - point.height) * 100),
  });
}

/** Accuracy as a bar length; an unknown accuracy is an empty bar rather than a guess. */
export function accuracyBarPercent(summary: ReviewedSideSummary): number {
  return summary.accuracyPercent === undefined ? 0 : clampUnit(summary.accuracyPercent / 100) * 100;
}
