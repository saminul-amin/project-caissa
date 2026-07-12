import { commitClockMove, stopClock, type ClockState, type TimeControl } from "./clock";
import { parseClockDurationMs, parseMonotonicTimestampMs } from "./clock-primitives";
import {
  moveInputFromUci,
  type ChessRulesPort,
  type PieceType,
  type PromotionPiece,
  type TerminalState,
} from "./chess-rules";
import { createRestoredGameController, type GameController } from "./game-controller";
import { GAME_SESSION_CHECKPOINT_VERSION } from "./game-checkpoint";
import type {
  GameLifecycleFailureCode,
  GameLifecycleState,
  ResumableGamePhase,
} from "./game-lifecycle";
import {
  createGameResultFromTerminalState,
  type CompletedGameResult,
  type GameResult,
} from "./game-result";
import {
  createGameConfiguration,
  type GameConfiguration,
  type GameSession,
  type MoveRecord,
  type OpponentRequestState,
  type ParticipantKind,
  type PositionSnapshot,
} from "./game-session";
import { freezeGameSessionSnapshot } from "./game-snapshot";
import {
  parseColor,
  parseFen,
  parseGameId,
  parsePly,
  parseRequestId,
  parseSanMove,
  parseSessionRevision,
  parseUciMove,
  type Color,
  type SessionRevision,
} from "./primitives";

export type GameRestorationRejectionReason =
  | "actor-mismatch"
  | "clock-history-mismatch"
  | "clock-state-mismatch"
  | "illegal-replayed-move"
  | "internal-restoration-failure"
  | "invalid-configuration"
  | "invalid-history"
  | "invalid-initial-position"
  | "invalid-revision"
  | "lifecycle-mismatch"
  | "move-record-mismatch"
  | "non-continuous-ply"
  | "opponent-request-mismatch"
  | "position-mismatch"
  | "result-mismatch"
  | "unsupported-checkpoint-version";

export interface RestoreGameControllerOptions {
  readonly checkpoint: unknown;
  readonly createRules: () => ChessRulesPort;
}

export type GameControllerRestorationResult =
  | {
      readonly controller: GameController;
      readonly session: GameSession;
      readonly status: "restored";
    }
  | {
      readonly reason: GameRestorationRejectionReason;
      readonly status: "rejected";
    };

class RestorationValidationError extends Error {
  readonly reason: GameRestorationRejectionReason;

  constructor(reason: GameRestorationRejectionReason) {
    super(reason);
    this.name = "RestorationValidationError";
    this.reason = reason;
  }
}

/** Reconstructs a controller only after replay and all checkpoint invariants succeed. */
export function restoreGameController(
  options: RestoreGameControllerOptions,
): GameControllerRestorationResult {
  try {
    const checkpoint = requireRecord(options.checkpoint, "unsupported-checkpoint-version");
    if (checkpoint.checkpointVersion !== GAME_SESSION_CHECKPOINT_VERSION) {
      fail("unsupported-checkpoint-version");
    }

    const configuration = parseConfiguration(checkpoint.configuration);
    const gameId = parseCheckpointGameId(checkpoint.gameId, configuration);
    const revision = parseCheckpointRevision(checkpoint.revision);
    const rules = createFreshRules(options.createRules);
    loadInitialPosition(rules, configuration);
    const history = parseAndReplayHistory(checkpoint.history, configuration, rules);
    const position = parsePosition(checkpoint.position);
    validateFinalPosition(position, history, rules);
    const lifecycle = parseLifecycle(checkpoint.lifecycle);
    const clock = parseClockState(checkpoint.clock, configuration.timeControl);
    const result = parseResult(checkpoint.result);
    const activeOpponentRequest = parseOpponentRequest(checkpoint.activeOpponentRequest);

    const session = freezeGameSessionSnapshot({
      activeOpponentRequest,
      clock,
      configuration,
      gameId,
      history,
      lifecycle,
      position,
      result,
      revision,
    });
    validateSessionSemantics(session, rules);

    const controller = createRestoredGameController(rules, session);
    return { controller, session: controller.getSession(), status: "restored" };
  } catch (error: unknown) {
    return error instanceof RestorationValidationError
      ? { reason: error.reason, status: "rejected" }
      : { reason: "internal-restoration-failure", status: "rejected" };
  }
}

function parseConfiguration(value: unknown): GameConfiguration {
  try {
    return createGameConfiguration(value);
  } catch {
    if (hasInvalidInitialFen(value)) {
      fail("invalid-initial-position");
    }
    fail("invalid-configuration");
  }
}

function hasInvalidInitialFen(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.initialPosition)) return false;
  const initialPosition = value.initialPosition;
  if (initialPosition.kind !== "fen") return false;
  if (typeof initialPosition.fen !== "string") return true;
  try {
    parseFen(initialPosition.fen);
    return false;
  } catch {
    return true;
  }
}

function parseCheckpointGameId(value: unknown, configuration: GameConfiguration) {
  if (typeof value !== "string") fail("invalid-configuration");
  try {
    const gameId = parseGameId(value);
    if (gameId !== configuration.gameId) fail("invalid-configuration");
    return gameId;
  } catch (error: unknown) {
    if (error instanceof RestorationValidationError) throw error;
    fail("invalid-configuration");
  }
}

function parseCheckpointRevision(value: unknown): SessionRevision {
  if (typeof value !== "number") fail("invalid-revision");
  try {
    return parseSessionRevision(value);
  } catch {
    fail("invalid-revision");
  }
}

function createFreshRules(createRules: () => ChessRulesPort): ChessRulesPort {
  try {
    const candidate: unknown = createRules();
    if (
      !isRecord(candidate) ||
      typeof candidate.getFen !== "function" ||
      typeof candidate.attemptMove !== "function"
    ) {
      fail("internal-restoration-failure");
    }
    return candidate as unknown as ChessRulesPort;
  } catch (error: unknown) {
    if (error instanceof RestorationValidationError) throw error;
    fail("internal-restoration-failure");
  }
}

function loadInitialPosition(rules: ChessRulesPort, configuration: GameConfiguration): void {
  try {
    if (configuration.initialPosition.kind === "standard") {
      rules.createInitialPosition();
    } else {
      rules.loadFen(configuration.initialPosition.fen);
    }
  } catch {
    fail("invalid-initial-position");
  }
}

function parseAndReplayHistory(
  value: unknown,
  configuration: GameConfiguration,
  rules: ChessRulesPort,
): readonly MoveRecord[] {
  if (!Array.isArray(value)) fail("invalid-history");

  const history: MoveRecord[] = [];
  for (const [index, candidate] of value.entries()) {
    const record = parseMoveRecord(candidate, index, configuration, rules);
    const previous = history.at(-1);
    if (previous) validateSequentialClock(previous, record);
    history.push(record);
  }
  return Object.freeze(history);
}

function parseMoveRecord(
  value: unknown,
  index: number,
  configuration: GameConfiguration,
  rules: ChessRulesPort,
): MoveRecord {
  const record = requireRecord(value, "invalid-history");
  const ply = parseRecordPly(record.ply, index);
  const mover = parseRecordColor(record.mover, "move-record-mismatch");
  const actor = parseActor(record.actor);
  if (configuration.participants[mover].kind !== actor) fail("actor-mismatch");

  const uci = parseRecordUci(record.uci);
  const san = parseRecordSan(record.san);
  const fenBefore = parseRecordFen(record.fenBefore);
  const fenAfter = parseRecordFen(record.fenAfter);
  if (rules.getFen() !== fenBefore || rules.getTurn() !== mover) fail("move-record-mismatch");

  const clockBefore = parseClockState(record.clockBefore, configuration.timeControl);
  const replay = rules.attemptMove(moveInputFromUci(uci));
  if (replay.status === "rejected") fail("illegal-replayed-move");
  if (
    replay.fenBefore !== fenBefore ||
    replay.fenAfter !== fenAfter ||
    replay.move.uci !== uci ||
    replay.move.san !== san ||
    replay.move.color !== mover
  ) {
    fail("move-record-mismatch");
  }

  const captured = parseOptionalPiece(record.captured);
  const promotion = parseOptionalPromotion(record.promotion);
  if (captured !== replay.move.captured || promotion !== replay.move.promotion) {
    fail("move-record-mismatch");
  }

  if (typeof record.givesCheck !== "boolean" || typeof record.givesCheckmate !== "boolean") {
    fail("invalid-history");
  }
  const terminalState = rules.getTerminalState();
  if (
    record.givesCheck !== rules.isCheck() ||
    record.givesCheckmate !== (terminalState.status === "checkmate")
  ) {
    fail("move-record-mismatch");
  }

  const clockAfter = parseClockState(record.clockAfter, configuration.timeControl);
  validateMoveClock(clockBefore, clockAfter, mover, terminalState.status !== "ongoing");

  return Object.freeze({
    actor,
    ...(captured ? { captured } : {}),
    clockAfter,
    clockBefore,
    fenAfter,
    fenBefore,
    givesCheck: record.givesCheck,
    givesCheckmate: record.givesCheckmate,
    mover,
    ply,
    ...(promotion ? { promotion } : {}),
    san,
    uci,
  });
}

function parseRecordPly(value: unknown, index: number) {
  if (typeof value !== "number") fail("invalid-history");
  let ply: ReturnType<typeof parsePly>;
  try {
    ply = parsePly(value);
  } catch {
    fail("invalid-history");
  }
  if (ply !== index + 1) fail("non-continuous-ply");
  return ply;
}

function parseRecordColor(value: unknown, reason: GameRestorationRejectionReason): Color {
  if (typeof value !== "string") fail(reason);
  try {
    return parseColor(value);
  } catch {
    fail(reason);
  }
}

function parseActor(value: unknown): ParticipantKind {
  if (value !== "human" && value !== "external-opponent") fail("actor-mismatch");
  return value;
}

function parseRecordUci(value: unknown) {
  if (typeof value !== "string") fail("invalid-history");
  try {
    return parseUciMove(value);
  } catch {
    fail("invalid-history");
  }
}

function parseRecordSan(value: unknown) {
  if (typeof value !== "string") fail("invalid-history");
  try {
    return parseSanMove(value);
  } catch {
    fail("invalid-history");
  }
}

function parseRecordFen(value: unknown) {
  if (typeof value !== "string") fail("invalid-history");
  try {
    return parseFen(value);
  } catch {
    fail("invalid-history");
  }
}

const pieceTypes = ["bishop", "king", "knight", "pawn", "queen", "rook"] as const;
const promotionTypes = ["bishop", "knight", "queen", "rook"] as const;

function parseOptionalPiece(value: unknown): PieceType | undefined {
  if (value === undefined) return undefined;
  if (!pieceTypes.some((piece) => piece === value)) fail("move-record-mismatch");
  return value as PieceType;
}

function parseOptionalPromotion(value: unknown): PromotionPiece | undefined {
  if (value === undefined) return undefined;
  if (!promotionTypes.some((piece) => piece === value)) fail("move-record-mismatch");
  return value as PromotionPiece;
}

function validateMoveClock(
  before: ClockState,
  after: ClockState,
  mover: Color,
  terminal: boolean,
): void {
  if (before.status === "untimed") {
    if (after.status !== "untimed" || after.lastTimestampMs !== before.lastTimestampMs) {
      fail("clock-history-mismatch");
    }
    return;
  }
  if (before.status !== "running" || before.activeColor !== mover) {
    fail("clock-history-mismatch");
  }

  const committed = commitClockMove(before, mover, before.lastTimestampMs);
  if (committed.status !== "applied") fail("clock-history-mismatch");
  let expected = committed.state;
  if (terminal) {
    const stopped = stopClock(expected, before.lastTimestampMs);
    if (stopped.status !== "applied") fail("clock-history-mismatch");
    expected = stopped.state;
  }
  if (!clockStatesEqual(expected, after)) fail("clock-history-mismatch");
}

function validateSequentialClock(previous: MoveRecord, current: MoveRecord): void {
  const previousClock = previous.clockAfter;
  const currentClock = current.clockBefore;
  if (previousClock.status === "untimed" || currentClock.status === "untimed") {
    if (
      previousClock.lastTimestampMs !== undefined &&
      currentClock.lastTimestampMs !== undefined &&
      currentClock.lastTimestampMs < previousClock.lastTimestampMs
    ) {
      fail("clock-history-mismatch");
    }
    return;
  }
  if (
    previousClock.status !== "running" ||
    currentClock.status !== "running" ||
    previousClock.activeColor !== current.mover ||
    currentClock.activeColor !== current.mover ||
    currentClock.lastTimestampMs < previousClock.lastTimestampMs
  ) {
    fail("clock-history-mismatch");
  }
  const inactiveColor = current.mover === "white" ? "black" : "white";
  if (
    currentClock.remaining[inactiveColor] !== previousClock.remaining[inactiveColor] ||
    currentClock.remaining[current.mover] > previousClock.remaining[current.mover]
  ) {
    fail("clock-history-mismatch");
  }
}

function parsePosition(value: unknown): PositionSnapshot {
  const position = requireRecord(value, "position-mismatch");
  if (typeof position.fen !== "string" || typeof position.ply !== "number") {
    fail("position-mismatch");
  }
  let fen: ReturnType<typeof parseFen>;
  let ply: ReturnType<typeof parsePly>;
  try {
    fen = parseFen(position.fen);
    ply = parsePly(position.ply);
  } catch {
    fail("position-mismatch");
  }
  const turn = parseRecordColor(position.turn, "position-mismatch");
  if (typeof position.inCheck !== "boolean") fail("position-mismatch");
  return Object.freeze({
    fen,
    inCheck: position.inCheck,
    ply,
    terminalState: parseTerminalState(position.terminalState),
    turn,
  });
}

function parseTerminalState(value: unknown): TerminalState {
  const terminal = requireRecord(value, "position-mismatch");
  if (terminal.status === "ongoing") return Object.freeze({ status: "ongoing" });
  if (terminal.status === "draw") {
    if (
      terminal.reason !== "fifty-move-rule" &&
      terminal.reason !== "insufficient-material" &&
      terminal.reason !== "stalemate" &&
      terminal.reason !== "threefold-repetition"
    ) {
      fail("position-mismatch");
    }
    return Object.freeze({ reason: terminal.reason, status: "draw" });
  }
  if (terminal.status === "checkmate") {
    const winner = parseRecordColor(terminal.winner, "position-mismatch");
    const loser = parseRecordColor(terminal.loser, "position-mismatch");
    if (winner === loser || terminal.reason !== "checkmate") fail("position-mismatch");
    return Object.freeze({ loser, reason: "checkmate", status: "checkmate", winner });
  }
  fail("position-mismatch");
}

function validateFinalPosition(
  position: PositionSnapshot,
  history: readonly MoveRecord[],
  rules: ChessRulesPort,
): void {
  if (
    position.ply !== history.length ||
    position.fen !== rules.getFen() ||
    position.turn !== rules.getTurn() ||
    position.inCheck !== rules.isCheck() ||
    !terminalStatesEqual(position.terminalState, rules.getTerminalState())
  ) {
    fail("position-mismatch");
  }
}

function parseLifecycle(value: unknown): GameLifecycleState {
  const lifecycle = requireRecord(value, "lifecycle-mismatch");
  switch (lifecycle.phase) {
    case "creating":
    case "ready":
    case "player-turn":
    case "opponent-turn":
    case "awaiting-opponent":
    case "committing":
    case "degraded":
    case "completed":
    case "abandoned":
      return Object.freeze({ phase: lifecycle.phase });
    case "paused":
      return Object.freeze({
        phase: "paused",
        resumePhase: parseResumePhase(lifecycle.resumePhase),
      });
    case "failed":
    case "recovery":
      return Object.freeze({
        failure: Object.freeze({ code: parseFailureCode(lifecycle.failure) }),
        phase: lifecycle.phase,
      });
    default:
      fail("lifecycle-mismatch");
  }
}

function parseResumePhase(value: unknown): ResumableGamePhase {
  if (
    value !== "player-turn" &&
    value !== "opponent-turn" &&
    value !== "awaiting-opponent" &&
    value !== "degraded"
  ) {
    fail("lifecycle-mismatch");
  }
  return value;
}

function parseFailureCode(value: unknown): GameLifecycleFailureCode {
  const failure = requireRecord(value, "lifecycle-mismatch");
  if (
    failure.code !== "creation-failed" &&
    failure.code !== "commit-failed" &&
    failure.code !== "opponent-provider-failed" &&
    failure.code !== "recovery-failed" &&
    failure.code !== "unexpected-failure"
  ) {
    fail("lifecycle-mismatch");
  }
  return failure.code;
}

function parseClockState(value: unknown, timeControl: TimeControl): ClockState {
  const clock = requireRecord(value, "clock-state-mismatch");
  if (!checkpointTimeControlMatches(clock.timeControl, timeControl)) {
    fail("clock-state-mismatch");
  }
  const lastTimestampMs = parseOptionalTimestamp(clock.lastTimestampMs);

  if (clock.status === "untimed") {
    if (timeControl.kind !== "untimed") fail("clock-state-mismatch");
    return Object.freeze({ lastTimestampMs, status: "untimed", timeControl });
  }
  if (timeControl.kind === "untimed") fail("clock-state-mismatch");

  const remainingRecord = requireRecord(clock.remaining, "clock-state-mismatch");
  const remaining = Object.freeze({
    black: parseRemaining(remainingRecord.black),
    white: parseRemaining(remainingRecord.white),
  });
  switch (clock.status) {
    case "idle":
      return Object.freeze({ lastTimestampMs, remaining, status: "idle", timeControl });
    case "running":
      if (lastTimestampMs === undefined) fail("clock-state-mismatch");
      return Object.freeze({
        activeColor: parseRecordColor(clock.activeColor, "clock-state-mismatch"),
        lastTimestampMs,
        remaining,
        status: "running",
        timeControl,
      });
    case "paused":
      if (lastTimestampMs === undefined) fail("clock-state-mismatch");
      return Object.freeze({
        lastTimestampMs,
        remaining,
        resumeColor: parseRecordColor(clock.resumeColor, "clock-state-mismatch"),
        status: "paused",
        timeControl,
      });
    case "stopped":
      if (lastTimestampMs === undefined) fail("clock-state-mismatch");
      return Object.freeze({ lastTimestampMs, remaining, status: "stopped", timeControl });
    case "expired":
      if (lastTimestampMs === undefined) fail("clock-state-mismatch");
      return Object.freeze({
        expiredColor: parseRecordColor(clock.expiredColor, "clock-state-mismatch"),
        lastTimestampMs,
        remaining,
        status: "expired",
        timeControl,
      });
    default:
      fail("clock-state-mismatch");
  }
}

function parseOptionalTimestamp(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "number") fail("clock-state-mismatch");
  try {
    return parseMonotonicTimestampMs(value);
  } catch {
    fail("clock-state-mismatch");
  }
}

function parseRemaining(value: unknown) {
  if (typeof value !== "number") fail("clock-state-mismatch");
  try {
    return parseClockDurationMs(value);
  } catch {
    fail("clock-state-mismatch");
  }
}

function checkpointTimeControlMatches(value: unknown, expected: TimeControl): boolean {
  if (!isRecord(value) || value.kind !== expected.kind) return false;
  switch (expected.kind) {
    case "untimed":
      return true;
    case "sudden-death":
      return value.initialMs === expected.initialMs;
    case "increment":
      return value.initialMs === expected.initialMs && value.incrementMs === expected.incrementMs;
  }
}

function parseResult(value: unknown): GameResult | undefined {
  if (value === undefined) return undefined;
  const result = requireRecord(value, "result-mismatch");
  if (result.status === "draw") {
    if (
      result.isDraw !== true ||
      result.pgnResult !== "1/2-1/2" ||
      (result.reason !== "fifty-move-rule" &&
        result.reason !== "insufficient-material" &&
        result.reason !== "stalemate" &&
        result.reason !== "threefold-repetition")
    ) {
      fail("result-mismatch");
    }
    return Object.freeze({
      isDraw: true,
      pgnResult: "1/2-1/2",
      reason: result.reason,
      status: "draw",
    });
  }
  if (result.status === "decisive") {
    const winner = parseRecordColor(result.winner, "result-mismatch");
    const loser = parseRecordColor(result.loser, "result-mismatch");
    if (
      result.isDraw !== false ||
      winner === loser ||
      (result.reason !== "checkmate" && result.reason !== "timeout") ||
      result.pgnResult !== resultToken(winner)
    ) {
      fail("result-mismatch");
    }
    return Object.freeze({
      isDraw: false,
      loser,
      pgnResult: resultToken(winner),
      reason: result.reason,
      status: "decisive",
      winner,
    });
  }
  if (result.status === "abandoned") {
    if (result.isDraw !== false || result.reason !== "abandoned") fail("result-mismatch");
    if (result.winner === undefined) {
      if (result.loser !== undefined || result.pgnResult !== undefined) fail("result-mismatch");
      return Object.freeze({ isDraw: false, reason: "abandoned", status: "abandoned" });
    }
    const winner = parseRecordColor(result.winner, "result-mismatch");
    const loser = parseRecordColor(result.loser, "result-mismatch");
    if (winner === loser || result.pgnResult !== resultToken(winner)) fail("result-mismatch");
    return Object.freeze({
      isDraw: false,
      loser,
      pgnResult: resultToken(winner),
      reason: "abandoned",
      status: "abandoned",
      winner,
    });
  }
  fail("result-mismatch");
}

function parseOpponentRequest(value: unknown): OpponentRequestState | undefined {
  if (value === undefined) return undefined;
  const request = requireRecord(value, "opponent-request-mismatch");
  if (
    typeof request.expectedFen !== "string" ||
    typeof request.expectedPly !== "number" ||
    typeof request.expectedRevision !== "number" ||
    typeof request.requestId !== "string"
  ) {
    fail("opponent-request-mismatch");
  }
  try {
    return Object.freeze({
      expectedFen: parseFen(request.expectedFen),
      expectedPly: parsePly(request.expectedPly),
      expectedRevision: parseSessionRevision(request.expectedRevision),
      requestId: parseRequestId(request.requestId),
      requestedColor: parseColor(String(request.requestedColor)),
    });
  } catch {
    fail("opponent-request-mismatch");
  }
}

function validateSessionSemantics(session: GameSession, rules: ChessRulesPort): void {
  if (session.history.length > session.revision) fail("invalid-revision");
  if (session.lifecycle.phase === "creating" || session.lifecycle.phase === "committing") {
    fail("lifecycle-mismatch");
  }

  validateResultSemantics(session, rules);
  validateRequestSemantics(session);
  validateLifecycleParticipant(session);
  validateFinalClock(session);
}

function validateResultSemantics(session: GameSession, rules: ChessRulesPort): void {
  const terminalState = rules.getTerminalState();
  if (session.lifecycle.phase === "completed") {
    if (!session.result) fail("result-mismatch");
    if (session.result.status === "decisive" && session.result.reason === "timeout") {
      if (
        terminalState.status !== "ongoing" ||
        session.clock.status !== "expired" ||
        session.clock.expiredColor !== session.result.loser ||
        session.clock.remaining[session.result.loser] !== 0
      ) {
        fail("result-mismatch");
      }
      return;
    }
    if (terminalState.status === "ongoing") fail("result-mismatch");
    const expected = createGameResultFromTerminalState(terminalState);
    if (!resultsEqual(expected, session.result)) fail("result-mismatch");
    return;
  }

  if (session.lifecycle.phase === "abandoned") {
    if (!session.result || session.result.status !== "abandoned") fail("result-mismatch");
    if (terminalState.status !== "ongoing") fail("result-mismatch");
    return;
  }
  if (session.result !== undefined || terminalState.status !== "ongoing") {
    fail("result-mismatch");
  }
}

function validateRequestSemantics(session: GameSession): void {
  const requestAllowed =
    session.lifecycle.phase === "awaiting-opponent" ||
    (session.lifecycle.phase === "paused" && session.lifecycle.resumePhase === "awaiting-opponent");
  if ((session.activeOpponentRequest !== undefined) !== requestAllowed) {
    fail("opponent-request-mismatch");
  }
  const request = session.activeOpponentRequest;
  if (!request) return;
  if (
    request.expectedFen !== session.position.fen ||
    request.expectedPly !== session.position.ply ||
    request.expectedRevision >= session.revision ||
    request.requestedColor !== session.position.turn ||
    session.configuration.participants[request.requestedColor].kind !== "external-opponent"
  ) {
    fail("opponent-request-mismatch");
  }
}

function validateLifecycleParticipant(session: GameSession): void {
  const participant = session.configuration.participants[session.position.turn];
  switch (session.lifecycle.phase) {
    case "player-turn":
      if (participant.kind !== "human") fail("lifecycle-mismatch");
      break;
    case "opponent-turn":
    case "awaiting-opponent":
    case "degraded":
      if (participant.kind !== "external-opponent") fail("lifecycle-mismatch");
      break;
    case "paused": {
      const humanPhase = session.lifecycle.resumePhase === "player-turn";
      const externalPhase =
        session.lifecycle.resumePhase === "opponent-turn" ||
        session.lifecycle.resumePhase === "awaiting-opponent" ||
        session.lifecycle.resumePhase === "degraded";
      if (
        (humanPhase && participant.kind !== "human") ||
        (externalPhase && participant.kind !== "external-opponent")
      ) {
        fail("lifecycle-mismatch");
      }
      break;
    }
    case "ready":
      if (session.history.length !== 0 || session.position.ply !== 0) fail("lifecycle-mismatch");
      break;
    case "completed":
    case "abandoned":
    case "failed":
    case "recovery":
      break;
    case "creating":
    case "committing":
      fail("lifecycle-mismatch");
  }
}

function validateFinalClock(session: GameSession): void {
  const clock = session.clock;
  if (!timeControlsEqual(clock.timeControl, session.configuration.timeControl)) {
    fail("clock-state-mismatch");
  }
  switch (session.lifecycle.phase) {
    case "ready":
      if (
        (clock.status !== "idle" && clock.status !== "untimed") ||
        clock.lastTimestampMs !== undefined
      ) {
        fail("clock-state-mismatch");
      }
      return;
    case "player-turn":
    case "opponent-turn":
    case "awaiting-opponent":
    case "degraded":
      if (
        clock.status !== "untimed" &&
        (clock.status !== "running" || clock.activeColor !== session.position.turn)
      ) {
        fail("clock-state-mismatch");
      }
      return;
    case "paused":
      if (
        clock.status !== "untimed" &&
        (clock.status !== "paused" || clock.resumeColor !== session.position.turn)
      ) {
        fail("clock-state-mismatch");
      }
      return;
    case "completed":
      if (
        clock.status !== "untimed" &&
        clock.status !== "stopped" &&
        clock.status !== "expired" &&
        clock.status !== "idle"
      ) {
        fail("clock-state-mismatch");
      }
      return;
    case "abandoned":
      if (clock.status !== "untimed" && clock.status !== "stopped" && clock.status !== "idle") {
        fail("clock-state-mismatch");
      }
      return;
    case "failed":
    case "recovery":
      if (clock.status === "running" && clock.activeColor !== session.position.turn) {
        fail("clock-state-mismatch");
      }
      return;
    case "creating":
    case "committing":
      fail("lifecycle-mismatch");
  }
}

function terminalStatesEqual(left: TerminalState, right: TerminalState): boolean {
  if (left.status !== right.status) return false;
  if (left.status === "ongoing" && right.status === "ongoing") return true;
  if (left.status === "draw" && right.status === "draw") return left.reason === right.reason;
  return (
    left.status === "checkmate" &&
    right.status === "checkmate" &&
    left.winner === right.winner &&
    left.loser === right.loser
  );
}

function clockStatesEqual(left: ClockState, right: ClockState): boolean {
  if (
    left.status !== right.status ||
    left.lastTimestampMs !== right.lastTimestampMs ||
    !timeControlsEqual(left.timeControl, right.timeControl)
  ) {
    return false;
  }
  if (left.status === "untimed" || right.status === "untimed") {
    return left.status === "untimed" && right.status === "untimed";
  }
  if (
    left.remaining.white !== right.remaining.white ||
    left.remaining.black !== right.remaining.black
  ) {
    return false;
  }
  if (left.status === "running" && right.status === "running") {
    return left.activeColor === right.activeColor;
  }
  return left.status === right.status;
}

function timeControlsEqual(left: TimeControl, right: TimeControl): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "untimed" && right.kind === "untimed") return true;
  if (left.kind === "sudden-death" && right.kind === "sudden-death") {
    return left.initialMs === right.initialMs;
  }
  return (
    left.kind === "increment" &&
    right.kind === "increment" &&
    left.initialMs === right.initialMs &&
    left.incrementMs === right.incrementMs
  );
}

function resultsEqual(left: CompletedGameResult, right: GameResult): boolean {
  if (
    left.status !== right.status ||
    left.reason !== right.reason ||
    left.isDraw !== right.isDraw
  ) {
    return false;
  }
  if (left.status === "draw" && right.status === "draw") {
    return true;
  }
  if (left.status === "decisive" && right.status === "decisive") {
    return (
      left.winner === right.winner &&
      left.loser === right.loser &&
      left.pgnResult === right.pgnResult
    );
  }
  return false;
}

function resultToken(winner: Color): "0-1" | "1-0" {
  return winner === "white" ? "1-0" : "0-1";
}

function requireRecord(
  value: unknown,
  reason: GameRestorationRejectionReason,
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) fail(reason);
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(reason: GameRestorationRejectionReason): never {
  throw new RestorationValidationError(reason);
}
