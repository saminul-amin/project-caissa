import { describe, expect, it, vi } from "vitest";

import { parseMonotonicTimestampMs } from "@caissa/chess-core";
import type { OpponentRuntimeStatus } from "../../application/opponent";
import type { ChessEnginePort, EngineStatus } from "../engine";
import { createEngineOpponentRuntime } from "./engine-opponent-runtime";

const monotonicClock = { now: () => parseMonotonicTimestampMs(1_000) };
const requestIdFactory = { create: () => "req-runtime" };

function stubEngine() {
  const listeners = new Set<(status: EngineStatus) => void>();
  const dispose = vi.fn();
  const stop = vi.fn();
  const engine: ChessEnginePort = {
    dispose,
    engineId: "engine",
    engineVersion: "1.0",
    getStatus: () => ({ state: "ready" }),
    initialize: () =>
      Promise.resolve({ engineId: "engine", engineVersion: "1.0", status: "ready" }),
    search: vi.fn<ChessEnginePort["search"]>(() =>
      Promise.resolve({ bestMove: "e7e5", lines: [], status: "completed" }),
    ),
    stop,
    subscribe: (listener) => {
      listeners.add(listener);
      listener({ state: "uninitialized" });
      return () => listeners.delete(listener);
    },
  };
  return {
    dispose,
    engine,
    emit(status: EngineStatus) {
      for (const listener of listeners) listener(status);
    },
    stop,
  };
}

/** A coordinator that reports a position no opponent owns, so no turn is ever run. */
const idleCoordinator = {
  getSession: () => ({
    clock: { status: "untimed" },
    configuration: {
      initialPosition: { kind: "standard" },
      participants: { black: { kind: "human" }, white: { kind: "human" } },
    },
    history: [],
    lifecycle: { phase: "player-turn" },
    position: { turn: "white" },
    revision: 0,
  }),
} as never;

function createSubject(createEngine?: () => never) {
  const stub = stubEngine();
  const runtime = createEngineOpponentRuntime({
    createEngine: createEngine ?? (() => ({ engine: stub.engine, status: "created" as const })),
    delay: { wait: () => Promise.resolve() },
    monotonicClock,
    random: { next: () => 0.5 },
    requestIdFactory,
  });
  return { runtime, stub };
}

describe("engine opponent runtime", () => {
  it("stays idle until a turn actually needs a move", () => {
    const createEngine = vi.fn();
    const runtime = createEngineOpponentRuntime({
      createEngine: createEngine as never,
      monotonicClock,
      requestIdFactory,
    });

    expect(runtime.getStatus()).toEqual({ kind: "idle" });
    expect(createEngine).not.toHaveBeenCalled();
  });

  it("publishes loading progress while the engine downloads", async () => {
    const { runtime, stub } = createSubject();
    const seen: OpponentRuntimeStatus[] = [];
    runtime.subscribe((status) => seen.push(status));

    await runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" });
    stub.emit({ progress: { loadedBytes: 1, ratio: 0.25, totalBytes: 4 }, state: "loading" });

    expect(seen).toContainEqual({ kind: "loading", ratio: 0.25 });
  });

  it("reports an indeterminate load before progress is known", async () => {
    const { runtime, stub } = createSubject();
    await runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" });

    stub.emit({ state: "loading" });

    expect(runtime.getStatus()).toEqual({ kind: "loading" });
  });

  it("reports thinking while the engine searches and ready afterwards", async () => {
    const { runtime, stub } = createSubject();
    await runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" });

    stub.emit({ state: "searching" });
    expect(runtime.getStatus()).toEqual({ kind: "thinking" });

    stub.emit({ state: "ready" });
    expect(runtime.getStatus()).toEqual({ kind: "ready" });
  });

  it("explains an unusable runtime instead of retrying forever", async () => {
    const createEngine = vi.fn(() => ({
      capabilities: {
        crossOriginIsolated: false,
        gaps: ["no-wasm-simd" as const],
        supported: false,
      },
      status: "unsupported" as const,
    }));
    const runtime = createEngineOpponentRuntime({
      createEngine,
      monotonicClock,
      requestIdFactory,
    });

    const outcome = await runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" });

    expect(outcome).toEqual({ reason: "unavailable", status: "degraded" });
    expect(runtime.getStatus()).toMatchObject({ kind: "unavailable" });
    expect((runtime.getStatus() as { detail: string }).detail).toContain("SIMD");
  });

  it("surfaces an engine failure as an unavailable opponent", async () => {
    const { runtime, stub } = createSubject();
    await runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" });

    stub.emit({ reason: "load-failed", state: "failed" });

    expect(runtime.getStatus()).toMatchObject({ kind: "unavailable" });
  });

  it("disposes the engine once and refuses further work", async () => {
    const { runtime, stub } = createSubject();
    await runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" });

    runtime.dispose();
    runtime.dispose();

    expect(stub.dispose).toHaveBeenCalledOnce();
    await expect(
      runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" }),
    ).resolves.toEqual({ reason: "unavailable", status: "degraded" });
  });

  it("cancels without starting an engine that was never needed", () => {
    const createEngine = vi.fn();
    const runtime = createEngineOpponentRuntime({
      createEngine: createEngine as never,
      monotonicClock,
      requestIdFactory,
    });

    expect(() => {
      runtime.cancel();
    }).not.toThrow();
    expect(createEngine).not.toHaveBeenCalled();
  });

  it("stops the running search when cancelled after starting", async () => {
    const { runtime, stub } = createSubject();
    await runtime.runTurn({ coordinator: idleCoordinator, profileId: "club" });

    runtime.cancel();

    expect(stub.stop).toHaveBeenCalled();
  });
});
