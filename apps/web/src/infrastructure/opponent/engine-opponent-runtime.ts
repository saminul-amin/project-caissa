import {
  createOpponentTurnService,
  type MonotonicClockPort,
  type OpponentRuntime,
  type OpponentRuntimeStatus,
  type OpponentTurnOutcome,
  type OpponentTurnRequest,
  type RequestIdFactory,
} from "../../application/opponent";
import {
  createBundledEngine,
  describeEngineCapabilityGap,
  type ChessEnginePort,
  type CreateBundledEngineResult,
  type EngineStatus,
} from "../engine";
import {
  createEngineOpponentProvider,
  type DelayPort,
  type RandomSource,
} from "./engine-opponent-provider";

export interface CreateEngineOpponentRuntimeOptions {
  readonly createEngine?: () => CreateBundledEngineResult;
  readonly delay?: DelayPort;
  readonly monotonicClock: MonotonicClockPort;
  readonly random?: RandomSource;
  readonly requestIdFactory: RequestIdFactory;
}

const engineUnavailableDetail =
  "The chess engine could not start in this browser, so engine games are unavailable.";

/**
 * Lazily starts the bundled engine.
 *
 * Local two-player games must never pay for the engine download, so nothing is loaded
 * until the first opponent turn actually needs a move.
 */
export function createEngineOpponentRuntime(
  options: CreateEngineOpponentRuntimeOptions,
): OpponentRuntime {
  const listeners = new Set<(status: OpponentRuntimeStatus) => void>();
  const createEngine = options.createEngine ?? (() => createBundledEngine());

  let status: OpponentRuntimeStatus = Object.freeze({ kind: "idle" as const });
  let engine: ChessEnginePort | undefined;
  let unsubscribeEngine: (() => void) | undefined;
  let turnService: ReturnType<typeof createOpponentTurnService> | undefined;
  let disposed = false;
  let turnInFlight = false;

  function publish(next: OpponentRuntimeStatus): void {
    status = Object.freeze(next);
    for (const listener of listeners) listener(status);
  }

  function ensureStarted(): boolean {
    if (disposed) return false;
    if (turnService) return true;

    const created = createEngine();
    if (created.status === "unsupported") {
      const [gap] = created.capabilities.gaps;
      publish({
        detail: gap ? describeEngineCapabilityGap(gap) : engineUnavailableDetail,
        kind: "unavailable",
      });
      return false;
    }

    engine = created.engine;
    unsubscribeEngine = created.engine.subscribe((engineStatus) => {
      publish(mapEngineStatus(engineStatus, turnInFlight));
    });
    turnService = createOpponentTurnService({
      monotonicClock: options.monotonicClock,
      provider: createEngineOpponentProvider({
        engine: created.engine,
        ...(options.delay ? { delay: options.delay } : {}),
        ...(options.random ? { random: options.random } : {}),
      }),
      requestIdFactory: options.requestIdFactory,
    });
    return true;
  }

  return Object.freeze({
    cancel() {
      turnService?.cancel();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      turnService?.cancel();
      unsubscribeEngine?.();
      engine?.dispose();
      engine = undefined;
      turnService = undefined;
      listeners.clear();
    },

    getStatus() {
      return status;
    },

    async runTurn(request: OpponentTurnRequest): Promise<OpponentTurnOutcome> {
      if (!ensureStarted() || !turnService) {
        return Object.freeze({ reason: "unavailable" as const, status: "degraded" as const });
      }
      turnInFlight = true;
      publish({ kind: "thinking" });
      try {
        return await turnService.runTurn(request);
      } finally {
        turnInFlight = false;
        if (!disposed && status.kind === "thinking") publish({ kind: "ready" });
      }
    },

    subscribe(listener: (next: OpponentRuntimeStatus) => void) {
      listeners.add(listener);
      listener(status);
      return () => {
        listeners.delete(listener);
      };
    },
  });
}

/**
 * A turn in flight owns the "thinking" state, so an engine that briefly reports ready
 * between its own internal steps cannot make the interface look idle mid-move.
 */
function mapEngineStatus(engineStatus: EngineStatus, turnInFlight: boolean): OpponentRuntimeStatus {
  switch (engineStatus.state) {
    case "uninitialized":
      return { kind: "idle" };
    case "loading":
      return engineStatus.progress
        ? { kind: "loading", ratio: engineStatus.progress.ratio }
        : { kind: "loading" };
    case "searching":
    case "stopping":
      return { kind: "thinking" };
    case "ready":
      return turnInFlight ? { kind: "thinking" } : { kind: "ready" };
    case "failed":
      return { detail: engineUnavailableDetail, kind: "unavailable" };
    case "terminated":
      return { kind: "idle" };
  }
}
