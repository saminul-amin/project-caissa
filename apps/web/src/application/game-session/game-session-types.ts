import type {
  GameCommandResult,
  GameDomainEvent,
  GameMoveCommandResult,
  GameResult,
  GameSession,
  OpponentRequestCommandResult,
  RestartGameCommandResult,
  SessionRevision,
  UndoMoveCommandResult,
} from "@caissa/chess-core";

import type { PersistenceError } from "../persistence";

export type GameSessionOperationKind =
  | "abandon"
  | "commit-opponent-move"
  | "pause"
  | "reject-opponent-request"
  | "request-opponent-move"
  | "restart"
  | "resume"
  | "start"
  | "submit-human-move"
  | "undo-moves";

export type DurableSessionOperationKind = "finalize-game" | "save-active-game";

export type CoordinatorDomainResult =
  | GameCommandResult
  | GameMoveCommandResult
  | OpponentRequestCommandResult
  | RestartGameCommandResult
  | UndoMoveCommandResult;

export type RejectedCoordinatorDomainResult = Extract<
  CoordinatorDomainResult,
  { readonly status: "rejected" }
>;
export type AppliedCoordinatorDomainResult = Extract<
  CoordinatorDomainResult,
  { readonly status: "applied" }
>;
export type CompletedCoordinatorDomainResult = Extract<
  CoordinatorDomainResult,
  { readonly status: "completed" }
>;

export interface SafeApplicationError {
  readonly code: "unexpected-operation-failure";
  readonly operation: GameSessionOperationKind;
  readonly retryable: false;
}

export type ApplicationPersistenceEvent =
  | {
      readonly gameId: GameSession["gameId"];
      readonly operation: "save-active-game";
      readonly revision: SessionRevision;
      readonly type: "session-persisted";
    }
  | {
      readonly error: PersistenceError;
      readonly gameId: GameSession["gameId"];
      readonly operation: "save-active-game";
      readonly revision: SessionRevision;
      readonly type: "session-persistence-failed";
    }
  | {
      readonly gameId: GameSession["gameId"];
      readonly operation: "finalize-game";
      readonly revision: SessionRevision;
      readonly type: "game-finalized";
    }
  | {
      readonly error: PersistenceError;
      readonly gameId: GameSession["gameId"];
      readonly operation: "finalize-game";
      readonly revision: SessionRevision;
      readonly type: "game-finalization-failed";
    }
  | {
      readonly gameId: GameSession["gameId"];
      readonly operation: DurableSessionOperationKind;
      readonly revision: SessionRevision;
      readonly type: "persistence-retry-succeeded";
    }
  | {
      readonly error: PersistenceError;
      readonly gameId: GameSession["gameId"];
      readonly operation: DurableSessionOperationKind;
      readonly revision: SessionRevision;
      readonly type: "persistence-retry-failed";
    };

interface SessionPersistenceStateBase {
  readonly lastSuccessfulRevision?: SessionRevision;
  readonly retryAvailable: boolean;
}

export type SessionPersistenceState =
  | (SessionPersistenceStateBase & {
      readonly retryAvailable: false;
      readonly status: "clean";
    })
  | (SessionPersistenceStateBase & {
      readonly operation: DurableSessionOperationKind;
      readonly retryAvailable: false;
      readonly status: "saving";
      readonly targetRevision: SessionRevision;
    })
  | (SessionPersistenceStateBase & {
      readonly error: PersistenceError;
      readonly operation: "save-active-game";
      readonly retryAvailable: true;
      readonly status: "unsaved";
      readonly targetRevision: SessionRevision;
    })
  | (SessionPersistenceStateBase & {
      readonly error: PersistenceError;
      readonly operation: "finalize-game";
      readonly retryAvailable: boolean;
      readonly status: "finalization-pending";
      readonly targetRevision: SessionRevision;
    })
  | (SessionPersistenceStateBase & {
      readonly operation: DurableSessionOperationKind;
      readonly retryAvailable: false;
      readonly status: "retrying";
      readonly targetRevision: SessionRevision;
    });

export type AppliedPersistenceOutcome =
  | { readonly revision: SessionRevision; readonly status: "saved" }
  | {
      readonly error: PersistenceError;
      readonly revision: SessionRevision;
      readonly status: "unsaved";
    };

export type CompletedPersistenceOutcome =
  | { readonly revision: SessionRevision; readonly status: "finalized" }
  | {
      readonly error: PersistenceError;
      readonly revision: SessionRevision;
      readonly status: "finalization-pending";
    };

export type GameOperationResult =
  | {
      readonly domainResult: RejectedCoordinatorDomainResult;
      readonly events: readonly [];
      readonly persistence: { readonly status: "not-attempted" };
      readonly persistenceEvents: readonly [];
      readonly session: GameSession;
      readonly status: "rejected";
    }
  | {
      readonly domainResult: AppliedCoordinatorDomainResult;
      readonly events: readonly GameDomainEvent[];
      readonly persistence: AppliedPersistenceOutcome;
      readonly persistenceEvents: readonly ApplicationPersistenceEvent[];
      readonly session: GameSession;
      readonly status: "applied";
    }
  | {
      readonly domainResult: CompletedCoordinatorDomainResult;
      readonly events: readonly GameDomainEvent[];
      readonly persistence: CompletedPersistenceOutcome;
      readonly persistenceEvents: readonly ApplicationPersistenceEvent[];
      readonly result: GameResult;
      readonly session: GameSession;
      readonly status: "completed";
    }
  | {
      readonly error: SafeApplicationError;
      readonly events: readonly [];
      readonly persistence: { readonly status: "not-attempted" };
      readonly persistenceEvents: readonly [];
      readonly session: GameSession;
      readonly status: "failed";
    }
  | {
      readonly events: readonly [];
      readonly persistence: SessionPersistenceState;
      readonly persistenceEvents: readonly [];
      readonly reason: "finalization-pending";
      readonly session: GameSession;
      readonly status: "blocked";
    };

export type PersistenceRetryResult =
  | {
      readonly events: readonly [];
      readonly persistenceEvents: readonly [];
      readonly state: SessionPersistenceState;
      readonly status: "nothing-pending";
    }
  | {
      readonly events: readonly [];
      readonly operation: DurableSessionOperationKind;
      readonly persistenceEvents: readonly ApplicationPersistenceEvent[];
      readonly revision: SessionRevision;
      readonly state: SessionPersistenceState;
      readonly status: "succeeded";
    }
  | {
      readonly error: PersistenceError;
      readonly events: readonly [];
      readonly operation: DurableSessionOperationKind;
      readonly persistenceEvents: readonly ApplicationPersistenceEvent[];
      readonly revision: SessionRevision;
      readonly state: SessionPersistenceState;
      readonly status: "failed";
    };
