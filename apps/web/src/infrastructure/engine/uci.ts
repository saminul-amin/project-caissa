/**
 * Pure UCI text helpers.
 *
 * The engine worker emits unbounded text. Every line that reaches application code
 * passes through this module first so that parsing stays framework-free, bounded,
 * and unit-testable without a worker.
 */

export interface UciScore {
  readonly kind: "centipawns" | "mate";
  /** Centipawns, or signed mate distance in moves, always from the side to move. */
  readonly value: number;
}

export interface UciInfoLine {
  readonly depth?: number;
  readonly multipv?: number;
  readonly nodes?: number;
  readonly nps?: number;
  readonly pv?: readonly string[];
  readonly score?: UciScore;
  readonly seldepth?: number;
  readonly timeMs?: number;
}

export interface UciBestMove {
  readonly bestMove: string | undefined;
  readonly ponder?: string;
}

const maximumParsedLineLength = 8_192;
const maximumPrincipalVariationLength = 128;
const uciMovePattern = /^[a-h][1-8][a-h][1-8][nbrq]?$/u;

/** Rejects engine text that is too long, non-ASCII, or control-bearing before parsing. */
export function isSafeEngineLine(line: string): boolean {
  if (typeof line !== "string" || line.length === 0 || line.length > maximumParsedLineLength) {
    return false;
  }
  for (let index = 0; index < line.length; index += 1) {
    const codeUnit = line.charCodeAt(index);
    if (codeUnit < 32 || codeUnit > 126) return false;
  }
  return true;
}

export function isUciMoveToken(value: string): boolean {
  return uciMovePattern.test(value);
}

/** Parses a `bestmove` line. `bestmove (none)` yields an undefined move. */
export function parseUciBestMove(line: string): UciBestMove | undefined {
  if (!isSafeEngineLine(line)) return undefined;
  const tokens = line.trim().split(/\s+/u);
  if (tokens[0] !== "bestmove") return undefined;

  const candidate = tokens[1];
  const bestMove = candidate !== undefined && isUciMoveToken(candidate) ? candidate : undefined;
  const ponderIndex = tokens.indexOf("ponder");
  const ponderCandidate = ponderIndex === -1 ? undefined : tokens[ponderIndex + 1];
  const ponder =
    ponderCandidate !== undefined && isUciMoveToken(ponderCandidate) ? ponderCandidate : undefined;

  return Object.freeze({ bestMove, ...(ponder === undefined ? {} : { ponder }) });
}

/** Parses an `info` line, ignoring fields Caissa does not consume. */
export function parseUciInfo(line: string): UciInfoLine | undefined {
  if (!isSafeEngineLine(line)) return undefined;
  const tokens = line.trim().split(/\s+/u);
  if (tokens[0] !== "info") return undefined;

  const parsed: {
    depth?: number;
    multipv?: number;
    nodes?: number;
    nps?: number;
    pv?: readonly string[];
    score?: UciScore;
    seldepth?: number;
    timeMs?: number;
  } = {};

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    switch (token) {
      case "depth":
      case "seldepth":
      case "multipv":
      case "nodes":
      case "nps":
      case "time": {
        const value = readInteger(tokens[index + 1]);
        if (value === undefined) break;
        index += 1;
        if (token === "depth") parsed.depth = value;
        else if (token === "seldepth") parsed.seldepth = value;
        else if (token === "multipv") parsed.multipv = value;
        else if (token === "nodes") parsed.nodes = value;
        else if (token === "nps") parsed.nps = value;
        else parsed.timeMs = value;
        break;
      }
      case "score": {
        const kindToken = tokens[index + 1];
        const value = readInteger(tokens[index + 2], true);
        if (value === undefined || (kindToken !== "cp" && kindToken !== "mate")) break;
        index += 2;
        parsed.score = Object.freeze({
          kind: kindToken === "cp" ? ("centipawns" as const) : ("mate" as const),
          value,
        });
        break;
      }
      case "pv": {
        const moves: string[] = [];
        for (
          let cursor = index + 1;
          cursor < tokens.length && moves.length < maximumPrincipalVariationLength;
          cursor += 1
        ) {
          const move = tokens[cursor];
          if (move === undefined || !isUciMoveToken(move)) break;
          moves.push(move);
        }
        if (moves.length > 0) parsed.pv = Object.freeze(moves);
        index = tokens.length;
        break;
      }
      default:
        break;
    }
  }

  return Object.freeze(parsed);
}

export interface PositionCommandInput {
  readonly fen: string;
  readonly moves?: readonly string[];
  readonly startsFromInitialPosition: boolean;
}

/**
 * Builds a `position` command. Move history is only forwarded when it is complete
 * from the initial position, so the engine never receives a desynchronized line.
 */
export function formatPositionCommand(input: PositionCommandInput): string {
  const safeMoves = (input.moves ?? []).filter((move) => isUciMoveToken(move));
  const useMoveList =
    input.startsFromInitialPosition && safeMoves.length === (input.moves ?? []).length;

  if (useMoveList) {
    return safeMoves.length === 0
      ? "position startpos"
      : `position startpos moves ${safeMoves.join(" ")}`;
  }
  return `position fen ${input.fen}`;
}

function readInteger(token: string | undefined, allowNegative = false): number | undefined {
  if (token === undefined) return undefined;
  const pattern = allowNegative ? /^-?\d{1,12}$/u : /^\d{1,12}$/u;
  if (!pattern.test(token)) return undefined;
  const value = Number.parseInt(token, 10);
  return Number.isSafeInteger(value) ? value : undefined;
}
