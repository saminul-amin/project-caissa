import type { MoveInput, PieceType, PromotionPiece, TerminalState } from "./chess-rules";
import { createClock, type ClockState, type TimeControl } from "./clock";
import {
  parseClockDurationMs,
  parseClockIncrementMs,
  type MonotonicTimestampMs,
} from "./clock-primitives";
import { GameControllerError } from "./errors";
import type { GameLifecycleState } from "./game-lifecycle";
import type { GameResult } from "./game-result";
import {
  parseFen,
  parseGameId,
  parseSessionRevision,
  type Color,
  type Fen,
  type GameId,
  type Ply,
  type RequestId,
  type SanMove,
  type SessionRevision,
  type UciMove,
  type UndoPlyCount,
} from "./primitives";

export type ParticipantKind = "external-opponent" | "human";

export interface GameParticipant {
  readonly kind: ParticipantKind;
  readonly label?: string;
}

export interface GameParticipants {
  readonly black: GameParticipant;
  readonly white: GameParticipant;
}

export type InitialPosition =
  { readonly kind: "standard" } | { readonly fen: Fen; readonly kind: "fen" };

export interface GameConfiguration {
  readonly allowUndo: boolean;
  readonly gameId: GameId;
  readonly initialPosition: InitialPosition;
  readonly participants: GameParticipants;
  readonly timeControl: TimeControl;
}

export interface PositionSnapshot {
  readonly fen: Fen;
  readonly inCheck: boolean;
  /** Session-relative ply. Custom FEN sessions also begin at ply zero. */
  readonly ply: Ply;
  readonly terminalState: TerminalState;
  readonly turn: Color;
}

export interface MoveRecord {
  readonly actor: ParticipantKind;
  readonly captured?: PieceType;
  readonly clockAfter: ClockState;
  readonly clockBefore: ClockState;
  readonly fenAfter: Fen;
  readonly fenBefore: Fen;
  readonly givesCheck: boolean;
  readonly givesCheckmate: boolean;
  readonly mover: Color;
  readonly ply: Ply;
  readonly promotion?: PromotionPiece;
  readonly san: SanMove;
  readonly uci: UciMove;
}

export interface OpponentRequestState {
  readonly expectedFen: Fen;
  readonly expectedPly: Ply;
  readonly expectedRevision: SessionRevision;
  readonly requestId: RequestId;
  readonly requestedColor: Color;
}

export interface OpponentMoveProposal {
  readonly expectedFen: Fen;
  readonly expectedPly: Ply;
  readonly expectedRevision: SessionRevision;
  readonly move: MoveInput;
  readonly requestId: RequestId;
  readonly requestedColor: Color;
}

export interface GameSession {
  readonly activeOpponentRequest: OpponentRequestState | undefined;
  readonly clock: ClockState;
  readonly configuration: GameConfiguration;
  readonly gameId: GameId;
  readonly history: readonly MoveRecord[];
  readonly lifecycle: GameLifecycleState;
  readonly position: PositionSnapshot;
  readonly result: GameResult | undefined;
  readonly revision: SessionRevision;
}

export interface HumanMoveCommand {
  readonly expectedRevision?: SessionRevision;
  readonly move: MoveInput;
  readonly now: MonotonicTimestampMs;
}

export interface RequestOpponentMoveCommand {
  readonly expectedRevision?: SessionRevision;
  readonly requestId: RequestId;
}

export type OpponentRequestFailureReason =
  | "illegal-move"
  | "internal-provider-error"
  | "invalid-response"
  | "request-cancelled"
  | "timeout"
  | "unavailable";

export interface OpponentRequestFailureCommand {
  readonly expectedRevision?: SessionRevision;
  readonly reason: OpponentRequestFailureReason;
  readonly requestId: RequestId;
}

export interface AbandonGameCommand {
  readonly awardedWinner?: Color;
  readonly now: MonotonicTimestampMs;
}

export interface UndoMoveCommand {
  readonly expectedRevision?: SessionRevision;
  readonly now: MonotonicTimestampMs;
  readonly plies: UndoPlyCount;
}

export interface RestartGameCommand {
  readonly expectedRevision?: SessionRevision;
}

const maximumParticipantLabelLength = 80;

/** Runtime-validates and freezes configuration supplied at the game-domain boundary. */
export function createGameConfiguration(value: unknown): GameConfiguration {
  if (!isRecord(value)) {
    throw invalidConfiguration("Game configuration must be an object.");
  }

  const participants = parseParticipants(value.participants);
  const timeControl = parseTimeControl(value.timeControl);
  const initialPosition = parseInitialPosition(value.initialPosition);

  if (typeof value.gameId !== "string" || typeof value.allowUndo !== "boolean") {
    throw invalidConfiguration("Game ID and undo policy are required.");
  }

  try {
    return Object.freeze({
      allowUndo: value.allowUndo,
      gameId: parseGameId(value.gameId),
      initialPosition,
      participants,
      timeControl,
    });
  } catch (error: unknown) {
    throw invalidConfiguration("Game configuration contains an invalid domain value.", error);
  }
}

export function createInitialClock(configuration: GameConfiguration): ClockState {
  return createClock(configuration.timeControl);
}

export function initialSessionRevision(): SessionRevision {
  return parseSessionRevision(0);
}

function parseParticipants(value: unknown): GameParticipants {
  if (!isRecord(value)) {
    throw invalidConfiguration("Both White and Black participants are required.");
  }

  return Object.freeze({
    black: parseParticipant(value.black, "Black"),
    white: parseParticipant(value.white, "White"),
  });
}

function parseParticipant(value: unknown, colorLabel: string): GameParticipant {
  if (!isRecord(value) || (value.kind !== "human" && value.kind !== "external-opponent")) {
    throw invalidConfiguration(`${colorLabel} participant kind is invalid.`);
  }

  if (value.label === undefined) {
    return Object.freeze({ kind: value.kind });
  }

  if (typeof value.label !== "string") {
    throw invalidConfiguration(`${colorLabel} participant label must be text.`);
  }

  const label = value.label.trim();
  if (
    label.length === 0 ||
    label.length > maximumParticipantLabelLength ||
    hasUnsafeParticipantLabelCharacters(label)
  ) {
    throw invalidConfiguration(`${colorLabel} participant label is invalid.`);
  }

  return Object.freeze({ kind: value.kind, label });
}

function parseTimeControl(value: unknown): TimeControl {
  if (!isRecord(value) || typeof value.kind !== "string") {
    throw invalidConfiguration("Time control is invalid.");
  }

  try {
    switch (value.kind) {
      case "untimed":
        return Object.freeze({ kind: "untimed" });
      case "sudden-death":
        if (typeof value.initialMs !== "number") {
          throw invalidConfiguration("Sudden-death initial time is required.");
        }
        return Object.freeze({
          initialMs: parseClockDurationMs(value.initialMs),
          kind: "sudden-death",
        });
      case "increment":
        if (typeof value.initialMs !== "number" || typeof value.incrementMs !== "number") {
          throw invalidConfiguration("Increment time control values are required.");
        }
        return Object.freeze({
          incrementMs: parseClockIncrementMs(value.incrementMs),
          initialMs: parseClockDurationMs(value.initialMs),
          kind: "increment",
        });
      default:
        throw invalidConfiguration("Time-control kind is unsupported.");
    }
  } catch (error: unknown) {
    if (error instanceof GameControllerError) {
      throw error;
    }
    throw invalidConfiguration("Time control contains an invalid duration.", error);
  }
}

function parseInitialPosition(value: unknown): InitialPosition {
  if (!isRecord(value) || typeof value.kind !== "string") {
    throw invalidConfiguration("Initial position is invalid.");
  }

  if (value.kind === "standard") {
    return Object.freeze({ kind: "standard" });
  }

  if (value.kind !== "fen" || typeof value.fen !== "string") {
    throw invalidConfiguration("Custom initial position requires a FEN.");
  }

  try {
    return Object.freeze({ fen: parseFen(value.fen), kind: "fen" });
  } catch (error: unknown) {
    throw invalidConfiguration("Custom initial position FEN is invalid.", error);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function hasUnsafeParticipantLabelCharacters(label: string): boolean {
  for (let index = 0; index < label.length; index += 1) {
    const codeUnit = label.charCodeAt(index);
    if (codeUnit < 32 || codeUnit === 127) {
      return true;
    }
  }

  return false;
}

function invalidConfiguration(message: string, cause?: unknown): GameControllerError {
  return new GameControllerError("invalid-game-configuration", message, { cause });
}
