import {
  formatPositionCommand,
  isSafeEngineLine,
  parseUciBestMove,
  parseUciInfo,
  type UciInfoLine,
} from "./uci";
import type { CreateEngineTransport, EngineTransport } from "./engine-transport";
import type {
  ChessEnginePort,
  EngineFailureReason,
  EngineInitializationResult,
  EngineLine,
  EngineLoadProgress,
  EngineSearchOptions,
  EngineSearchRequest,
  EngineSearchResult,
  EngineStatus,
} from "./engine-port";

export interface EngineScheduler {
  /** Schedules the callback and returns a cancellation function. */
  schedule(delayMs: number, callback: () => void): () => void;
}

export interface CreateStockfishEngineClientOptions {
  readonly createTransport: CreateEngineTransport;
  readonly engineId?: string;
  readonly engineVersion?: string;
  readonly hashMegabytes?: number;
  readonly initializeTimeoutMs?: number;
  readonly scheduler?: EngineScheduler;
  readonly searchTimeoutMarginMs?: number;
}

const defaultInitializeTimeoutMs = 60_000;
const defaultSearchTimeoutMarginMs = 15_000;
const defaultHashMegabytes = 32;
const stopGraceMs = 3_000;
const maximumCollectedLines = 8;

const defaultScheduler: EngineScheduler = Object.freeze({
  schedule(delayMs: number, callback: () => void) {
    const handle = setTimeout(callback, delayMs);
    return () => {
      clearTimeout(handle);
    };
  },
});

interface PendingSearch {
  readonly collected: Map<number, EngineLine>;
  readonly resolve: (result: EngineSearchResult) => void;
  cancelTimeout: () => void;
  settled: boolean;
  stopRequested: boolean;
}

/**
 * Typed UCI client over a single engine transport.
 *
 * One search may run at a time. Every command is issued from this class so that engine
 * option state, position state, and search state cannot diverge from caller expectations.
 */
export function createStockfishEngineClient(
  options: CreateStockfishEngineClientOptions,
): ChessEnginePort {
  return new StockfishEngineClient(options);
}

class StockfishEngineClient implements ChessEnginePort {
  readonly engineId: string;
  engineVersion: string;

  private readonly options: CreateStockfishEngineClientOptions;
  private readonly scheduler: EngineScheduler;
  private readonly listeners = new Set<(status: EngineStatus) => void>();
  private transport: EngineTransport | undefined;
  private status: EngineStatus = Object.freeze({ state: "uninitialized" });
  private initialization: Promise<EngineInitializationResult> | undefined;
  private readySignals: (() => void)[] = [];
  private pendingSearch: PendingSearch | undefined;
  private appliedOptions: EngineSearchOptions = {};
  private queue: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(options: CreateStockfishEngineClientOptions) {
    this.options = options;
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.engineId = options.engineId ?? "stockfish";
    this.engineVersion = options.engineVersion ?? "unknown";
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  subscribe(listener: (status: EngineStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  initialize(): Promise<EngineInitializationResult> {
    if (this.disposed) {
      return Promise.resolve(failedInitialization("terminated"));
    }
    this.initialization ??= this.runInitialization();
    return this.initialization;
  }

  search(request: EngineSearchRequest): Promise<EngineSearchResult> {
    return this.enqueue(async (): Promise<EngineSearchResult> => {
      if (this.disposed) return failedSearch("terminated");
      const initialized = await this.initialize();
      if (initialized.status === "failed") return failedSearch(initialized.reason);
      return this.runSearch(request);
    });
  }

  stop(): void {
    const pending = this.pendingSearch;
    if (!pending || pending.settled) return;
    pending.stopRequested = true;
    this.setStatus({ state: "stopping" });
    this.post("stop");
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.settlePending(failedSearch("terminated"));
    this.releaseReadySignals();
    this.transport?.terminate();
    this.transport = undefined;
    this.setStatus({ state: "terminated" });
    this.listeners.clear();
  }

  private async runInitialization(): Promise<EngineInitializationResult> {
    this.setStatus({ state: "loading" });

    let transport: EngineTransport;
    try {
      transport = this.options.createTransport({
        onError: () => {
          this.failEngine("load-failed");
        },
        onLine: (line) => {
          this.handleLine(line);
        },
        onProgress: (progress) => {
          this.handleProgress(progress);
        },
      });
    } catch {
      this.setStatus({ reason: "load-failed", state: "failed" });
      return failedInitialization("load-failed");
    }
    this.transport = transport;

    transport.post("setoption name CanOutputEngineDownloadProgress");
    transport.post("uci");
    transport.post("setoption name Threads value 1");
    transport.post(
      `setoption name Hash value ${String(this.options.hashMegabytes ?? defaultHashMegabytes)}`,
    );

    const ready = await this.waitForReady(
      this.options.initializeTimeoutMs ?? defaultInitializeTimeoutMs,
    );
    if (!ready) {
      this.failEngine("timeout");
      return failedInitialization("timeout");
    }
    if (this.status.state === "failed") {
      return failedInitialization(this.status.reason ?? "load-failed");
    }

    this.setStatus({ state: "ready" });
    return Object.freeze({
      engineId: this.engineId,
      engineVersion: this.engineVersion,
      status: "ready" as const,
    });
  }

  private async runSearch(request: EngineSearchRequest): Promise<EngineSearchResult> {
    if (request.newGame === true) {
      this.post("ucinewgame");
      this.appliedOptions = {};
    }
    this.applyOptions(request.options ?? {});

    const readyTimeoutMs = this.options.initializeTimeoutMs ?? defaultInitializeTimeoutMs;
    if (!(await this.waitForReady(readyTimeoutMs))) {
      this.failEngine("timeout");
      return failedSearch("timeout");
    }
    if (this.disposed) return failedSearch("terminated");
    if (this.status.state === "failed") {
      return failedSearch(this.status.reason ?? "protocol-error");
    }

    this.post(
      formatPositionCommand({
        fen: request.fen,
        ...(request.moves ? { moves: request.moves } : {}),
        startsFromInitialPosition: request.startsFromInitialPosition,
      }),
    );

    const result = await new Promise<EngineSearchResult>((resolve) => {
      const pending: PendingSearch = {
        cancelTimeout: () => undefined,
        collected: new Map<number, EngineLine>(),
        resolve,
        settled: false,
        stopRequested: false,
      };
      this.pendingSearch = pending;
      this.setStatus({ state: "searching" });
      pending.cancelTimeout = this.scheduler.schedule(
        searchTimeoutMs(request, this.options),
        () => {
          if (pending.settled) return;
          if (pending.stopRequested) {
            this.failEngine("timeout");
            return;
          }
          pending.stopRequested = true;
          this.post("stop");
          pending.cancelTimeout = this.scheduler.schedule(stopGraceMs, () => {
            if (pending.settled) return;
            this.failEngine("timeout");
          });
        },
      );
      this.post(formatGoCommand(request));
    });

    if (this.status.state === "searching" || this.status.state === "stopping") {
      this.setStatus({ state: "ready" });
    }
    return result;
  }

  private applyOptions(next: EngineSearchOptions): void {
    const multiPv = next.multiPv ?? 1;
    if (this.appliedOptions.multiPv !== multiPv) {
      this.post(`setoption name MultiPV value ${String(multiPv)}`);
    }

    const skillLevel = next.skillLevel;
    if (skillLevel !== undefined && this.appliedOptions.skillLevel !== skillLevel) {
      this.post(`setoption name Skill Level value ${String(skillLevel)}`);
    }

    const elo = next.limitStrengthElo;
    if (elo !== this.appliedOptions.limitStrengthElo) {
      if (elo === undefined) {
        this.post("setoption name UCI_LimitStrength value false");
      } else {
        this.post("setoption name UCI_LimitStrength value true");
        this.post(`setoption name UCI_Elo value ${String(elo)}`);
      }
    }

    this.appliedOptions = Object.freeze({
      multiPv,
      ...(skillLevel === undefined ? {} : { skillLevel }),
      ...(elo === undefined ? {} : { limitStrengthElo: elo }),
    });
  }

  private handleLine(line: string): void {
    if (!isSafeEngineLine(line)) return;
    const trimmed = line.trim();

    if (trimmed.startsWith("id name ")) {
      this.engineVersion = trimmed.slice("id name ".length).slice(0, 64);
      return;
    }
    if (trimmed === "readyok" || trimmed === "uciok") {
      this.releaseReadySignals();
      return;
    }
    if (trimmed.startsWith("info ")) {
      this.collectInfo(parseUciInfo(trimmed));
      return;
    }
    if (trimmed.startsWith("bestmove")) {
      this.completeSearch(trimmed);
    }
  }

  private collectInfo(info: UciInfoLine | undefined): void {
    const pending = this.pendingSearch;
    if (!pending || pending.settled || !info?.pv || info.depth === undefined) return;

    const multipv = info.multipv ?? 1;
    if (multipv > maximumCollectedLines) return;

    pending.collected.set(
      multipv,
      Object.freeze({
        depth: info.depth,
        moves: info.pv,
        multipv,
        ...(info.score?.kind === "centipawns" ? { scoreCentipawns: info.score.value } : {}),
        ...(info.score?.kind === "mate" ? { scoreMateInMoves: info.score.value } : {}),
      }),
    );
  }

  private completeSearch(line: string): void {
    const pending = this.pendingSearch;
    if (!pending || pending.settled) return;

    const parsed = parseUciBestMove(line);
    const lines = Object.freeze(
      [...pending.collected.values()].sort((left, right) => left.multipv - right.multipv),
    );

    this.settlePending(
      parsed?.bestMove === undefined
        ? Object.freeze({ lines, status: "no-move" as const })
        : Object.freeze({ bestMove: parsed.bestMove, lines, status: "completed" as const }),
    );
  }

  private settlePending(result: EngineSearchResult): void {
    const pending = this.pendingSearch;
    if (!pending || pending.settled) return;
    pending.settled = true;
    pending.cancelTimeout();
    this.pendingSearch = undefined;
    pending.resolve(result);
  }

  private waitForReady(timeoutMs: number): Promise<boolean> {
    this.post("isready");
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const signalReady = () => {
        if (settled) return;
        settled = true;
        cancel();
        resolve(true);
      };
      const cancel = this.scheduler.schedule(timeoutMs, () => {
        if (settled) return;
        settled = true;
        this.readySignals = this.readySignals.filter((signal) => signal !== signalReady);
        resolve(false);
      });
      this.readySignals.push(signalReady);
    });
  }

  private releaseReadySignals(): void {
    const signals = this.readySignals;
    this.readySignals = [];
    for (const signal of signals) signal();
  }

  private handleProgress(progress: EngineLoadProgress): void {
    if (this.status.state !== "loading") return;
    this.setStatus({ progress, state: "loading" });
  }

  private failEngine(reason: EngineFailureReason): void {
    if (this.disposed) return;
    this.setStatus({ reason, state: "failed" });
    this.settlePending(failedSearch(reason));
    this.releaseReadySignals();
  }

  private post(command: string): void {
    this.transport?.post(command);
  }

  private setStatus(status: EngineStatus): void {
    this.status = Object.freeze(status);
    for (const listener of this.listeners) listener(this.status);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function formatGoCommand(request: EngineSearchRequest): string {
  const parts = ["go"];
  if (request.limits.depth !== undefined) parts.push("depth", String(request.limits.depth));
  if (request.limits.nodes !== undefined) parts.push("nodes", String(request.limits.nodes));
  if (request.limits.movetimeMs !== undefined) {
    parts.push("movetime", String(request.limits.movetimeMs));
  }
  return parts.length === 1 ? "go movetime 1000" : parts.join(" ");
}

function searchTimeoutMs(
  request: EngineSearchRequest,
  options: CreateStockfishEngineClientOptions,
): number {
  const margin = options.searchTimeoutMarginMs ?? defaultSearchTimeoutMarginMs;
  return (request.limits.movetimeMs ?? 0) + margin;
}

function failedSearch(reason: EngineFailureReason): EngineSearchResult {
  return Object.freeze({ reason, status: "failed" as const });
}

function failedInitialization(reason: EngineFailureReason): EngineInitializationResult {
  return Object.freeze({ reason, status: "failed" as const });
}
