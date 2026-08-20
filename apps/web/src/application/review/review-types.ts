import type { Color, Fen, GameId, SanMove, UciMove } from "@caissa/chess-core";

import type { MoveClassification, PositionScore } from "./move-classification";

export interface AnalysisRequest {
  readonly fen: Fen;
  readonly moves: readonly UciMove[];
  readonly multiPv?: number;
  readonly startsFromInitialPosition: boolean;
}

export interface PositionAnalysis {
  readonly bestMove: UciMove | undefined;
  readonly depth: number;
  readonly score: PositionScore;
}

export type PositionAnalysisResult =
  | { readonly analysis: PositionAnalysis; readonly status: "analyzed" }
  | { readonly status: "cancelled" }
  | { readonly status: "unavailable" };

/**
 * The review boundary onto the engine. Kept separate from the opponent boundary because
 * review searches are deeper, cancellable, and must not compete with a live game.
 */
export interface AnalysisEnginePort {
  readonly engineId: string;
  readonly engineVersion: string;
  analyze(request: AnalysisRequest): Promise<PositionAnalysisResult>;
  cancel(): void;
}

export interface ReviewedMove {
  readonly classification: MoveClassification;
  readonly engineBestMove: UciMove | undefined;
  /** Standard notation for the engine suggestion; absent when it cannot be resolved. */
  readonly engineBestMoveSan: SanMove | undefined;
  readonly expectedScoreLoss: number;
  readonly fenBefore: Fen;
  readonly moveNumber: number;
  readonly mover: Color;
  readonly ply: number;
  readonly san: SanMove;
  readonly scoreAfterCentipawns: number;
  readonly uci: UciMove;
  readonly winProbabilityAfter: number;
  readonly winProbabilityBefore: number;
}

export interface ReviewedSideSummary {
  readonly accuracyPercent: number | undefined;
  readonly blunders: number;
  readonly bestMoves: number;
  readonly inaccuracies: number;
  readonly mistakes: number;
  readonly moveCount: number;
}

export interface KeyMoment {
  readonly explanation: string;
  readonly headline: string;
  readonly ply: number;
}

export interface GameReviewReport {
  readonly analysisDepth: number;
  readonly black: ReviewedSideSummary;
  readonly engineId: string;
  readonly engineVersion: string;
  readonly gameId: GameId;
  readonly keyMoments: readonly KeyMoment[];
  readonly moves: readonly ReviewedMove[];
  readonly white: ReviewedSideSummary;
}

export interface ReviewProgress {
  readonly analyzedPositions: number;
  readonly totalPositions: number;
}

export type GameReviewResult =
  | { readonly report: GameReviewReport; readonly status: "completed" }
  | { readonly status: "cancelled" }
  | { readonly status: "game-not-found" }
  | { readonly reason: string; readonly status: "unavailable" };

export interface GenerateReviewCommand {
  readonly gameId: GameId;
  readonly onProgress?: (progress: ReviewProgress) => void;
  readonly signal?: { readonly cancelled: boolean };
}

export interface GameReviewService {
  cancel(): void;
  generateReview(command: GenerateReviewCommand): Promise<GameReviewResult>;
}
