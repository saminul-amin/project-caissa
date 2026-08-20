/**
 * Engine boundary types.
 *
 * Stockfish is an adviser. It never owns game state, never validates legality for the
 * application, and may be unavailable at any time. Every result therefore models
 * failure explicitly instead of throwing.
 */

export type EngineState =
  "uninitialized" | "loading" | "ready" | "searching" | "stopping" | "failed" | "terminated";

export type EngineFailureReason =
  "cancelled" | "load-failed" | "protocol-error" | "terminated" | "timeout" | "unsupported";

export interface EngineLoadProgress {
  /** 0 to 1. */
  readonly ratio: number;
  readonly loadedBytes: number;
  readonly totalBytes: number;
}

export interface EngineStatus {
  readonly progress?: EngineLoadProgress;
  readonly reason?: EngineFailureReason;
  readonly state: EngineState;
}

export interface EngineIdentity {
  readonly engineId: string;
  readonly engineVersion: string;
}

export interface EngineSearchLimits {
  readonly depth?: number;
  readonly movetimeMs?: number;
  readonly nodes?: number;
}

export interface EngineSearchOptions {
  readonly limitStrengthElo?: number;
  readonly multiPv?: number;
  readonly skillLevel?: number;
}

export interface EngineSearchRequest {
  readonly fen: string;
  readonly limits: EngineSearchLimits;
  readonly moves?: readonly string[];
  readonly newGame?: boolean;
  readonly options?: EngineSearchOptions;
  readonly startsFromInitialPosition: boolean;
}

export interface EngineLine {
  readonly depth: number;
  readonly moves: readonly string[];
  readonly multipv: number;
  readonly scoreCentipawns?: number;
  readonly scoreMateInMoves?: number;
}

export type EngineSearchResult =
  | {
      readonly bestMove: string;
      readonly lines: readonly EngineLine[];
      readonly status: "completed";
    }
  | {
      readonly lines: readonly EngineLine[];
      /** The engine reports no legal move, which the caller must treat as a terminal position. */
      readonly status: "no-move";
    }
  | { readonly reason: EngineFailureReason; readonly status: "failed" };

export type EngineInitializationResult =
  | ({ readonly status: "ready" } & EngineIdentity)
  | { readonly reason: EngineFailureReason; readonly status: "failed" };

export interface ChessEnginePort extends EngineIdentity {
  dispose(): void;
  getStatus(): EngineStatus;
  initialize(): Promise<EngineInitializationResult>;
  search(request: EngineSearchRequest): Promise<EngineSearchResult>;
  stop(): void;
  subscribe(listener: (status: EngineStatus) => void): () => void;
}
