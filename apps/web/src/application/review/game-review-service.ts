import {
  parseFen,
  parseUciMove,
  type ChessRulesPort,
  type Fen,
  type GameId,
  type SanMove,
  type UciMove,
} from "@caissa/chess-core";

import type { GameHistoryDetail, GameHistoryService } from "../history";
import {
  ANALYSIS_CACHE_SCHEMA_VERSION,
  createAnalysisCacheKey,
  REVIEW_SCHEMA_VERSION,
  type AnalysisCacheRepository,
  type JsonValue,
  type ReviewRepository,
  type WallClock,
} from "../persistence";
import {
  assessMove,
  averageAccuracyPercent,
  isCostlyClassification,
  moveAccuracyPercent,
  toComparableCentipawns,
  type MoveClassification,
  type PositionScore,
} from "./move-classification";
import type {
  AnalysisEnginePort,
  GameReviewReport,
  GameReviewResult,
  GameReviewService,
  GenerateReviewCommand,
  KeyMoment,
  PositionAnalysis,
  ReviewedMove,
  ReviewedSideSummary,
} from "./review-types";

export const REVIEW_ANALYSIS_PROFILE = "review-v1";
export const REVIEW_CONFIGURATION_VERSION = "1";
export const REVIEW_ANALYSIS_DEPTH = 14;
const maximumReviewedPlies = 400;
const maximumKeyMoments = 4;

export interface CreateGameReviewServiceOptions {
  readonly analysisCacheRepository: AnalysisCacheRepository;
  readonly analysisEngine: AnalysisEnginePort;
  readonly createRules: () => ChessRulesPort;
  readonly historyService: GameHistoryService;
  readonly reviewRepository: ReviewRepository;
  readonly wallClock: WallClock;
}

export function createGameReviewService(
  options: CreateGameReviewServiceOptions,
): GameReviewService {
  return new DefaultGameReviewService(options);
}

class DefaultGameReviewService implements GameReviewService {
  private cancelled = false;

  constructor(private readonly options: CreateGameReviewServiceOptions) {}

  cancel(): void {
    this.cancelled = true;
    this.options.analysisEngine.cancel();
  }

  async generateReview(command: GenerateReviewCommand): Promise<GameReviewResult> {
    this.cancelled = false;

    const detail = await this.options.historyService.getGame(command.gameId);
    if (detail.status === "not-found") return frozen({ status: "game-not-found" });
    if (detail.status !== "found") {
      return frozen({
        reason: "Caissa could not read that game from local storage.",
        status: "unavailable",
      });
    }

    const positions = collectPositions(detail.detail);
    if (positions.length < 2) {
      return frozen({
        reason: "This game has no moves to review.",
        status: "unavailable",
      });
    }

    await this.markReviewStatus(command.gameId, "in-progress");

    const analyses: PositionAnalysis[] = [];
    for (const [index, fen] of positions.entries()) {
      if (this.isCancelled(command)) {
        await this.markReviewStatus(command.gameId, "partial");
        return frozen({ status: "cancelled" });
      }

      const analysis = await this.analyzePosition(fen);
      if (!analysis) {
        await this.markReviewStatus(command.gameId, "failed");
        return frozen({
          reason: "The analysis engine is unavailable, so this review cannot be completed.",
          status: "unavailable",
        });
      }

      analyses.push(analysis);
      command.onProgress?.({ analyzedPositions: index + 1, totalPositions: positions.length });
    }

    const report = buildReport(
      detail.detail,
      analyses,
      this.options.analysisEngine,
      createSanResolver(this.options.createRules),
    );
    await this.markReviewStatus(command.gameId, "completed");
    return frozen({ report, status: "completed" });
  }

  private isCancelled(command: GenerateReviewCommand): boolean {
    return this.cancelled || command.signal?.cancelled === true;
  }

  private async analyzePosition(fen: Fen): Promise<PositionAnalysis | undefined> {
    const cached = await this.readCache(fen);
    if (cached) return cached;

    const result = await this.options.analysisEngine.analyze({
      fen,
      moves: [],
      startsFromInitialPosition: false,
    });
    if (result.status !== "analyzed") return undefined;

    await this.writeCache(fen, result.analysis);
    return result.analysis;
  }

  private cacheKey(fen: Fen) {
    return createAnalysisCacheKey({
      analysisProfile: REVIEW_ANALYSIS_PROFILE,
      configurationVersion: REVIEW_CONFIGURATION_VERSION,
      engineId: this.options.analysisEngine.engineId,
      engineVersion: this.options.analysisEngine.engineVersion,
      fen,
    });
  }

  private async readCache(fen: Fen): Promise<PositionAnalysis | undefined> {
    try {
      const read = await this.options.analysisCacheRepository.get(this.cacheKey(fen));
      return read.status === "hit" ? decodeAnalysis(read.entry.payload) : undefined;
    } catch {
      return undefined;
    }
  }

  private async writeCache(fen: Fen, analysis: PositionAnalysis): Promise<void> {
    try {
      await this.options.analysisCacheRepository.set({
        cacheVersion: ANALYSIS_CACHE_SCHEMA_VERSION,
        createdAt: this.options.wallClock.nowEpochMs(),
        identity: {
          analysisProfile: REVIEW_ANALYSIS_PROFILE,
          configurationVersion: REVIEW_CONFIGURATION_VERSION,
          engineId: this.options.analysisEngine.engineId,
          engineVersion: this.options.analysisEngine.engineVersion,
          fen,
        },
        key: this.cacheKey(fen),
        payload: encodeAnalysis(analysis),
      });
    } catch {
      /* The cache is an optimization; a failed write must never fail a review. */
    }
  }

  private async markReviewStatus(
    gameId: GameId,
    status: "completed" | "failed" | "in-progress" | "partial",
  ): Promise<void> {
    const now = this.options.wallClock.nowEpochMs();
    try {
      await this.options.reviewRepository.saveReview({
        gameId,
        provenance: [
          {
            identifier: this.options.analysisEngine.engineId,
            provider: "stockfish",
            version: this.options.analysisEngine.engineVersion,
          },
          {
            identifier: REVIEW_ANALYSIS_PROFILE,
            provider: "deterministic",
            version: REVIEW_CONFIGURATION_VERSION,
          },
        ],
        reviewVersion: REVIEW_SCHEMA_VERSION,
        status,
        updatedAt: now,
        ...(status === "completed" ? { generatedAt: now } : {}),
      });
    } catch {
      /* Review metadata is a convenience; failing to record it must not fail the review. */
    }
  }
}

function collectPositions(detail: GameHistoryDetail): readonly Fen[] {
  const history = detail.checkpoint.history.slice(0, maximumReviewedPlies);
  if (history.length === 0) return Object.freeze([]);

  const positions = history.map((record) => record.fenBefore);
  const last = history.at(-1);
  if (last) positions.push(last.fenAfter);
  return Object.freeze(positions);
}

type SanResolver = (fen: Fen, uci: UciMove | undefined) => SanMove | undefined;

/**
 * Engine suggestions arrive in UCI. Players read standard notation, so every suggestion is
 * translated through the authoritative rules; an untranslatable move is simply omitted.
 */
function createSanResolver(createRules: () => ChessRulesPort): SanResolver {
  let rules: ChessRulesPort | undefined;
  return (fen, uci) => {
    if (uci === undefined) return undefined;
    try {
      rules ??= createRules();
      rules.loadFen(fen);
      return rules.getLegalMoves().find((move) => move.uci === uci)?.san;
    } catch {
      return undefined;
    }
  };
}

function buildReport(
  detail: GameHistoryDetail,
  analyses: readonly PositionAnalysis[],
  engine: AnalysisEnginePort,
  resolveSan: SanResolver,
): GameReviewReport {
  const history = detail.checkpoint.history.slice(0, maximumReviewedPlies);
  const moves: ReviewedMove[] = [];

  for (const [index, record] of history.entries()) {
    const before = analyses[index];
    const after = analyses[index + 1];
    if (!before || !after) break;

    const scoreAfter = negateScore(after.score);
    const assessment = assessMove({
      bestScoreBefore: before.score,
      playedIsEngineBest: before.bestMove === record.uci,
      scoreAfter,
    });

    moves.push(
      Object.freeze({
        classification: assessment.classification,
        engineBestMove: before.bestMove,
        engineBestMoveSan: resolveSan(record.fenBefore, before.bestMove),
        expectedScoreLoss: assessment.expectedScoreLoss,
        fenBefore: record.fenBefore,
        moveNumber: Math.floor(index / 2) + 1,
        mover: record.mover,
        ply: index + 1,
        san: record.san,
        scoreAfterCentipawns: toComparableCentipawns(scoreAfter),
        uci: record.uci,
        winProbabilityAfter: assessment.winProbabilityAfter,
        winProbabilityBefore: assessment.winProbabilityBefore,
      }),
    );
  }

  return Object.freeze({
    analysisDepth: analyses[0]?.depth ?? REVIEW_ANALYSIS_DEPTH,
    black: summarize(moves, "black"),
    engineId: engine.engineId,
    engineVersion: engine.engineVersion,
    gameId: detail.gameId,
    keyMoments: selectKeyMoments(moves),
    moves: Object.freeze(moves),
    white: summarize(moves, "white"),
  });
}

function summarize(moves: readonly ReviewedMove[], color: "black" | "white"): ReviewedSideSummary {
  const own = moves.filter((move) => move.mover === color);
  const count = (classification: MoveClassification) =>
    own.filter((move) => move.classification === classification).length;

  return Object.freeze({
    accuracyPercent: averageAccuracyPercent(
      own.map((move) => moveAccuracyPercent(move.expectedScoreLoss)),
    ),
    bestMoves: count("best"),
    blunders: count("blunder"),
    inaccuracies: count("inaccuracy"),
    mistakes: count("mistake"),
    moveCount: own.length,
  });
}

/**
 * Key moments are the costliest decisions, spread across the game so a single bad phase
 * cannot crowd out everything else worth seeing.
 */
export function selectKeyMoments(moves: readonly ReviewedMove[]): readonly KeyMoment[] {
  const candidates = moves
    .filter((move) => isCostlyClassification(move.classification))
    .sort((left, right) => right.expectedScoreLoss - left.expectedScoreLoss);

  const chosen: ReviewedMove[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= maximumKeyMoments) break;
    if (chosen.some((existing) => Math.abs(existing.ply - candidate.ply) < 4)) continue;
    chosen.push(candidate);
  }

  return Object.freeze(
    chosen
      .sort((left, right) => left.ply - right.ply)
      .map((move) => Object.freeze(describeMoment(move))),
  );
}

function describeMoment(move: ReviewedMove): KeyMoment {
  const side = move.mover === "white" ? "White" : "Black";
  const suggestion = move.engineBestMoveSan
    ? ` The engine prefers ${String(move.engineBestMoveSan)}.`
    : "";
  const swing = Math.round(move.expectedScoreLoss * 100);

  return {
    explanation: `${side} played ${String(move.san)}, which lowers ${side}'s expected result by about ${String(swing)} percentage points.${suggestion}`,
    headline: `Move ${String(move.moveNumber)}: ${String(move.san)}`,
    ply: move.ply,
  };
}

function negateScore(score: PositionScore): PositionScore {
  return Object.freeze({
    ...(score.centipawns === undefined ? {} : { centipawns: -score.centipawns }),
    ...(score.mateInMoves === undefined ? {} : { mateInMoves: -score.mateInMoves }),
  });
}

function encodeAnalysis(analysis: PositionAnalysis): JsonValue {
  return Object.freeze({
    bestMove: analysis.bestMove === undefined ? null : String(analysis.bestMove),
    centipawns: analysis.score.centipawns ?? null,
    depth: analysis.depth,
    mateInMoves: analysis.score.mateInMoves ?? null,
  });
}

function decodeAnalysis(payload: JsonValue): PositionAnalysis | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const record = payload as Readonly<Record<string, JsonValue>>;
  if (typeof record.depth !== "number") return undefined;

  let bestMove: UciMove | undefined;
  if (typeof record.bestMove === "string") {
    try {
      bestMove = parseUciMove(record.bestMove);
    } catch {
      return undefined;
    }
  }

  return Object.freeze({
    bestMove,
    depth: record.depth,
    score: Object.freeze({
      ...(typeof record.centipawns === "number" ? { centipawns: record.centipawns } : {}),
      ...(typeof record.mateInMoves === "number" ? { mateInMoves: record.mateInMoves } : {}),
    }),
  });
}

/** Exposed for tests that need a valid FEN without importing the chess adapter. */
export const REVIEW_START_POSITION: Fen = parseFen(
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
);

function frozen(result: GameReviewResult): GameReviewResult {
  return Object.freeze(result);
}
