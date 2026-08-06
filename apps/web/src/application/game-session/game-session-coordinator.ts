import type {
  AbandonGameCommand,
  GameController,
  GameSession,
  HumanMoveCommand,
  MonotonicTimestampMs,
  OpponentMoveProposal,
  OpponentRequestFailureCommand,
  RequestOpponentMoveCommand,
  RestartGameCommand,
  SessionRevision,
  UndoMoveCommand,
} from "@caissa/chess-core";

import {
  type CompletedGameRecord,
  type GamePersistenceResult,
  type GameRepository,
  type PersistenceError,
  type WallClock,
} from "../persistence";
import { buildCompletedGameRecord } from "./completed-game-record-builder";
import type {
  ApplicationPersistenceEvent,
  AppliedCoordinatorDomainResult,
  CompletedCoordinatorDomainResult,
  CoordinatorDomainResult,
  DurableSessionOperationKind,
  GameOperationResult,
  GameSessionOperationKind,
  PersistenceRetryResult,
  SessionPersistenceState,
} from "./game-session-types";

export interface GameSessionCoordinator {
  getSession(): GameSession;
  getPersistenceState(): SessionPersistenceState;
  start(now: MonotonicTimestampMs): Promise<GameOperationResult>;
  submitHumanMove(command: HumanMoveCommand): Promise<GameOperationResult>;
  requestOpponentMove(command: RequestOpponentMoveCommand): Promise<GameOperationResult>;
  commitOpponentMove(
    proposal: OpponentMoveProposal,
    now: MonotonicTimestampMs,
  ): Promise<GameOperationResult>;
  rejectOpponentRequest(command: OpponentRequestFailureCommand): Promise<GameOperationResult>;
  pause(now: MonotonicTimestampMs): Promise<GameOperationResult>;
  resume(now: MonotonicTimestampMs): Promise<GameOperationResult>;
  undoMoves(command: UndoMoveCommand): Promise<GameOperationResult>;
  restart(command: RestartGameCommand): Promise<GameOperationResult>;
  abandon(command: AbandonGameCommand): Promise<GameOperationResult>;
  retryPersistence(): Promise<PersistenceRetryResult>;
}

export interface CreateGameSessionCoordinatorOptions {
  readonly controller: GameController;
  readonly gameRepository: GameRepository;
  readonly initialActiveSaveFailure?: PersistenceError;
  readonly lastPersistedRevision?: SessionRevision;
  readonly startedAt?: ReturnType<WallClock["nowEpochMs"]>;
  readonly wallClock: WallClock;
}

type PendingPersistence =
  | {
      readonly checkpoint: ReturnType<GameController["exportCheckpoint"]>;
      readonly kind: "active";
      readonly revision: SessionRevision;
    }
  | {
      readonly kind: "finalization";
      readonly record: CompletedGameRecord;
      readonly revision: SessionRevision;
    };

const noEvents: readonly [] = Object.freeze([]);
const notAttempted = Object.freeze({ status: "not-attempted" as const });

export function createGameSessionCoordinator(
  options: CreateGameSessionCoordinatorOptions,
): GameSessionCoordinator {
  return new SerializedGameSessionCoordinator(options);
}

class SerializedGameSessionCoordinator implements GameSessionCoordinator {
  private readonly controller: GameController;
  private readonly gameRepository: GameRepository;
  private readonly wallClock: WallClock;
  private persistenceState: SessionPersistenceState;
  private pendingPersistence: PendingPersistence | undefined;
  private startedAt: ReturnType<WallClock["nowEpochMs"]> | undefined;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(options: CreateGameSessionCoordinatorOptions) {
    this.controller = options.controller;
    this.gameRepository = options.gameRepository;
    this.wallClock = options.wallClock;
    this.startedAt = options.startedAt;
    if (options.initialActiveSaveFailure) {
      const checkpoint = this.controller.exportCheckpoint();
      this.pendingPersistence = Object.freeze({
        checkpoint,
        kind: "active",
        revision: checkpoint.revision,
      });
      this.persistenceState = pendingState(
        this.pendingPersistence,
        freezePersistenceError(options.initialActiveSaveFailure),
        options.lastPersistedRevision,
      );
    } else {
      this.persistenceState = cleanState(options.lastPersistedRevision);
    }
  }

  getSession(): GameSession {
    return this.controller.getSession();
  }

  getPersistenceState(): SessionPersistenceState {
    return this.persistenceState;
  }

  start(now: MonotonicTimestampMs): Promise<GameOperationResult> {
    return this.execute("start", () => this.controller.start(now));
  }

  submitHumanMove(command: HumanMoveCommand): Promise<GameOperationResult> {
    return this.execute("submit-human-move", () => this.controller.submitHumanMove(command));
  }

  requestOpponentMove(command: RequestOpponentMoveCommand): Promise<GameOperationResult> {
    return this.execute("request-opponent-move", () =>
      this.controller.requestOpponentMove(command),
    );
  }

  commitOpponentMove(
    proposal: OpponentMoveProposal,
    now: MonotonicTimestampMs,
  ): Promise<GameOperationResult> {
    return this.execute("commit-opponent-move", () =>
      this.controller.commitOpponentMove(proposal, now),
    );
  }

  rejectOpponentRequest(command: OpponentRequestFailureCommand): Promise<GameOperationResult> {
    return this.execute("reject-opponent-request", () =>
      this.controller.rejectOpponentRequest(command),
    );
  }

  pause(now: MonotonicTimestampMs): Promise<GameOperationResult> {
    return this.execute("pause", () => this.controller.pause(now));
  }

  resume(now: MonotonicTimestampMs): Promise<GameOperationResult> {
    return this.execute("resume", () => this.controller.resume(now));
  }

  undoMoves(command: UndoMoveCommand): Promise<GameOperationResult> {
    return this.execute("undo-moves", () => this.controller.undoMoves(command));
  }

  restart(command: RestartGameCommand): Promise<GameOperationResult> {
    return this.execute("restart", () => this.controller.restart(command));
  }

  abandon(command: AbandonGameCommand): Promise<GameOperationResult> {
    return this.execute("abandon", () => this.controller.abandon(command));
  }

  retryPersistence(): Promise<PersistenceRetryResult> {
    return this.serialize(async () => {
      const candidate = this.pendingPersistence;
      if (!candidate) {
        return Object.freeze({
          events: noEvents,
          persistenceEvents: noEvents,
          state: this.persistenceState,
          status: "nothing-pending" as const,
        });
      }

      const operation = operationForCandidate(candidate);
      this.persistenceState = retryingState(
        operation,
        candidate.revision,
        this.persistenceState.lastSuccessfulRevision,
      );
      const write = await this.performCandidateWrite(candidate);
      if (write.status === "saved") {
        this.pendingPersistence = undefined;
        this.persistenceState = cleanState(candidate.revision);
        const event = persistenceEvent(
          "persistence-retry-succeeded",
          this.controller.getSession(),
          candidate.revision,
          operation,
        );
        return Object.freeze({
          events: noEvents,
          operation,
          persistenceEvents: Object.freeze([event]),
          revision: candidate.revision,
          state: this.persistenceState,
          status: "succeeded" as const,
        });
      }

      const error = failureFromWrite(write, operation);
      this.persistenceState = pendingState(
        candidate,
        error,
        this.persistenceState.lastSuccessfulRevision,
      );
      const event = persistenceEvent(
        "persistence-retry-failed",
        this.controller.getSession(),
        candidate.revision,
        operation,
        error,
      );
      return Object.freeze({
        error,
        events: noEvents,
        operation,
        persistenceEvents: Object.freeze([event]),
        revision: candidate.revision,
        state: this.persistenceState,
        status: "failed" as const,
      });
    });
  }

  private execute(
    operation: GameSessionOperationKind,
    invoke: () => CoordinatorDomainResult,
  ): Promise<GameOperationResult> {
    return this.serialize(async () => {
      if (this.pendingPersistence?.kind === "finalization") {
        return Object.freeze({
          events: noEvents,
          persistence: this.persistenceState,
          persistenceEvents: noEvents,
          reason: "finalization-pending" as const,
          session: this.controller.getSession(),
          status: "blocked" as const,
        });
      }

      let domainResult: CoordinatorDomainResult;
      try {
        domainResult = invoke();
      } catch {
        return Object.freeze({
          error: Object.freeze({
            code: "unexpected-operation-failure" as const,
            operation,
            retryable: false as const,
          }),
          events: noEvents,
          persistence: notAttempted,
          persistenceEvents: noEvents,
          session: this.controller.getSession(),
          status: "failed" as const,
        });
      }

      if (domainResult.status === "rejected") {
        return Object.freeze({
          domainResult,
          events: noEvents,
          persistence: notAttempted,
          persistenceEvents: noEvents,
          session: domainResult.session,
          status: "rejected" as const,
        });
      }

      if (operation === "start" && this.startedAt === undefined) {
        this.startedAt = this.wallClock.nowEpochMs();
      }

      return domainResult.status === "completed"
        ? this.persistCompleted(domainResult)
        : this.persistActive(domainResult);
    });
  }

  private async persistActive(
    domainResult: AppliedCoordinatorDomainResult,
  ): Promise<GameOperationResult> {
    const checkpoint = this.controller.exportCheckpoint();
    const candidate: PendingPersistence = Object.freeze({
      checkpoint,
      kind: "active",
      revision: checkpoint.revision,
    });
    this.pendingPersistence = candidate;
    this.persistenceState = savingState(
      "save-active-game",
      checkpoint.revision,
      this.persistenceState.lastSuccessfulRevision,
    );
    const write = await this.performCandidateWrite(candidate);

    if (write.status === "saved") {
      this.pendingPersistence = undefined;
      this.persistenceState = cleanState(checkpoint.revision);
      const event = persistenceEvent(
        "session-persisted",
        domainResult.session,
        checkpoint.revision,
        "save-active-game",
      );
      return Object.freeze({
        domainResult,
        events: domainResult.events,
        persistence: Object.freeze({ revision: checkpoint.revision, status: "saved" as const }),
        persistenceEvents: Object.freeze([event]),
        session: domainResult.session,
        status: "applied" as const,
      });
    }

    const error = failureFromWrite(write, "save-active-game");
    this.persistenceState = pendingState(
      candidate,
      error,
      this.persistenceState.lastSuccessfulRevision,
    );
    const event = persistenceEvent(
      "session-persistence-failed",
      domainResult.session,
      checkpoint.revision,
      "save-active-game",
      error,
    );
    return Object.freeze({
      domainResult,
      events: domainResult.events,
      persistence: Object.freeze({
        error,
        revision: checkpoint.revision,
        status: "unsaved" as const,
      }),
      persistenceEvents: Object.freeze([event]),
      session: domainResult.session,
      status: "applied" as const,
    });
  }

  private async persistCompleted(
    domainResult: CompletedCoordinatorDomainResult,
  ): Promise<GameOperationResult> {
    let candidate: PendingPersistence;
    try {
      const built = buildCompletedGameRecord({
        completedAt: this.wallClock.nowEpochMs(),
        controller: this.controller,
        ...(this.startedAt === undefined ? {} : { startedAt: this.startedAt }),
      });
      candidate = Object.freeze({
        kind: "finalization",
        record: built.record,
        revision: built.record.checkpoint.revision,
      });
    } catch {
      const error = applicationPersistenceError("finalize-game", false, "validation-failed");
      const checkpoint = this.controller.exportCheckpoint();
      this.persistenceState = Object.freeze({
        error,
        operation: "finalize-game",
        retryAvailable: false,
        status: "finalization-pending",
        targetRevision: checkpoint.revision,
        ...(this.persistenceState.lastSuccessfulRevision === undefined
          ? {}
          : { lastSuccessfulRevision: this.persistenceState.lastSuccessfulRevision }),
      });
      const event = persistenceEvent(
        "game-finalization-failed",
        domainResult.session,
        checkpoint.revision,
        "finalize-game",
        error,
      );
      return completedResult(domainResult, error, Object.freeze([event]));
    }

    this.pendingPersistence = candidate;
    this.persistenceState = savingState(
      "finalize-game",
      candidate.revision,
      this.persistenceState.lastSuccessfulRevision,
    );
    const write = await this.performCandidateWrite(candidate);
    if (write.status === "saved") {
      this.pendingPersistence = undefined;
      this.persistenceState = cleanState(candidate.revision);
      const event = persistenceEvent(
        "game-finalized",
        domainResult.session,
        candidate.revision,
        "finalize-game",
      );
      return Object.freeze({
        domainResult,
        events: domainResult.events,
        persistence: Object.freeze({
          revision: candidate.revision,
          status: "finalized" as const,
        }),
        persistenceEvents: Object.freeze([event]),
        result: domainResult.result,
        session: domainResult.session,
        status: "completed" as const,
      });
    }

    const error = failureFromWrite(write, "finalize-game");
    this.persistenceState = pendingState(
      candidate,
      error,
      this.persistenceState.lastSuccessfulRevision,
    );
    const event = persistenceEvent(
      "game-finalization-failed",
      domainResult.session,
      candidate.revision,
      "finalize-game",
      error,
    );
    return completedResult(domainResult, error, Object.freeze([event]));
  }

  private async performCandidateWrite(
    candidate: PendingPersistence,
  ): Promise<GamePersistenceResult> {
    try {
      return candidate.kind === "active"
        ? await this.gameRepository.saveActiveGame(candidate.checkpoint)
        : await this.gameRepository.finalizeGame(candidate.record);
    } catch {
      return {
        error: applicationPersistenceError(operationForCandidate(candidate), true),
        status: "failed",
      };
    }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.operationQueue.then(operation, operation);
    this.operationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function completedResult(
  domainResult: CompletedCoordinatorDomainResult,
  error: PersistenceError,
  persistenceEvents: readonly ApplicationPersistenceEvent[],
): GameOperationResult {
  return Object.freeze({
    domainResult,
    events: domainResult.events,
    persistence: Object.freeze({
      error,
      revision: domainResult.session.revision,
      status: "finalization-pending" as const,
    }),
    persistenceEvents,
    result: domainResult.result,
    session: domainResult.session,
    status: "completed" as const,
  });
}

function cleanState(lastSuccessfulRevision?: SessionRevision): SessionPersistenceState {
  return Object.freeze({
    retryAvailable: false,
    status: "clean",
    ...(lastSuccessfulRevision === undefined ? {} : { lastSuccessfulRevision }),
  });
}

function savingState(
  operation: DurableSessionOperationKind,
  targetRevision: SessionRevision,
  lastSuccessfulRevision?: SessionRevision,
): SessionPersistenceState {
  return Object.freeze({
    operation,
    retryAvailable: false,
    status: "saving",
    targetRevision,
    ...(lastSuccessfulRevision === undefined ? {} : { lastSuccessfulRevision }),
  });
}

function retryingState(
  operation: DurableSessionOperationKind,
  targetRevision: SessionRevision,
  lastSuccessfulRevision?: SessionRevision,
): SessionPersistenceState {
  return Object.freeze({
    operation,
    retryAvailable: false,
    status: "retrying",
    targetRevision,
    ...(lastSuccessfulRevision === undefined ? {} : { lastSuccessfulRevision }),
  });
}

function pendingState(
  candidate: PendingPersistence,
  error: PersistenceError,
  lastSuccessfulRevision?: SessionRevision,
): SessionPersistenceState {
  return candidate.kind === "active"
    ? Object.freeze({
        error,
        operation: "save-active-game",
        retryAvailable: true,
        status: "unsaved",
        targetRevision: candidate.revision,
        ...(lastSuccessfulRevision === undefined ? {} : { lastSuccessfulRevision }),
      })
    : Object.freeze({
        error,
        operation: "finalize-game",
        retryAvailable: true,
        status: "finalization-pending",
        targetRevision: candidate.revision,
        ...(lastSuccessfulRevision === undefined ? {} : { lastSuccessfulRevision }),
      });
}

function operationForCandidate(candidate: PendingPersistence): DurableSessionOperationKind {
  return candidate.kind === "active" ? "save-active-game" : "finalize-game";
}

function failureFromWrite(
  result: Exclude<GamePersistenceResult, { readonly status: "saved" }>,
  operation: DurableSessionOperationKind,
): PersistenceError {
  if (result.status === "failed") return freezePersistenceError(result.error);
  return applicationPersistenceError(operation, false, "validation-failed");
}

function applicationPersistenceError(
  operation: DurableSessionOperationKind,
  retryable: boolean,
  code: PersistenceError["code"] = "unknown-storage-error",
): PersistenceError {
  return Object.freeze({ code, operation, retryable });
}

function freezePersistenceError(error: PersistenceError): PersistenceError {
  return Object.freeze({
    code: error.code,
    operation: error.operation,
    retryable: error.retryable,
  });
}

function persistenceEvent(
  type: ApplicationPersistenceEvent["type"],
  session: GameSession,
  revision: SessionRevision,
  operation: DurableSessionOperationKind,
  error?: PersistenceError,
): ApplicationPersistenceEvent {
  return Object.freeze({
    gameId: session.gameId,
    operation,
    revision,
    type,
    ...(error === undefined ? {} : { error }),
  }) as ApplicationPersistenceEvent;
}
