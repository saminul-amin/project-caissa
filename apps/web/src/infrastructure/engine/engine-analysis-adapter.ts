import { parseUciMove } from "@caissa/chess-core";

import {
  REVIEW_ANALYSIS_DEPTH,
  type AnalysisEnginePort,
  type AnalysisRequest,
  type PositionAnalysisResult,
} from "../../application/review";
import { createBundledEngine, type CreateBundledEngineResult } from "./create-engine";
import type { ChessEnginePort } from "./engine-port";

export interface CreateEngineAnalysisAdapterOptions {
  readonly createEngine?: () => CreateBundledEngineResult;
  readonly depth?: number;
  readonly engine?: ChessEnginePort;
  readonly movetimeCeilingMs?: number;
}

const defaultMovetimeCeilingMs = 2_500;

/**
 * Review-side engine adapter.
 *
 * Analysis is depth-limited with a wall-clock ceiling so a long game cannot leave the
 * player waiting on an unbounded search, and so results stay reproducible enough to cache.
 */
export function createEngineAnalysisAdapter(
  options: CreateEngineAnalysisAdapterOptions = {},
): AnalysisEnginePort {
  const depth = options.depth ?? REVIEW_ANALYSIS_DEPTH;
  const movetimeMs = options.movetimeCeilingMs ?? defaultMovetimeCeilingMs;
  const createEngine = options.createEngine ?? (() => createBundledEngine());

  let engine: ChessEnginePort | undefined = options.engine;
  let unsupported = false;

  function resolveEngine(): ChessEnginePort | undefined {
    if (engine || unsupported) return engine;
    const created = createEngine();
    if (created.status === "unsupported") {
      unsupported = true;
      return undefined;
    }
    engine = created.engine;
    return engine;
  }

  return Object.freeze({
    get engineId() {
      return engine?.engineId ?? "stockfish";
    },
    get engineVersion() {
      return engine?.engineVersion ?? "unknown";
    },

    async analyze(request: AnalysisRequest): Promise<PositionAnalysisResult> {
      const active = resolveEngine();
      if (!active) return Object.freeze({ status: "unavailable" as const });

      const search = await active.search({
        fen: request.fen,
        limits: { depth, movetimeMs },
        moves: request.moves.map((move) => String(move)),
        options: { multiPv: request.multiPv ?? 1 },
        startsFromInitialPosition: request.startsFromInitialPosition,
      });

      if (search.status === "failed") {
        return Object.freeze({
          status: search.reason === "cancelled" ? ("cancelled" as const) : ("unavailable" as const),
        });
      }

      const principal = search.lines.find((line) => line.multipv === 1) ?? search.lines[0];
      const bestMoveToken = search.status === "completed" ? search.bestMove : undefined;

      return Object.freeze({
        analysis: Object.freeze({
          bestMove: safeUciMove(bestMoveToken),
          depth: principal?.depth ?? depth,
          score: Object.freeze({
            ...(principal?.scoreCentipawns === undefined
              ? {}
              : { centipawns: principal.scoreCentipawns }),
            ...(principal?.scoreMateInMoves === undefined
              ? {}
              : { mateInMoves: principal.scoreMateInMoves }),
          }),
        }),
        status: "analyzed" as const,
      });
    },

    cancel() {
      engine?.stop();
    },
  });
}

function safeUciMove(token: string | undefined) {
  if (token === undefined) return undefined;
  try {
    return parseUciMove(token);
  } catch {
    return undefined;
  }
}
