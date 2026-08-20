import type { OpponentTurnOutcome, OpponentTurnRequest } from "./opponent-turn-service";

/**
 * What the interface is allowed to know about the opponent runtime.
 *
 * The engine is a large optional asset, so the product must be able to show honest
 * loading and unavailable states instead of an unexplained wait.
 */
export type OpponentRuntimeStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "loading"; readonly ratio?: number }
  | { readonly kind: "ready" }
  | { readonly kind: "thinking" }
  | { readonly detail: string; readonly kind: "unavailable" };

export interface OpponentRuntime {
  /** Abandons any in-flight proposal; used when the position changes underneath the opponent. */
  cancel(): void;
  dispose(): void;
  getStatus(): OpponentRuntimeStatus;
  runTurn(request: OpponentTurnRequest): Promise<OpponentTurnOutcome>;
  subscribe(listener: (status: OpponentRuntimeStatus) => void): () => void;
}
