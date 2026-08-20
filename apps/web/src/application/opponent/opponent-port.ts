import type {
  Color,
  Fen,
  MoveInput,
  OpponentRequestFailureReason,
  UciMove,
} from "@caissa/chess-core";

import type { OpponentProfileId } from "./opponent-profiles";

/**
 * The application-side opponent boundary.
 *
 * A provider proposes a move for a position. It is never trusted: the game controller
 * revalidates legality, request identity, and position identity before committing.
 */
export interface OpponentMoveContext {
  readonly color: Color;
  readonly fen: Fen;
  /** Complete move list when the game started from the initial position. */
  readonly moves: readonly UciMove[];
  readonly profileId: OpponentProfileId;
  readonly remainingMs?: number;
  readonly startsFromInitialPosition: boolean;
}

export type OpponentMoveResult =
  | { readonly move: MoveInput; readonly status: "proposed" }
  | { readonly reason: OpponentRequestFailureReason; readonly status: "failed" };

export interface OpponentProvider {
  readonly providerId: string;
  cancel(): void;
  proposeMove(context: OpponentMoveContext): Promise<OpponentMoveResult>;
}

export interface RequestIdFactory {
  create(): string;
}
