import type {
  ChessRulesPort,
  MoveApplicationResult,
  MoveInput,
  MoveRejectionReason,
  TerminalState,
} from "./chess-rules";
import { moveInputFromUci } from "./chess-rules";
import {
  commitClockMove,
  pauseClock,
  rebaseActiveClock,
  resumeClock,
  snapshotClock,
  startClock,
  stopClock,
  type ClockState,
  type ClockTransitionRejectionReason,
} from "./clock";
import type { MonotonicTimestampMs } from "./clock-primitives";
import { GameControllerError } from "./errors";
import { createGameSessionCheckpoint, type GameSessionCheckpoint } from "./game-checkpoint";
import type { GameDomainEvent } from "./game-events";
import type {
  RestartGameCommandResult,
  RestartGameRejectionReason,
  UndoMoveCommandResult,
  UndoMoveRejectionReason,
} from "./game-recovery";
import {
  freezeGameSessionSnapshot,
  freezeMoveRecordSnapshot,
  freezeOpponentRequestSnapshot,
  freezePositionSnapshot,
} from "./game-snapshot";
import {
  transitionGameLifecycle,
  type GameLifecycleEvent,
  type GameLifecycleState,
  type ResumableGamePhase,
} from "./game-lifecycle";
import {
  createAbandonedGameResult,
  createGameResultFromTerminalState,
  createTimeoutGameResult,
  type GameResult,
} from "./game-result";
import {
  createGameConfiguration,
  createInitialClock,
  initialSessionRevision,
  type AbandonGameCommand,
  type GameConfiguration,
  type GameSession,
  type HumanMoveCommand,
  type MoveRecord,
  type OpponentMoveProposal,
  type OpponentRequestFailureCommand,
  type OpponentRequestState,
  type PositionSnapshot,
  type RequestOpponentMoveCommand,
  type RestartGameCommand,
  type UndoMoveCommand,
} from "./game-session";
import {
  parsePly,
  parseSessionRevision,
  type Color,
  type Fen,
  type SessionRevision,
} from "./primitives";

export type GameCommandRejectionReason =
  | "already-abandoned"
  | "already-completed"
  | "already-paused"
  | "already-started"
  | "clock-expired"
  | "illegal-move"
  | "invalid-lifecycle"
  | "missing-opponent-request"
  | "not-paused"
  | "opponent-request-active"
  | "ply-mismatch"
  | "position-mismatch"
  | "promotion-required"
  | "request-color-mismatch"
  | "request-id-mismatch"
  | "stale-revision"
  | "timestamp-regression"
  | "wrong-actor"
  | "wrong-side-to-move";

export type GameCommandResult =
  | {
      readonly events: readonly GameDomainEvent[];
      readonly session: GameSession;
      readonly status: "applied";
    }
  | {
      readonly events: readonly GameDomainEvent[];
      readonly result: GameResult;
      readonly session: GameSession;
      readonly status: "completed";
    }
  | GameCommandRejectedResult;

export type GameMoveCommandResult =
  | {
      readonly events: readonly GameDomainEvent[];
      readonly move: MoveRecord;
      readonly session: GameSession;
      readonly status: "applied";
    }
  | {
      readonly events: readonly GameDomainEvent[];
      readonly move: MoveRecord | undefined;
      readonly result: GameResult;
      readonly session: GameSession;
      readonly status: "completed";
    }
  | GameCommandRejectedResult;

export type OpponentRequestCommandResult =
  | {
      readonly events: readonly GameDomainEvent[];
      readonly request: OpponentRequestState;
      readonly session: GameSession;
      readonly status: "applied";
    }
  | GameCommandRejectedResult;

export interface GameCommandRejectedResult {
  readonly events: readonly [];
  readonly reason: GameCommandRejectionReason;
  readonly session: GameSession;
  readonly status: "rejected";
}

export interface GameController {
  getSession(): GameSession;
  start(now: MonotonicTimestampMs): GameCommandResult;
  submitHumanMove(command: HumanMoveCommand): GameMoveCommandResult;
  requestOpponentMove(command: RequestOpponentMoveCommand): OpponentRequestCommandResult;
  commitOpponentMove(
    proposal: OpponentMoveProposal,
    now: MonotonicTimestampMs,
  ): GameMoveCommandResult;
  rejectOpponentRequest(command: OpponentRequestFailureCommand): GameCommandResult;
  pause(now: MonotonicTimestampMs): GameCommandResult;
  resume(now: MonotonicTimestampMs): GameCommandResult;
  abandon(command: AbandonGameCommand): GameCommandResult;
  undoMoves(command: UndoMoveCommand): UndoMoveCommandResult;
  restart(command: RestartGameCommand): RestartGameCommandResult;
  exportCheckpoint(): GameSessionCheckpoint;
}

export interface CreateGameControllerOptions {
  readonly configuration: unknown;
  readonly rules: ChessRulesPort;
}

const emptyEvents: readonly [] = Object.freeze([]);

export function createGameController(options: CreateGameControllerOptions): GameController {
  return new AuthoritativeGameController(options);
}

/** Internal reconstruction seam; intentionally omitted from the package entry point. */
export function createRestoredGameController(
  rules: ChessRulesPort,
  session: GameSession,
): GameController {
  return new AuthoritativeGameController({ configuration: session.configuration, rules }, session);
}

class AuthoritativeGameController implements GameController {
  private readonly rules: ChessRulesPort;
  private session: GameSession;

  constructor(options: CreateGameControllerOptions, restoredSession?: GameSession) {
    this.rules = options.rules;
    if (restoredSession) {
      const session = freezeGameSessionSnapshot(restoredSession);
      assertSessionInvariants(session, this.rules);
      this.session = session;
      return;
    }

    const configuration = createGameConfiguration(options.configuration);
    const loadedPosition = this.loadConfiguredPosition(configuration);
    const terminalState = loadedPosition.terminalState;
    const lifecycle =
      terminalState.status === "ongoing"
        ? transitionLifecycleOrThrow({ phase: "creating" }, { type: "creation-succeeded" })
        : ({ phase: "completed" } as const);
    const result =
      terminalState.status === "ongoing"
        ? undefined
        : createGameResultFromTerminalState(terminalState);

    this.session = freezeGameSessionSnapshot({
      activeOpponentRequest: undefined,
      clock: createInitialClock(configuration),
      configuration,
      gameId: configuration.gameId,
      history: [],
      lifecycle,
      position: loadedPosition,
      result,
      revision: initialSessionRevision(),
    });
  }

  getSession(): GameSession {
    return this.session;
  }

  exportCheckpoint(): GameSessionCheckpoint {
    return createGameSessionCheckpoint(this.session);
  }

  start(now: MonotonicTimestampMs): GameCommandResult {
    const prior = this.session;
    const terminalRejection = rejectTerminalSession(prior);
    if (terminalRejection) {
      return terminalRejection;
    }
    if (prior.lifecycle.phase !== "ready") {
      return rejected(prior, "already-started");
    }

    const activeColor = this.rules.getTurn();
    const clockResult = startClock(prior.clock, activeColor, now);
    if (clockResult.status === "rejected") {
      return rejected(prior, mapClockRejection(clockResult.reason));
    }
    if (clockResult.status === "expired") {
      return this.completeByTimeout(prior, clockResult.state, clockResult.expiredColor);
    }

    const participant = prior.configuration.participants[activeColor];
    const lifecycle = transitionLifecycleOrThrow(prior.lifecycle, {
      type: participant.kind === "human" ? "begin-player-turn" : "begin-opponent-turn",
    });
    const revision = nextRevision(prior.revision);
    const session = this.commitSession({
      activeOpponentRequest: undefined,
      clock: clockResult.state,
      history: prior.history,
      lifecycle,
      position: prior.position,
      result: undefined,
      revision,
    });
    const events = freezeEvents({
      activeColor,
      gameId: session.gameId,
      revision,
      type: "game-started",
    });

    return { events, session, status: "applied" };
  }

  submitHumanMove(command: HumanMoveCommand): GameMoveCommandResult {
    const prior = this.session;
    const rejection = this.validateMoveLifecycle(prior, "player-turn");
    if (rejection) {
      return rejection;
    }
    if (isStaleExpectedRevision(prior.revision, command.expectedRevision)) {
      return rejected(prior, "stale-revision");
    }

    const mover = this.rules.getTurn();
    if (prior.configuration.participants[mover].kind !== "human") {
      return rejected(prior, "wrong-actor");
    }

    return this.commitAuthoritativeMove(prior, "human", command.move, command.now);
  }

  requestOpponentMove(command: RequestOpponentMoveCommand): OpponentRequestCommandResult {
    const prior = this.session;
    const terminalRejection = rejectTerminalSession(prior);
    if (terminalRejection) {
      return terminalRejection;
    }
    if (prior.lifecycle.phase === "paused") {
      return rejected(prior, "already-paused");
    }
    if (prior.lifecycle.phase !== "opponent-turn") {
      return prior.activeOpponentRequest
        ? rejected(prior, "opponent-request-active")
        : rejected(prior, "invalid-lifecycle");
    }
    if (isStaleExpectedRevision(prior.revision, command.expectedRevision)) {
      return rejected(prior, "stale-revision");
    }

    const requestedColor = this.rules.getTurn();
    if (prior.configuration.participants[requestedColor].kind !== "external-opponent") {
      return rejected(prior, "wrong-actor");
    }

    const request = freezeOpponentRequestSnapshot({
      expectedFen: prior.position.fen,
      expectedPly: prior.position.ply,
      expectedRevision: prior.revision,
      requestId: command.requestId,
      requestedColor,
    });
    const lifecycle = transitionLifecycleOrThrow(prior.lifecycle, {
      type: "request-opponent-move",
    });
    const revision = nextRevision(prior.revision);
    const session = this.commitSession({
      activeOpponentRequest: request,
      clock: prior.clock,
      history: prior.history,
      lifecycle,
      position: prior.position,
      result: undefined,
      revision,
    });
    const events = freezeEvents({
      gameId: session.gameId,
      request,
      revision,
      type: "opponent-move-requested",
    });

    return { events, request, session, status: "applied" };
  }

  commitOpponentMove(
    proposal: OpponentMoveProposal,
    now: MonotonicTimestampMs,
  ): GameMoveCommandResult {
    const prior = this.session;
    const rejection = this.validateMoveLifecycle(prior, "awaiting-opponent");
    if (rejection) {
      return rejection;
    }

    const request = prior.activeOpponentRequest;
    if (!request) {
      return rejected(prior, "missing-opponent-request");
    }
    if (proposal.requestId !== request.requestId) {
      return rejected(prior, "request-id-mismatch");
    }
    if (
      proposal.expectedFen !== request.expectedFen ||
      proposal.expectedFen !== prior.position.fen
    ) {
      return rejected(prior, "position-mismatch");
    }
    if (
      proposal.expectedPly !== request.expectedPly ||
      proposal.expectedPly !== prior.position.ply
    ) {
      return rejected(prior, "ply-mismatch");
    }
    if (proposal.expectedRevision !== request.expectedRevision) {
      return rejected(prior, "stale-revision");
    }
    if (
      proposal.requestedColor !== request.requestedColor ||
      proposal.requestedColor !== this.rules.getTurn()
    ) {
      return rejected(prior, "request-color-mismatch");
    }
    if (prior.configuration.participants[proposal.requestedColor].kind !== "external-opponent") {
      return rejected(prior, "wrong-actor");
    }

    return this.commitAuthoritativeMove(prior, "external-opponent", proposal.move, now);
  }

  rejectOpponentRequest(command: OpponentRequestFailureCommand): GameCommandResult {
    const prior = this.session;
    const terminalRejection = rejectTerminalSession(prior);
    if (terminalRejection) {
      return terminalRejection;
    }
    if (prior.lifecycle.phase === "paused") {
      return rejected(prior, "already-paused");
    }
    if (prior.lifecycle.phase !== "awaiting-opponent") {
      return rejected(prior, "invalid-lifecycle");
    }
    if (isStaleExpectedRevision(prior.revision, command.expectedRevision)) {
      return rejected(prior, "stale-revision");
    }

    const request = prior.activeOpponentRequest;
    if (!request) {
      return rejected(prior, "missing-opponent-request");
    }
    if (request.requestId !== command.requestId) {
      return rejected(prior, "request-id-mismatch");
    }

    const lifecycle = transitionLifecycleOrThrow(prior.lifecycle, {
      type: "enter-degraded-mode",
    });
    const revision = nextRevision(prior.revision);
    const session = this.commitSession({
      activeOpponentRequest: undefined,
      clock: prior.clock,
      history: prior.history,
      lifecycle,
      position: prior.position,
      result: undefined,
      revision,
    });
    const events = freezeEvents(
      {
        gameId: session.gameId,
        reason: command.reason,
        requestId: command.requestId,
        revision,
        type: "opponent-request-failed",
      },
      {
        gameId: session.gameId,
        reason: command.reason,
        revision,
        type: "game-entered-degraded-mode",
      },
    );

    return { events, session, status: "applied" };
  }

  pause(now: MonotonicTimestampMs): GameCommandResult {
    const prior = this.session;
    const terminalRejection = rejectTerminalSession(prior);
    if (terminalRejection) {
      return terminalRejection;
    }
    if (prior.lifecycle.phase === "paused") {
      return rejected(prior, "already-paused");
    }
    if (!isResumableGamePhase(prior.lifecycle.phase)) {
      return rejected(prior, "invalid-lifecycle");
    }

    const clockResult = pauseClock(prior.clock, now);
    if (clockResult.status === "rejected") {
      return rejected(prior, mapClockRejection(clockResult.reason));
    }
    if (clockResult.status === "expired") {
      return this.completeByTimeout(prior, clockResult.state, clockResult.expiredColor);
    }

    const resumePhase = prior.lifecycle.phase;
    const lifecycle = transitionLifecycleOrThrow(prior.lifecycle, { type: "pause" });
    const revision = nextRevision(prior.revision);
    const session = this.commitSession({
      activeOpponentRequest: prior.activeOpponentRequest,
      clock: clockResult.state,
      history: prior.history,
      lifecycle,
      position: prior.position,
      result: undefined,
      revision,
    });
    const events = freezeEvents({
      gameId: session.gameId,
      resumePhase,
      revision,
      type: "game-paused",
    });

    return { events, session, status: "applied" };
  }

  resume(now: MonotonicTimestampMs): GameCommandResult {
    const prior = this.session;
    const terminalRejection = rejectTerminalSession(prior);
    if (terminalRejection) {
      return terminalRejection;
    }
    if (prior.lifecycle.phase !== "paused") {
      return rejected(prior, "not-paused");
    }

    const resumedPhase = prior.lifecycle.resumePhase;
    if (resumedPhase === "awaiting-opponent" && !prior.activeOpponentRequest) {
      throw new GameControllerError(
        "controller-invariant-failure",
        "A paused awaiting-opponent session lost its pending request.",
      );
    }

    const clockResult = resumeClock(prior.clock, now);
    if (clockResult.status !== "applied") {
      return clockResult.status === "rejected"
        ? rejected(prior, mapClockRejection(clockResult.reason))
        : this.completeByTimeout(prior, clockResult.state, clockResult.expiredColor);
    }

    const lifecycle = transitionLifecycleOrThrow(prior.lifecycle, { type: "resume" });
    const revision = nextRevision(prior.revision);
    const session = this.commitSession({
      activeOpponentRequest: prior.activeOpponentRequest,
      clock: clockResult.state,
      history: prior.history,
      lifecycle,
      position: prior.position,
      result: undefined,
      revision,
    });
    const events = freezeEvents({
      gameId: session.gameId,
      resumedPhase,
      revision,
      type: "game-resumed",
    });

    return { events, session, status: "applied" };
  }

  abandon(command: AbandonGameCommand): GameCommandResult {
    const prior = this.session;
    const terminalRejection = rejectTerminalSession(prior);
    if (terminalRejection) {
      return terminalRejection;
    }

    let clock = prior.clock;
    if (clock.status !== "idle") {
      const clockResult = stopClock(clock, command.now);
      if (clockResult.status === "rejected") {
        return rejected(prior, mapClockRejection(clockResult.reason));
      }
      if (clockResult.status === "expired") {
        return this.completeByTimeout(prior, clockResult.state, clockResult.expiredColor);
      }
      clock = clockResult.state;
    }

    const lifecycle = transitionLifecycleOrThrow(prior.lifecycle, { type: "abandon" });
    const result = createAbandonedGameResult(command.awardedWinner);
    const revision = nextRevision(prior.revision);
    const session = this.commitSession({
      activeOpponentRequest: undefined,
      clock,
      history: prior.history,
      lifecycle,
      position: prior.position,
      result,
      revision,
    });
    const events = freezeEvents({
      gameId: session.gameId,
      result,
      revision,
      type: "game-abandoned",
    });

    return { events, result, session, status: "completed" };
  }

  undoMoves(command: UndoMoveCommand): UndoMoveCommandResult {
    const prior = this.session;
    if (!prior.configuration.allowUndo) {
      return rejectedUndo(prior, "undo-disabled");
    }
    if (command.plies !== 1 && command.plies !== 2) {
      return rejectedUndo(prior, "invalid-undo-count");
    }
    const plies: 1 | 2 = command.plies;
    if (isStaleExpectedRevision(prior.revision, command.expectedRevision)) {
      return rejectedUndo(prior, "stale-revision");
    }
    if (prior.lifecycle.phase === "abandoned") {
      return rejectedUndo(prior, "game-abandoned");
    }
    if (prior.lifecycle.phase === "paused") {
      return rejectedUndo(prior, "game-paused");
    }
    if (!isUndoablePhase(prior.lifecycle.phase)) {
      return rejectedUndo(prior, "invalid-lifecycle");
    }
    if (prior.history.length < plies) {
      return rejectedUndo(prior, "insufficient-history");
    }

    const retainedHistory = Object.freeze(prior.history.slice(0, -plies));
    const removedMoves = Object.freeze(prior.history.slice(-plies));
    const earliestRemovedMove = removedMoves[0];
    if (!earliestRemovedMove) {
      return rejectedUndo(prior, "insufficient-history");
    }

    const restoredPosition = this.rebuildRulesTransactionally(retainedHistory, prior.history);
    if (!restoredPosition || restoredPosition.terminalState.status !== "ongoing") {
      if (restoredPosition) {
        this.restoreRulesHistoryOrThrow(prior.history, prior.position.fen);
      }
      return rejectedUndo(prior, "internal-restoration-failure");
    }

    const clockRebase = rebaseActiveClock(
      earliestRemovedMove.clockBefore,
      restoredPosition.turn,
      command.now,
    );
    if (clockRebase.status === "rejected") {
      this.restoreRulesHistoryOrThrow(prior.history, prior.position.fen);
      return rejectedUndo(prior, "internal-restoration-failure");
    }

    const lifecycle = activeLifecycleFor(restoredPosition.turn, prior.configuration);
    const revision = nextRevision(prior.revision);

    try {
      const session = this.commitSession({
        activeOpponentRequest: undefined,
        clock: clockRebase.state,
        history: retainedHistory,
        lifecycle,
        position: restoredPosition,
        result: undefined,
        revision,
      });
      const events: GameDomainEvent[] = [];
      if (prior.activeOpponentRequest) {
        events.push({
          gameId: session.gameId,
          reason: "undo",
          requestId: prior.activeOpponentRequest.requestId,
          revision,
          type: "opponent-request-cancelled",
        });
      }
      events.push({
        gameId: session.gameId,
        removedMoves,
        removedPlies: command.plies,
        restoredFen: restoredPosition.fen,
        restoredTurn: restoredPosition.turn,
        revision,
        type: "moves-undone",
      });
      if (prior.lifecycle.phase === "completed") {
        events.push({ gameId: session.gameId, revision, type: "game-reopened" });
      }

      return {
        events: freezeEvents(...events),
        removedMoves,
        session,
        status: "applied",
      };
    } catch (error: unknown) {
      this.restoreRulesHistoryOrThrow(prior.history, prior.position.fen);
      if (error instanceof GameControllerError) {
        return rejectedUndo(prior, "internal-restoration-failure");
      }
      throw error;
    }
  }

  restart(command: RestartGameCommand): RestartGameCommandResult {
    const prior = this.session;
    if (isStaleExpectedRevision(prior.revision, command.expectedRevision)) {
      return rejectedRestart(prior, "stale-revision");
    }
    if (prior.lifecycle.phase === "creating" || prior.lifecycle.phase === "committing") {
      return rejectedRestart(prior, "invalid-lifecycle");
    }
    if (prior.lifecycle.phase === "ready" && isPristineReadySession(prior)) {
      return rejectedRestart(prior, "already-reset");
    }

    const position = this.rebuildRulesTransactionally([], prior.history);
    if (!position || position.terminalState.status !== "ongoing") {
      if (position) {
        this.restoreRulesHistoryOrThrow(prior.history, prior.position.fen);
      }
      return rejectedRestart(prior, "internal-restoration-failure");
    }

    const revision = nextRevision(prior.revision);
    try {
      const session = this.commitSession({
        activeOpponentRequest: undefined,
        clock: createInitialClock(prior.configuration),
        history: [],
        lifecycle: { phase: "ready" },
        position,
        result: undefined,
        revision,
      });
      return {
        events: freezeEvents({
          gameId: session.gameId,
          revision,
          type: "game-restarted",
        }),
        session,
        status: "applied",
      };
    } catch (error: unknown) {
      this.restoreRulesHistoryOrThrow(prior.history, prior.position.fen);
      if (error instanceof GameControllerError) {
        return rejectedRestart(prior, "internal-restoration-failure");
      }
      throw error;
    }
  }

  private commitAuthoritativeMove(
    prior: GameSession,
    actor: "external-opponent" | "human",
    move: MoveInput,
    now: MonotonicTimestampMs,
  ): GameMoveCommandResult {
    const terminalState = this.rules.getTerminalState();
    if (terminalState.status !== "ongoing") {
      return this.completeExistingTerminal(prior, terminalState, now);
    }

    const clockSnapshot = snapshotClock(prior.clock, now);
    if (clockSnapshot.status === "rejected") {
      return rejected(prior, mapClockRejection(clockSnapshot.reason));
    }
    if (clockSnapshot.status === "expired") {
      return this.completeByTimeout(prior, clockSnapshot.state, clockSnapshot.expiredColor);
    }

    transitionLifecycleOrThrow(prior.lifecycle, { type: "begin-commit" });
    const revision = nextRevision(prior.revision);
    let moveResult: MoveApplicationResult;

    try {
      moveResult = this.rules.attemptMove(move);
    } catch (error: unknown) {
      this.restoreRulesPosition(prior.position.fen);
      throw new GameControllerError(
        "controller-invariant-failure",
        "The chess-rules boundary failed while applying a validated move.",
        { cause: error },
      );
    }

    if (moveResult.status === "rejected") {
      this.assertRejectedMovePreservedRules(prior.position.fen);
      return rejected(prior, mapMoveRejection(moveResult.reason));
    }

    try {
      if (
        moveResult.fenBefore !== prior.position.fen ||
        moveResult.move.color !== prior.position.turn
      ) {
        throw new GameControllerError(
          "controller-invariant-failure",
          "The chess-rules move result did not match the authoritative session.",
        );
      }

      const clockCommit = commitClockMove(clockSnapshot.state, moveResult.move.color, now);
      if (clockCommit.status !== "applied") {
        throw new GameControllerError(
          "controller-invariant-failure",
          `The clock rejected a chess move after rules commitment: ${clockCommit.status}.`,
        );
      }

      const position = this.createPositionSnapshot(parsePly(prior.history.length + 1));
      if (position.fen !== moveResult.fenAfter) {
        throw new GameControllerError(
          "controller-invariant-failure",
          "The rules position did not match the committed move result.",
        );
      }

      const terminal = position.terminalState;
      const result =
        terminal.status === "ongoing" ? undefined : createGameResultFromTerminalState(terminal);
      const finalClock = result
        ? stopClockForCompletion(clockCommit.state, now)
        : clockCommit.state;
      const lifecycle = result
        ? transitionLifecycleOrThrow({ phase: "committing" }, { type: "complete-game" })
        : transitionLifecycleOrThrow(
            { phase: "committing" },
            this.nextTurnEvent(position.turn, prior.configuration),
          );
      const record = freezeMoveRecordSnapshot({
        actor,
        ...(moveResult.move.captured ? { captured: moveResult.move.captured } : {}),
        clockAfter: finalClock,
        clockBefore: clockSnapshot.state,
        fenAfter: moveResult.fenAfter,
        fenBefore: moveResult.fenBefore,
        givesCheck: position.inCheck,
        givesCheckmate: terminal.status === "checkmate",
        mover: moveResult.move.color,
        ply: position.ply,
        ...(moveResult.move.promotion ? { promotion: moveResult.move.promotion } : {}),
        san: moveResult.move.san,
        uci: moveResult.move.uci,
      });
      const history = Object.freeze([...prior.history, record]);
      const session = this.commitSession({
        activeOpponentRequest: undefined,
        clock: finalClock,
        history,
        lifecycle,
        position,
        result,
        revision,
      });
      const events = result
        ? freezeEvents(
            {
              gameId: session.gameId,
              move: record,
              revision,
              type: "move-committed",
            },
            {
              gameId: session.gameId,
              result,
              revision,
              type: "game-completed",
            },
          )
        : freezeEvents({
            gameId: session.gameId,
            move: record,
            revision,
            type: "move-committed",
          });

      return result
        ? { events, move: record, result, session, status: "completed" }
        : { events, move: record, session, status: "applied" };
    } catch (error: unknown) {
      this.restoreRulesPosition(prior.position.fen);
      throw error instanceof GameControllerError
        ? error
        : new GameControllerError(
            "controller-invariant-failure",
            "The authoritative move commit failed after rules application.",
            { cause: error },
          );
    }
  }

  private completeExistingTerminal(
    prior: GameSession,
    terminalState: Exclude<TerminalState, { readonly status: "ongoing" }>,
    now: MonotonicTimestampMs,
  ): GameMoveCommandResult {
    const result = createGameResultFromTerminalState(terminalState);
    const revision = nextRevision(prior.revision);
    const clock = stopClockForCompletion(prior.clock, now);
    const lifecycle = transitionToCompleted(prior.lifecycle);
    const position = this.createPositionSnapshot(prior.position.ply);
    const session = this.commitSession({
      activeOpponentRequest: undefined,
      clock,
      history: prior.history,
      lifecycle,
      position,
      result,
      revision,
    });
    const events = freezeEvents({
      gameId: session.gameId,
      result,
      revision,
      type: "game-completed",
    });

    return { events, move: undefined, result, session, status: "completed" };
  }

  private completeByTimeout(
    prior: GameSession,
    clock: ClockState,
    expiredColor: Color,
  ): GameMoveCommandResult {
    const result = createTimeoutGameResult(expiredColor);
    const revision = nextRevision(prior.revision);
    const lifecycle = transitionToCompleted(prior.lifecycle);
    const session = this.commitSession({
      activeOpponentRequest: undefined,
      clock,
      history: prior.history,
      lifecycle,
      position: prior.position,
      result,
      revision,
    });
    const events = freezeEvents(
      {
        expiredColor,
        gameId: session.gameId,
        revision,
        type: "clock-expired",
      },
      {
        gameId: session.gameId,
        result,
        revision,
        type: "game-completed",
      },
    );

    return { events, move: undefined, result, session, status: "completed" };
  }

  private validateMoveLifecycle(
    session: GameSession,
    expectedPhase: "awaiting-opponent" | "player-turn",
  ): GameCommandRejectedResult | undefined {
    const terminalRejection = rejectTerminalSession(session);
    if (terminalRejection) {
      return terminalRejection;
    }
    if (session.lifecycle.phase === "paused") {
      return rejected(session, "already-paused");
    }
    return session.lifecycle.phase === expectedPhase
      ? undefined
      : rejected(session, "invalid-lifecycle");
  }

  private nextTurnEvent(turn: Color, configuration: GameConfiguration): GameLifecycleEvent {
    return {
      type:
        configuration.participants[turn].kind === "human"
          ? "commit-to-player-turn"
          : "commit-to-opponent-turn",
    };
  }

  private loadConfiguredPosition(configuration: GameConfiguration): PositionSnapshot {
    try {
      if (configuration.initialPosition.kind === "standard") {
        this.rules.createInitialPosition();
      } else {
        this.rules.loadFen(configuration.initialPosition.fen);
      }
      return this.createPositionSnapshot(parsePly(0));
    } catch (error: unknown) {
      throw new GameControllerError(
        "invalid-game-configuration",
        "The configured initial chess position could not be loaded.",
        { cause: error },
      );
    }
  }

  private createPositionSnapshot(ply: ReturnType<typeof parsePly>): PositionSnapshot {
    return freezePositionSnapshot({
      fen: this.rules.getFen(),
      inCheck: this.rules.isCheck(),
      ply,
      terminalState: this.rules.getTerminalState(),
      turn: this.rules.getTurn(),
    });
  }

  private rebuildRulesTransactionally(
    targetHistory: readonly MoveRecord[],
    priorHistory: readonly MoveRecord[],
  ): PositionSnapshot | undefined {
    try {
      return this.rebuildRulesFromHistory(targetHistory);
    } catch {
      this.restoreRulesHistoryOrThrow(priorHistory, this.session.position.fen);
      return undefined;
    }
  }

  private rebuildRulesFromHistory(history: readonly MoveRecord[]): PositionSnapshot {
    if (this.session.configuration.initialPosition.kind === "standard") {
      this.rules.createInitialPosition();
    } else {
      this.rules.loadFen(this.session.configuration.initialPosition.fen);
    }

    for (const record of history) {
      if (this.rules.getFen() !== record.fenBefore) {
        throw new GameControllerError(
          "rules-restoration-failed",
          "Move history does not connect to the reconstructed rules position.",
        );
      }
      const replay = this.rules.attemptMove(moveInputFromUci(record.uci));
      if (
        replay.status !== "committed" ||
        replay.move.uci !== record.uci ||
        replay.move.san !== record.san ||
        replay.fenAfter !== record.fenAfter
      ) {
        throw new GameControllerError(
          "rules-restoration-failed",
          "A committed move could not be reproduced while rebuilding rules state.",
        );
      }
    }

    return this.createPositionSnapshot(parsePly(history.length));
  }

  private restoreRulesHistoryOrThrow(history: readonly MoveRecord[], expectedFen: Fen): void {
    try {
      const restored = this.rebuildRulesFromHistory(history);
      if (restored.fen !== expectedFen) {
        throw new GameControllerError(
          "rules-restoration-failed",
          "Rules rollback did not restore the prior authoritative FEN.",
        );
      }
    } catch (error: unknown) {
      throw error instanceof GameControllerError
        ? error
        : new GameControllerError(
            "rules-restoration-failed",
            "Rules rollback failed after an unsuccessful reconstruction.",
            { cause: error },
          );
    }
  }

  private assertRejectedMovePreservedRules(expectedFen: Fen): void {
    if (this.rules.getFen() !== expectedFen) {
      this.restoreRulesPosition(expectedFen);
      throw new GameControllerError(
        "controller-invariant-failure",
        "A rejected chess move mutated the rules position.",
      );
    }
  }

  private restoreRulesPosition(expectedFen: Fen): void {
    let currentFen: Fen;
    try {
      currentFen = this.rules.getFen();
    } catch (error: unknown) {
      throw new GameControllerError(
        "move-rollback-failed",
        "The rules position could not be inspected during rollback.",
        { cause: error },
      );
    }

    if (currentFen === expectedFen) {
      return;
    }

    try {
      const undo = this.rules.undo();
      if (undo.status !== "undone" || undo.restoredFen !== expectedFen) {
        throw new GameControllerError(
          "move-rollback-failed",
          "The rules adapter could not restore the prior authoritative position.",
        );
      }
    } catch (error: unknown) {
      throw error instanceof GameControllerError
        ? error
        : new GameControllerError(
            "move-rollback-failed",
            "The rules adapter threw while restoring the prior position.",
            { cause: error },
          );
    }
  }

  private commitSession(next: Omit<GameSession, "configuration" | "gameId">): GameSession {
    const session = freezeGameSessionSnapshot({
      ...next,
      configuration: this.session.configuration,
      gameId: this.session.gameId,
    });
    assertSessionInvariants(session, this.rules);
    this.session = session;
    return session;
  }
}

function rejectedUndo(
  session: GameSession,
  reason: UndoMoveRejectionReason,
): Extract<UndoMoveCommandResult, { readonly status: "rejected" }> {
  return { events: emptyEvents, reason, session, status: "rejected" };
}

function rejectedRestart(
  session: GameSession,
  reason: RestartGameRejectionReason,
): Extract<RestartGameCommandResult, { readonly status: "rejected" }> {
  return { events: emptyEvents, reason, session, status: "rejected" };
}

function rejected(
  session: GameSession,
  reason: GameCommandRejectionReason,
): GameCommandRejectedResult {
  return { events: emptyEvents, reason, session, status: "rejected" };
}

function isUndoablePhase(phase: GameLifecycleState["phase"]): boolean {
  return (
    phase === "player-turn" ||
    phase === "opponent-turn" ||
    phase === "awaiting-opponent" ||
    phase === "degraded" ||
    phase === "completed"
  );
}

function activeLifecycleFor(
  turn: Color,
  configuration: GameConfiguration,
): Extract<GameLifecycleState, { readonly phase: "opponent-turn" | "player-turn" }> {
  return configuration.participants[turn].kind === "human"
    ? { phase: "player-turn" }
    : { phase: "opponent-turn" };
}

function isPristineReadySession(session: GameSession): boolean {
  const clockIsFresh =
    (session.clock.status === "idle" || session.clock.status === "untimed") &&
    session.clock.lastTimestampMs === undefined;
  return (
    clockIsFresh &&
    session.history.length === 0 &&
    session.position.ply === 0 &&
    session.result === undefined &&
    session.activeOpponentRequest === undefined
  );
}

function rejectTerminalSession(session: GameSession): GameCommandRejectedResult | undefined {
  if (session.lifecycle.phase === "completed") {
    return rejected(session, "already-completed");
  }
  if (session.lifecycle.phase === "abandoned") {
    return rejected(session, "already-abandoned");
  }
  return undefined;
}

function isStaleExpectedRevision(
  currentRevision: SessionRevision,
  expectedRevision: SessionRevision | undefined,
): boolean {
  return expectedRevision !== undefined && expectedRevision !== currentRevision;
}

function nextRevision(revision: SessionRevision): SessionRevision {
  try {
    return parseSessionRevision(revision + 1);
  } catch (error: unknown) {
    throw new GameControllerError(
      "controller-invariant-failure",
      "The game-session revision cannot be incremented safely.",
      { cause: error },
    );
  }
}

function mapClockRejection(reason: ClockTransitionRejectionReason): GameCommandRejectionReason {
  return reason === "timestamp-regression" ? "timestamp-regression" : "invalid-lifecycle";
}

function mapMoveRejection(reason: MoveRejectionReason): GameCommandRejectionReason {
  return reason;
}

function transitionLifecycleOrThrow(
  current: GameLifecycleState,
  event: GameLifecycleEvent,
): GameLifecycleState {
  const transition = transitionGameLifecycle(current, event);
  if (transition.status === "rejected") {
    throw new GameControllerError(
      "controller-invariant-failure",
      `Lifecycle rejected ${event.type} from ${current.phase}.`,
    );
  }
  return transition.state;
}

function transitionToCompleted(current: GameLifecycleState): GameLifecycleState {
  if (current.phase === "degraded") {
    const committing = transitionLifecycleOrThrow(current, { type: "begin-commit" });
    return transitionLifecycleOrThrow(committing, { type: "complete-game" });
  }
  return transitionLifecycleOrThrow(current, { type: "complete-game" });
}

function isResumableGamePhase(phase: GameLifecycleState["phase"]): phase is ResumableGamePhase {
  return (
    phase === "player-turn" ||
    phase === "opponent-turn" ||
    phase === "awaiting-opponent" ||
    phase === "degraded"
  );
}

function stopClockForCompletion(clock: ClockState, now: MonotonicTimestampMs): ClockState {
  if (clock.status === "idle" || clock.status === "stopped" || clock.status === "expired") {
    return clock;
  }

  const result = stopClock(clock, now);
  if (result.status === "rejected") {
    throw new GameControllerError(
      "controller-invariant-failure",
      `Clock could not stop during completion: ${result.reason}.`,
    );
  }
  return result.state;
}

function assertSessionInvariants(session: GameSession, rules: ChessRulesPort): void {
  const isTerminal =
    session.lifecycle.phase === "completed" || session.lifecycle.phase === "abandoned";
  if (isTerminal !== (session.result !== undefined)) {
    throw new GameControllerError(
      "controller-invariant-failure",
      "Terminal lifecycle and final result are inconsistent.",
    );
  }
  if (session.history.length !== session.position.ply) {
    throw new GameControllerError(
      "controller-invariant-failure",
      "Move history length and session-relative ply differ.",
    );
  }
  if (session.position.fen !== rules.getFen() || session.position.turn !== rules.getTurn()) {
    throw new GameControllerError(
      "controller-invariant-failure",
      "Position snapshot differs from the chess-rules authority.",
    );
  }
  if (
    session.clock.status === "running" &&
    session.lifecycle.phase !== "completed" &&
    session.lifecycle.phase !== "abandoned" &&
    session.clock.activeColor !== session.position.turn
  ) {
    throw new GameControllerError(
      "controller-invariant-failure",
      "The active timed clock does not match the rules-authority turn.",
    );
  }

  const requestAllowed =
    session.lifecycle.phase === "awaiting-opponent" ||
    (session.lifecycle.phase === "paused" && session.lifecycle.resumePhase === "awaiting-opponent");
  if ((session.activeOpponentRequest !== undefined) !== requestAllowed) {
    throw new GameControllerError(
      "controller-invariant-failure",
      "Pending opponent request and lifecycle phase are inconsistent.",
    );
  }
}

function freezeEvents(...events: readonly GameDomainEvent[]): readonly GameDomainEvent[] {
  return Object.freeze(events.map((event) => Object.freeze({ ...event })));
}
