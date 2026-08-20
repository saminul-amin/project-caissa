import { ChessJsRulesAdapter, parseGameId, parseUciMove } from "@caissa/chess-core";
import { describe, expect, it, vi } from "vitest";

import { createGameHistoryService } from "../history";
import type { AnalysisCacheRepository, CompletedGameRecord } from "../persistence";
import {
  MemoryGameRepository,
  MemoryReviewRepository,
  at,
  createControllerFixture,
} from "../../test/application-service-test-kit";
import { FixedWallClock } from "../../test/persistence-test-kit";
import { createGameReviewService, selectKeyMoments } from "./game-review-service";
import type { AnalysisEnginePort, PositionAnalysisResult, ReviewedMove } from "./review-types";

/** A four-ply game in which White hangs a bishop and Black takes it. */
const scriptedMoves = ["e2e4", "d7d5", "f1c4", "d5c4"];

function memoryAnalysisCache(): AnalysisCacheRepository & { readonly writes: number[] } {
  const store = new Map<string, unknown>();
  const writes: number[] = [];
  return {
    clear: () => {
      store.clear();
      return Promise.resolve({ status: "saved" as const });
    },
    delete: (key) => {
      store.delete(key);
      return Promise.resolve({ status: "saved" as const });
    },
    deleteExpired: () => Promise.resolve({ deletedCount: 0, status: "cleaned" as const }),
    get: (key) => {
      const entry = store.get(key);
      return Promise.resolve(
        entry === undefined
          ? { status: "miss" as const }
          : { entry: entry as never, status: "hit" as const },
      );
    },
    set: (entry) => {
      writes.push(writes.length);
      store.set(entry.key, entry);
      return Promise.resolve({ status: "saved" as const });
    },
    writes,
  };
}

async function seedCompletedGame(repository: MemoryGameRepository): Promise<CompletedGameRecord> {
  const controller = createControllerFixture({ black: "external-opponent", id: "review-game" });
  controller.start(at(1_000));
  for (const [index, uci] of scriptedMoves.entries()) {
    const now = at(1_100 + index * 100);
    if (index % 2 === 0) {
      controller.submitHumanMove({ move: moveFrom(uci), now });
    } else {
      const requestId = `req-${String(index)}` as never;
      const request = controller.requestOpponentMove({ requestId });
      if (request.status !== "applied") throw new Error("Fixture could not open a request.");
      controller.commitOpponentMove(
        {
          expectedFen: request.request.expectedFen,
          expectedPly: request.request.expectedPly,
          expectedRevision: request.request.expectedRevision,
          move: moveFrom(uci),
          requestId,
          requestedColor: request.request.requestedColor,
        },
        now,
      );
    }
  }
  controller.abandon({ now: at(2_000) });

  const record: CompletedGameRecord = {
    checkpoint: controller.exportCheckpoint(),
    completedAt: 1_700_000_000_000 as never,
    gameId: parseGameId("review-game"),
    pgn: controller.exportPgn(),
    result: controller.getSession().result ?? {
      isDraw: false,
      reason: "abandoned",
      status: "abandoned",
    },
  };
  await repository.saveCompletedGame(record);
  return record;
}

function moveFrom(uci: string) {
  const rules = new ChessJsRulesAdapter();
  void rules;
  return {
    from: uci.slice(0, 2) as never,
    to: uci.slice(2, 4) as never,
  };
}

/**
 * Returns a level score for every position except the one after White hangs the bishop,
 * which is scored decisively for Black.
 */
function scriptedEngine(
  overrides: Partial<Record<number, PositionAnalysisResult>> = {},
): AnalysisEnginePort & { readonly calls: string[] } {
  const calls: string[] = [];
  let index = -1;
  return {
    calls,
    engineId: "test-engine",
    engineVersion: "1.0",
    analyze: vi.fn((request: { readonly fen: string }) => {
      index += 1;
      calls.push(request.fen);
      const override = overrides[index];
      if (override) return Promise.resolve(override);
      const centipawns = index >= 4 ? -350 : index === 3 ? 350 : 20;
      return Promise.resolve({
        analysis: {
          bestMove: parseUciMove("e2e4"),
          depth: 14,
          score: { centipawns },
        },
        status: "analyzed" as const,
      });
    }),
    cancel: vi.fn(),
  };
}

function createSubject(engine: AnalysisEnginePort, cache = memoryAnalysisCache()) {
  const gameRepository = new MemoryGameRepository();
  const reviewRepository = new MemoryReviewRepository();
  const service = createGameReviewService({
    analysisCacheRepository: cache,
    analysisEngine: engine,
    createRules: () => new ChessJsRulesAdapter(),
    historyService: createGameHistoryService({ gameRepository, reviewRepository }),
    reviewRepository,
    wallClock: new FixedWallClock(),
  });
  return { cache, gameRepository, reviewRepository, service };
}

describe("GameReviewService", () => {
  it("reviews every move and records who played it", async () => {
    const engine = scriptedEngine();
    const { gameRepository, service } = createSubject(engine);
    await seedCompletedGame(gameRepository);

    const result = await service.generateReview({ gameId: parseGameId("review-game") });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.report.moves).toHaveLength(4);
    expect(result.report.moves.map((move) => move.mover)).toEqual([
      "white",
      "black",
      "white",
      "black",
    ]);
    expect(engine.calls).toHaveLength(5);
  });

  it("analyses each position exactly once, in order", async () => {
    const engine = scriptedEngine();
    const { gameRepository, service } = createSubject(engine);
    await seedCompletedGame(gameRepository);

    await service.generateReview({ gameId: parseGameId("review-game") });

    expect(new Set(engine.calls).size).toBe(engine.calls.length);
  });

  it("names the costly move as a key moment with a readable suggestion", async () => {
    const engine = scriptedEngine();
    const { gameRepository, service } = createSubject(engine);
    await seedCompletedGame(gameRepository);

    const result = await service.generateReview({ gameId: parseGameId("review-game") });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.report.keyMoments).toHaveLength(1);
    expect(result.report.keyMoments[0]?.headline).toContain("Bc4");
    expect(result.report.moves[2]?.classification).toBe("blunder");
  });

  it("reports progress for every analysed position", async () => {
    const engine = scriptedEngine();
    const { gameRepository, service } = createSubject(engine);
    await seedCompletedGame(gameRepository);
    const seen: number[] = [];

    await service.generateReview({
      gameId: parseGameId("review-game"),
      onProgress: (progress) => seen.push(progress.analyzedPositions),
    });

    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it("reuses cached analysis on a second run", async () => {
    const engine = scriptedEngine();
    const cache = memoryAnalysisCache();
    const { gameRepository, service } = createSubject(engine, cache);
    await seedCompletedGame(gameRepository);

    await service.generateReview({ gameId: parseGameId("review-game") });
    const callsAfterFirst = engine.calls.length;
    await service.generateReview({ gameId: parseGameId("review-game") });

    expect(engine.calls).toHaveLength(callsAfterFirst);
  });

  it("records the review status so history can show it", async () => {
    const engine = scriptedEngine();
    const { gameRepository, reviewRepository, service } = createSubject(engine);
    await seedCompletedGame(gameRepository);

    await service.generateReview({ gameId: parseGameId("review-game") });

    const stored = await reviewRepository.getReview(parseGameId("review-game"));
    expect(stored).toMatchObject({ record: { status: "completed" }, status: "found" });
  });

  it("stops cleanly when the caller cancels", async () => {
    const engine = scriptedEngine();
    const { gameRepository, service } = createSubject(engine);
    await seedCompletedGame(gameRepository);
    const signal = { cancelled: true };

    await expect(
      service.generateReview({ gameId: parseGameId("review-game"), signal }),
    ).resolves.toEqual({ status: "cancelled" });
    expect(engine.calls).toHaveLength(0);
  });

  it("reports an unavailable engine instead of a partial report", async () => {
    const engine = scriptedEngine({ 2: { status: "unavailable" } });
    const { gameRepository, reviewRepository, service } = createSubject(engine);
    await seedCompletedGame(gameRepository);

    const result = await service.generateReview({ gameId: parseGameId("review-game") });

    expect(result.status).toBe("unavailable");
    const stored = await reviewRepository.getReview(parseGameId("review-game"));
    expect(stored).toMatchObject({ record: { status: "failed" } });
  });

  it("reports a missing game rather than failing", async () => {
    const { service } = createSubject(scriptedEngine());
    await expect(service.generateReview({ gameId: parseGameId("absent") })).resolves.toEqual({
      status: "game-not-found",
    });
  });

  it("forwards cancellation to the engine", () => {
    const cancel = vi.fn();
    const engine = { ...scriptedEngine(), cancel };
    const { service } = createSubject(engine);
    service.cancel();
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("selectKeyMoments", () => {
  function reviewed(ply: number, loss: number, classification = "blunder") {
    return {
      classification,
      engineBestMove: "e2e4",
      engineBestMoveSan: "e4",
      expectedScoreLoss: loss,
      fenBefore: "8/8/8/8/8/8/8/8 w - - 0 1",
      moveNumber: Math.ceil(ply / 2),
      mover: ply % 2 === 1 ? "white" : "black",
      ply,
      san: "Qh5",
      scoreAfterCentipawns: -100,
      uci: "d1h5",
      winProbabilityAfter: 0.2,
      winProbabilityBefore: 0.6,
    } as unknown as ReviewedMove;
  }

  it("ignores moves that were not costly", () => {
    expect(selectKeyMoments([reviewed(1, 0.01, "excellent"), reviewed(9, 0, "best")])).toEqual([]);
  });

  it("keeps only the costliest move within a short window", () => {
    const moments = selectKeyMoments([reviewed(5, 0.4), reviewed(6, 0.3), reviewed(20, 0.2)]);
    expect(moments.map((moment) => moment.ply)).toEqual([5, 20]);
  });

  it("caps the number of moments and reports them in game order", () => {
    const moments = selectKeyMoments([
      reviewed(1, 0.5),
      reviewed(10, 0.45),
      reviewed(20, 0.4),
      reviewed(30, 0.35),
      reviewed(40, 0.3),
    ]);
    expect(moments).toHaveLength(4);
    expect(moments.map((moment) => moment.ply)).toEqual([1, 10, 20, 30]);
  });

  it("explains the cost in percentage points and names the mover", () => {
    const [moment] = selectKeyMoments([reviewed(2, 0.25)]);
    expect(moment?.explanation).toContain("Black played Qh5");
    expect(moment?.explanation).toContain("25 percentage points");
    expect(moment?.explanation).toContain("The engine prefers e4.");
  });
});

describe("GameReviewService degraded inputs", () => {
  function historyStub(result: unknown) {
    return {
      clearHistory: vi.fn(),
      createPgnExport: vi.fn(),
      deleteGame: vi.fn(),
      getGame: vi.fn(() => Promise.resolve(result)),
      listGames: vi.fn(),
    } as never;
  }

  function subjectWith(historyService: never) {
    return createGameReviewService({
      analysisCacheRepository: memoryAnalysisCache(),
      analysisEngine: scriptedEngine(),
      createRules: () => new ChessJsRulesAdapter(),
      historyService,
      reviewRepository: new MemoryReviewRepository(),
      wallClock: new FixedWallClock(),
    });
  }

  it("reports unavailable storage without exposing the storage error", async () => {
    const service = subjectWith(
      historyStub({ error: { code: "database-closed" }, status: "storage-unavailable" }),
    );

    await expect(service.generateReview({ gameId: parseGameId("game") })).resolves.toEqual({
      reason: "Caissa could not read that game from local storage.",
      status: "unavailable",
    });
  });

  it("declines to review a game with no moves", async () => {
    const service = subjectWith(
      historyStub({
        detail: {
          checkpoint: { configuration: {}, history: [] },
          completedAt: 0,
          gameId: parseGameId("game"),
          pgn: "",
          result: { isDraw: false, reason: "abandoned", status: "abandoned" },
          review: undefined,
          summary: {},
        },
        status: "found",
      }),
    );

    await expect(service.generateReview({ gameId: parseGameId("game") })).resolves.toEqual({
      reason: "This game has no moves to review.",
      status: "unavailable",
    });
  });

  it("still completes when the analysis cache is unusable", async () => {
    const engine = scriptedEngine();
    const gameRepository = new MemoryGameRepository();
    const service = createGameReviewService({
      analysisCacheRepository: {
        clear: () => Promise.resolve({ status: "saved" }),
        delete: () => Promise.resolve({ status: "saved" }),
        deleteExpired: () => Promise.resolve({ deletedCount: 0, status: "cleaned" }),
        get: () => Promise.reject(new Error("cache read failed")),
        set: () => Promise.reject(new Error("cache write failed")),
      },
      analysisEngine: engine,
      createRules: () => new ChessJsRulesAdapter(),
      historyService: createGameHistoryService({
        gameRepository,
        reviewRepository: new MemoryReviewRepository(),
      }),
      reviewRepository: new MemoryReviewRepository(),
      wallClock: new FixedWallClock(),
    });
    await seedCompletedGame(gameRepository);

    const result = await service.generateReview({ gameId: parseGameId("review-game") });

    expect(result.status).toBe("completed");
  });

  it("omits the suggestion when the rules cannot translate the engine move", async () => {
    const engine = scriptedEngine();
    const gameRepository = new MemoryGameRepository();
    const service = createGameReviewService({
      analysisCacheRepository: memoryAnalysisCache(),
      analysisEngine: engine,
      createRules: () => {
        throw new Error("rules unavailable");
      },
      historyService: createGameHistoryService({
        gameRepository,
        reviewRepository: new MemoryReviewRepository(),
      }),
      reviewRepository: new MemoryReviewRepository(),
      wallClock: new FixedWallClock(),
    });
    await seedCompletedGame(gameRepository);

    const result = await service.generateReview({ gameId: parseGameId("review-game") });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.report.moves.every((move) => move.engineBestMoveSan === undefined)).toBe(true);
    expect(result.report.keyMoments[0]?.explanation).not.toContain("prefers");
  });

  it("re-analyses rather than trusting a corrupt cache entry", async () => {
    const engine = scriptedEngine();
    const gameRepository = new MemoryGameRepository();
    const service = createGameReviewService({
      analysisCacheRepository: {
        clear: () => Promise.resolve({ status: "saved" }),
        delete: () => Promise.resolve({ status: "saved" }),
        deleteExpired: () => Promise.resolve({ deletedCount: 0, status: "cleaned" }),
        get: () =>
          Promise.resolve({
            entry: { payload: { bestMove: "not-a-move", depth: 3 } } as never,
            status: "hit" as const,
          }),
        set: () => Promise.resolve({ status: "saved" }),
      },
      analysisEngine: engine,
      createRules: () => new ChessJsRulesAdapter(),
      historyService: createGameHistoryService({
        gameRepository,
        reviewRepository: new MemoryReviewRepository(),
      }),
      reviewRepository: new MemoryReviewRepository(),
      wallClock: new FixedWallClock(),
    });
    await seedCompletedGame(gameRepository);

    const result = await service.generateReview({ gameId: parseGameId("review-game") });

    expect(result.status).toBe("completed");
    expect(engine.calls.length).toBeGreaterThan(0);
  });
});
