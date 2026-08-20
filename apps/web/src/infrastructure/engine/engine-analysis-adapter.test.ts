import { describe, expect, it, vi } from "vitest";

import { createEngineAnalysisAdapter } from "./engine-analysis-adapter";
import type { ChessEnginePort, EngineSearchResult } from "./engine-port";

const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" as never;

function stubEngine(result: EngineSearchResult) {
  const search = vi.fn(() => Promise.resolve(result));
  const stop = vi.fn();
  const engine: ChessEnginePort = {
    dispose: vi.fn(),
    engineId: "stockfish-test",
    engineVersion: "18-test",
    getStatus: () => ({ state: "ready" }),
    initialize: () =>
      Promise.resolve({ engineId: "stockfish-test", engineVersion: "18-test", status: "ready" }),
    search,
    stop,
    subscribe: () => () => undefined,
  };
  return { engine, search, stop };
}

const request = Object.freeze({ fen, moves: [], startsFromInitialPosition: false });

describe("engine analysis adapter", () => {
  it("returns the principal line and the best move", async () => {
    const { engine } = stubEngine({
      bestMove: "e2e4",
      lines: [{ depth: 16, moves: ["e2e4"], multipv: 1, scoreCentipawns: 31 }],
      status: "completed",
    });

    await expect(createEngineAnalysisAdapter({ engine }).analyze(request)).resolves.toEqual({
      analysis: { bestMove: "e2e4", depth: 16, score: { centipawns: 31 } },
      status: "analyzed",
    });
  });

  it("carries a mate score through unchanged", async () => {
    const { engine } = stubEngine({
      bestMove: "d1h5",
      lines: [{ depth: 9, moves: ["d1h5"], multipv: 1, scoreMateInMoves: 2 }],
      status: "completed",
    });

    const result = await createEngineAnalysisAdapter({ engine }).analyze(request);

    expect(result).toMatchObject({ analysis: { score: { mateInMoves: 2 } }, status: "analyzed" });
  });

  it("bounds the search by both depth and wall clock", async () => {
    const { engine, search } = stubEngine({ bestMove: "e2e4", lines: [], status: "completed" });

    await createEngineAnalysisAdapter({ depth: 12, engine, movetimeCeilingMs: 900 }).analyze(
      request,
    );

    expect(search).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ limits: { depth: 12, movetimeMs: 900 } }),
    );
  });

  it("still reports an analysis when the engine ends without a best move", async () => {
    const { engine } = stubEngine({ lines: [], status: "no-move" });

    await expect(createEngineAnalysisAdapter({ engine }).analyze(request)).resolves.toMatchObject({
      analysis: { bestMove: undefined },
      status: "analyzed",
    });
  });

  it("drops an unparsable best move rather than passing it to the review", async () => {
    const { engine } = stubEngine({ bestMove: "zzzz", lines: [], status: "completed" });

    await expect(createEngineAnalysisAdapter({ engine }).analyze(request)).resolves.toMatchObject({
      analysis: { bestMove: undefined },
    });
  });

  it("distinguishes cancellation from an unavailable engine", async () => {
    const cancelled = stubEngine({ reason: "cancelled", status: "failed" });
    await expect(
      createEngineAnalysisAdapter({ engine: cancelled.engine }).analyze(request),
    ).resolves.toEqual({ status: "cancelled" });

    const failed = stubEngine({ reason: "load-failed", status: "failed" });
    await expect(
      createEngineAnalysisAdapter({ engine: failed.engine }).analyze(request),
    ).resolves.toEqual({ status: "unavailable" });
  });

  it("reports unavailable, once, when the runtime cannot host the engine", async () => {
    const createEngine = vi.fn(() => ({
      capabilities: { crossOriginIsolated: false, gaps: ["no-wasm" as const], supported: false },
      status: "unsupported" as const,
    }));
    const adapter = createEngineAnalysisAdapter({ createEngine });

    await expect(adapter.analyze(request)).resolves.toEqual({ status: "unavailable" });
    await expect(adapter.analyze(request)).resolves.toEqual({ status: "unavailable" });
    expect(createEngine).toHaveBeenCalledOnce();
    expect(adapter.engineId).toBe("stockfish");
  });

  it("creates the engine once and exposes its identity for cache keys", async () => {
    const { engine } = stubEngine({ bestMove: "e2e4", lines: [], status: "completed" });
    const createEngine = vi.fn(() => ({ engine, status: "created" as const }));
    const adapter = createEngineAnalysisAdapter({ createEngine });

    await adapter.analyze(request);
    await adapter.analyze(request);

    expect(createEngine).toHaveBeenCalledOnce();
    expect(adapter.engineId).toBe("stockfish-test");
    expect(adapter.engineVersion).toBe("18-test");
  });

  it("forwards cancellation to the running search", async () => {
    const { engine, stop } = stubEngine({ bestMove: "e2e4", lines: [], status: "completed" });
    const adapter = createEngineAnalysisAdapter({ engine });

    await adapter.analyze(request);
    adapter.cancel();

    expect(stop).toHaveBeenCalledOnce();
  });
});
