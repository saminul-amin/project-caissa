import type { GameDomainEvent } from "./game-events";
import type { GameSession, MoveRecord } from "./game-session";

export type UndoMoveRejectionReason =
  | "game-abandoned"
  | "game-paused"
  | "insufficient-history"
  | "internal-restoration-failure"
  | "invalid-lifecycle"
  | "invalid-undo-count"
  | "stale-revision"
  | "undo-disabled";

export type UndoMoveCommandResult =
  | {
      readonly events: readonly GameDomainEvent[];
      readonly removedMoves: readonly MoveRecord[];
      readonly session: GameSession;
      readonly status: "applied";
    }
  | {
      readonly events: readonly [];
      readonly reason: UndoMoveRejectionReason;
      readonly session: GameSession;
      readonly status: "rejected";
    };

export type RestartGameRejectionReason =
  "already-reset" | "internal-restoration-failure" | "invalid-lifecycle" | "stale-revision";

export type RestartGameCommandResult =
  | {
      readonly events: readonly GameDomainEvent[];
      readonly session: GameSession;
      readonly status: "applied";
    }
  | {
      readonly events: readonly [];
      readonly reason: RestartGameRejectionReason;
      readonly session: GameSession;
      readonly status: "rejected";
    };
