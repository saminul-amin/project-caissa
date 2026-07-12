import { DomainValidationError } from "./errors";

declare const brand: unique symbol;

type Brand<Value, Name extends string> = Value & {
  readonly [brand]: Name;
};

export type Color = "black" | "white";
export type Square = Brand<string, "Square">;
export type Fen = Brand<string, "Fen">;
export type Pgn = Brand<string, "Pgn">;
export type SanMove = Brand<string, "SanMove">;
export type UciMove = Brand<string, "UciMove">;
export type Ply = Brand<number, "Ply">;
export type GameId = Brand<string, "GameId">;
export type RequestId = Brand<string, "RequestId">;
export type SessionRevision = Brand<number, "SessionRevision">;

const squarePattern = /^[a-h][1-8]$/u;
const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/u;
const sanPattern = /^(?:O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)$/u;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const maximumIdentifierLength = 128;
const maximumFenLength = 128;
const maximumPgnLength = 1_000_000;
const maximumSanLength = 32;

export function parseColor(value: string): Color {
  if (value !== "white" && value !== "black") {
    throw new DomainValidationError("invalid-color", `Invalid chess color: ${value}`);
  }

  return value;
}

export function parseSquare(value: string): Square {
  if (!squarePattern.test(value)) {
    throw new DomainValidationError("invalid-square", `Invalid chess square: ${value}`);
  }

  return value as Square;
}

/**
 * Performs structural FEN validation without duplicating chess legality rules.
 * The chess.js adapter performs the authoritative semantic validation when loading.
 */
export function parseFen(value: string): Fen {
  const normalized = value.trim();
  const fields = normalized.split(/\s+/u);

  if (
    normalized.length === 0 ||
    normalized.length > maximumFenLength ||
    fields.length !== 6 ||
    !/^[prnbqkPRNBQK1-8/]+$/u.test(fields[0] ?? "") ||
    !/^[wb]$/u.test(fields[1] ?? "") ||
    !/^(?:-|[KQkq]+)$/u.test(fields[2] ?? "") ||
    !/^(?:-|[a-h][36])$/u.test(fields[3] ?? "") ||
    !/^\d+$/u.test(fields[4] ?? "") ||
    !/^[1-9]\d*$/u.test(fields[5] ?? "")
  ) {
    throw new DomainValidationError("invalid-fen", "The supplied FEN is malformed.");
  }

  return normalized as Fen;
}

export function parsePgn(value: string): Pgn {
  if (value.length > maximumPgnLength || value.includes("\0")) {
    throw new DomainValidationError("invalid-pgn", "The supplied PGN is malformed or too large.");
  }

  return value as Pgn;
}

export function parseSanMove(value: string): SanMove {
  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > maximumSanLength ||
    !sanPattern.test(normalized)
  ) {
    throw new DomainValidationError("invalid-san", `Invalid SAN move: ${value}`);
  }

  return normalized as SanMove;
}

export function parseUciMove(value: string): UciMove {
  const normalized = value.trim().toLowerCase();

  if (!uciPattern.test(normalized)) {
    throw new DomainValidationError("invalid-uci", `Invalid UCI move: ${value}`);
  }

  return normalized as UciMove;
}

export function parsePly(value: number): Ply {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError("invalid-ply", `Invalid ply: ${String(value)}`);
  }

  return value as Ply;
}

export function parseGameId(value: string): GameId {
  return parseIdentifier(value, "invalid-game-id", "game") as GameId;
}

export function parseRequestId(value: string): RequestId {
  return parseIdentifier(value, "invalid-request-id", "request") as RequestId;
}

export function parseSessionRevision(value: number): SessionRevision {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainValidationError(
      "invalid-session-revision",
      `Invalid session revision: ${String(value)}`,
    );
  }

  return value as SessionRevision;
}

function parseIdentifier(
  value: string,
  code: "invalid-game-id" | "invalid-request-id",
  label: "game" | "request",
): string {
  const normalized = value.trim();

  if (
    normalized.length === 0 ||
    normalized.length > maximumIdentifierLength ||
    !identifierPattern.test(normalized)
  ) {
    throw new DomainValidationError(code, `Invalid ${label} identifier.`);
  }

  return normalized;
}
