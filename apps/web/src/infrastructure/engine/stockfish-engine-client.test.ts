import { describe, expect, it } from "vitest";

import { detectEngineCapabilities, describeEngineCapabilityGap } from "./engine-capabilities";
import type { EngineTransport, EngineTransportHandlers } from "./engine-transport";
import { createStockfishEngineClient, type EngineScheduler } from "./stockfish-engine-client";

const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface FakeEngine {
  readonly commands: string[];
  readonly transport: EngineTransport;
  emit(line: string): void;
  handlers(): EngineTransportHandlers;
}

/** Replays a scripted engine so protocol behaviour can be asserted without WebAssembly. */
function createFakeEngine(options: { readonly autoRespond?: boolean } = {}) {
  const commands: string[] = [];
  let captured: EngineTransportHandlers | undefined;
  let terminated = false;

  const engine: FakeEngine = {
    commands,
    emit(line) {
      captured?.onLine(line);
    },
    handlers() {
      if (!captured) throw new Error("Transport was never created.");
      return captured;
    },
    transport: {
      post(command) {
        commands.push(command);
        if (options.autoRespond !== false && (command === "isready" || command === "uci")) {
          queueMicrotask(() => {
            captured?.onLine(command === "uci" ? "uciok" : "readyok");
          });
        }
      },
      terminate() {
        terminated = true;
      },
    },
  };

  return {
    engine,
    isTerminated: () => terminated,
    createTransport: (handlers: EngineTransportHandlers) => {
      captured = handlers;
      return engine.transport;
    },
  };
}

/** Runs every scheduled callback immediately on demand so timeouts are deterministic. */
function createManualScheduler() {
  const pending = new Set<() => void>();
  const scheduler: EngineScheduler = {
    schedule(_delayMs, callback) {
      pending.add(callback);
      return () => pending.delete(callback);
    },
  };
  return {
    fireAll() {
      for (const callback of [...pending]) {
        pending.delete(callback);
        callback();
      }
    },
    pendingCount: () => pending.size,
    scheduler,
  };
}

describe("StockfishEngineClient", () => {
  it("initializes once, records the engine name, and reaches ready", async () => {
    const fake = createFakeEngine();
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });

    const initialization = client.initialize();
    queueMicrotask(() => {
      fake.engine.emit("id name Stockfish 18");
    });
    const first = await initialization;
    const second = await client.initialize();

    expect(first).toEqual({
      engineId: "stockfish",
      engineVersion: "Stockfish 18",
      status: "ready",
    });
    expect(second).toEqual(first);
    expect(fake.engine.commands.filter((command) => command === "uci")).toHaveLength(1);
    expect(fake.engine.commands).toContain("setoption name Threads value 1");
    expect(client.getStatus().state).toBe("ready");
  });

  it("returns the best move with the collected principal variation", async () => {
    const fake = createFakeEngine();
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });

    const search = client.search({
      fen: startFen,
      limits: { movetimeMs: 100 },
      moves: [],
      newGame: true,
      options: { multiPv: 1, skillLevel: 6 },
      startsFromInitialPosition: true,
    });

    await waitFor(() => fake.engine.commands.includes("go movetime 100"));
    fake.engine.emit("info depth 12 multipv 1 score cp 24 pv e2e4 e7e5");
    fake.engine.emit("bestmove e2e4 ponder e7e5");

    await expect(search).resolves.toEqual({
      bestMove: "e2e4",
      lines: [{ depth: 12, moves: ["e2e4", "e7e5"], multipv: 1, scoreCentipawns: 24 }],
      status: "completed",
    });
    expect(fake.engine.commands).toContain("ucinewgame");
    expect(fake.engine.commands).toContain("setoption name Skill Level value 6");
    expect(fake.engine.commands).toContain("position startpos");
  });

  it("reports no-move when the engine has nothing to play", async () => {
    const fake = createFakeEngine();
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });

    const search = client.search({
      fen: startFen,
      limits: { depth: 8 },
      moves: [],
      startsFromInitialPosition: false,
    });
    await waitFor(() => fake.engine.commands.includes("go depth 8"));
    fake.engine.emit("bestmove (none)");

    await expect(search).resolves.toEqual({ lines: [], status: "no-move" });
  });

  it("applies and then clears a strength limit exactly once per change", async () => {
    const fake = createFakeEngine();
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });

    const first = client.search({
      fen: startFen,
      limits: { movetimeMs: 10 },
      moves: [],
      options: { limitStrengthElo: 1500, skillLevel: 3 },
      startsFromInitialPosition: false,
    });
    await waitFor(() => fake.engine.commands.includes("go movetime 10"));
    fake.engine.emit("bestmove e2e4");
    await first;

    const second = client.search({
      fen: startFen,
      limits: { movetimeMs: 10 },
      moves: [],
      options: { skillLevel: 3 },
      startsFromInitialPosition: false,
    });
    await waitFor(
      () => fake.engine.commands.filter((command) => command === "go movetime 10").length === 2,
    );
    fake.engine.emit("bestmove d2d4");
    await second;

    expect(
      fake.engine.commands.filter((c) => c === "setoption name UCI_Elo value 1500"),
    ).toHaveLength(1);
    expect(
      fake.engine.commands.filter((c) => c === "setoption name UCI_LimitStrength value false"),
    ).toHaveLength(1);
    expect(
      fake.engine.commands.filter((c) => c === "setoption name Skill Level value 3"),
    ).toHaveLength(1);
  });

  it("stops a running search and still resolves from the engine reply", async () => {
    const fake = createFakeEngine();
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });

    const search = client.search({
      fen: startFen,
      limits: { movetimeMs: 5_000 },
      moves: [],
      startsFromInitialPosition: false,
    });
    await waitFor(() => fake.engine.commands.includes("go movetime 5000"));

    client.stop();
    expect(fake.engine.commands).toContain("stop");
    expect(client.getStatus().state).toBe("stopping");
    fake.engine.emit("bestmove c2c4");

    await expect(search).resolves.toMatchObject({ bestMove: "c2c4", status: "completed" });
    expect(client.getStatus().state).toBe("ready");
  });

  it("fails the search and marks the engine unhealthy when a stop is ignored", async () => {
    const fake = createFakeEngine();
    const manual = createManualScheduler();
    const client = createStockfishEngineClient({
      createTransport: fake.createTransport,
      scheduler: manual.scheduler,
    });

    const initialization = client.initialize();
    fake.engine.emit("readyok");
    await initialization;

    const search = client.search({
      fen: startFen,
      limits: { movetimeMs: 50 },
      moves: [],
      startsFromInitialPosition: false,
    });
    await waitFor(
      () => fake.engine.commands.includes("isready"),
      () => {
        fake.engine.emit("readyok");
      },
    );
    await waitFor(() => fake.engine.commands.includes("go movetime 50"));

    manual.fireAll();
    expect(fake.engine.commands).toContain("stop");
    manual.fireAll();

    await expect(search).resolves.toEqual({ reason: "timeout", status: "failed" });
    expect(client.getStatus()).toEqual({ reason: "timeout", state: "failed" });
  });

  it("fails initialization when the engine never answers", async () => {
    const fake = createFakeEngine({ autoRespond: false });
    const manual = createManualScheduler();
    const client = createStockfishEngineClient({
      createTransport: fake.createTransport,
      scheduler: manual.scheduler,
    });

    const initialization = client.initialize();
    await Promise.resolve();
    manual.fireAll();

    await expect(initialization).resolves.toEqual({ reason: "timeout", status: "failed" });
    await expect(
      client.search({
        fen: startFen,
        limits: { movetimeMs: 1 },
        moves: [],
        startsFromInitialPosition: false,
      }),
    ).resolves.toEqual({ reason: "timeout", status: "failed" });
  });

  it("reports a transport failure as an unavailable engine", async () => {
    const fake = createFakeEngine();
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });
    const initialization = client.initialize();
    fake.engine.handlers().onError(new Error("worker died"));

    await expect(initialization).resolves.toEqual({ reason: "load-failed", status: "failed" });
  });

  it("publishes download progress while loading", async () => {
    const fake = createFakeEngine({ autoRespond: false });
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });
    const seen: number[] = [];
    client.subscribe((status) => {
      if (status.progress) seen.push(status.progress.ratio);
    });

    void client.initialize();
    await Promise.resolve();
    fake.engine.handlers().onProgress({ loadedBytes: 50, ratio: 0.5, totalBytes: 100 });

    expect(seen).toEqual([0.5]);
  });

  it("terminates the transport and refuses further work once disposed", async () => {
    const fake = createFakeEngine();
    const client = createStockfishEngineClient({ createTransport: fake.createTransport });
    await client.initialize();

    client.dispose();
    client.dispose();

    expect(fake.isTerminated()).toBe(true);
    expect(client.getStatus().state).toBe("terminated");
    await expect(
      client.search({
        fen: startFen,
        limits: { movetimeMs: 1 },
        moves: [],
        startsFromInitialPosition: false,
      }),
    ).resolves.toEqual({ reason: "terminated", status: "failed" });
  });

  it("reports an unsupported transport construction as a load failure", async () => {
    const client = createStockfishEngineClient({
      createTransport: () => {
        throw new Error("no workers");
      },
    });
    await expect(client.initialize()).resolves.toEqual({
      reason: "load-failed",
      status: "failed",
    });
  });
});

describe("engine capability detection", () => {
  it("reports every missing capability", () => {
    const report = detectEngineCapabilities({});
    expect(report.supported).toBe(false);
    expect(report.gaps).toEqual(["no-worker", "no-wasm"]);
    expect(describeEngineCapabilityGap("no-worker")).toContain("background workers");
  });

  it("detects a runtime without WebAssembly SIMD", () => {
    const report = detectEngineCapabilities({
      WebAssembly: { validate: () => false } as unknown as typeof WebAssembly,
      Worker: function Worker() {
        /* stub */
      },
    });
    expect(report.gaps).toEqual(["no-wasm-simd"]);
    expect(describeEngineCapabilityGap("no-wasm-simd")).toContain("SIMD");
  });

  it("treats a throwing validator as missing SIMD", () => {
    const report = detectEngineCapabilities({
      WebAssembly: {
        validate: () => {
          throw new Error("boom");
        },
      } as unknown as typeof WebAssembly,
      Worker: function Worker() {
        /* stub */
      },
    });
    expect(report.supported).toBe(false);
  });

  it("accepts a fully capable runtime and records isolation", () => {
    const report = detectEngineCapabilities({
      crossOriginIsolated: true,
      WebAssembly: { validate: () => true } as unknown as typeof WebAssembly,
      Worker: function Worker() {
        /* stub */
      },
    });
    expect(report).toEqual({ crossOriginIsolated: true, gaps: [], supported: true });
  });
});

async function waitFor(predicate: () => boolean, onTick?: () => void): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    onTick?.();
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for the engine transport.");
}
