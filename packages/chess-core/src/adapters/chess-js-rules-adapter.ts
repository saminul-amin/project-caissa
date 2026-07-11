import { Chess, type Move, validateFen } from "chess.js";

import type {
  AppliedMove,
  ChessMove,
  ChessPosition,
  ChessRulesPort,
  LegalMove,
  LegalMoveQuery,
  MoveApplicationResult,
  MoveInput,
  PieceType,
  PromotionPiece,
  TerminalState,
  UndoResult,
} from "../domain/chess-rules";
import { ChessRulesAdapterError, DomainValidationError } from "../domain/errors";
import {
  parseFen,
  parsePgn,
  parseSanMove,
  parseSquare,
  parseUciMove,
  type Color,
  type Fen,
  type Pgn,
  type Square,
} from "../domain/primitives";

/** The only chess-core module permitted to know about chess.js. */
export class ChessJsRulesAdapter implements ChessRulesPort {
  private chess: Chess;

  constructor() {
    this.chess = new Chess();
  }

  createInitialPosition(): ChessPosition {
    this.chess = new Chess();
    return this.getPosition();
  }

  loadFen(fen: Fen | string): ChessPosition {
    const parsedFen = parseFen(fen);
    const validation = validateFen(parsedFen);

    if (!validation.ok) {
      throw new DomainValidationError(
        "invalid-fen",
        validation.error ?? "The supplied FEN is not a legal chess position.",
      );
    }

    try {
      const candidate = new Chess(parsedFen);
      this.chess = candidate;
      return this.getPosition();
    } catch (error: unknown) {
      throw new DomainValidationError("invalid-fen", "The supplied FEN could not be loaded.", {
        cause: error,
      });
    }
  }

  loadPgn(pgn: Pgn | string): ChessPosition {
    const parsedPgn = parsePgn(pgn);

    try {
      const candidate = new Chess();
      candidate.loadPgn(parsedPgn, { strict: true });
      this.chess = candidate;
      return this.getPosition();
    } catch (error: unknown) {
      throw new DomainValidationError("invalid-pgn", "The supplied PGN could not be loaded.", {
        cause: error,
      });
    }
  }

  getFen(): Fen {
    return parseFen(this.chess.fen());
  }

  getTurn(): Color {
    return mapColor(this.chess.turn());
  }

  getLegalMoves(options: LegalMoveQuery = {}): readonly LegalMove[] {
    const moves = options.from
      ? this.chess.moves({ verbose: true, square: toChessJsSquare(options.from) })
      : this.chess.moves({ verbose: true });

    return moves.map(mapMove);
  }

  attemptMove(input: MoveInput): MoveApplicationResult {
    const fenBefore = this.getFen();
    const matchingMoves = this.getLegalMoves({ from: input.from }).filter(
      (move) => move.to === input.to,
    );

    if (matchingMoves.length === 0) {
      return { status: "rejected", reason: "illegal-move" };
    }

    if (matchingMoves.some((move) => move.promotion !== undefined) && !input.promotion) {
      return { status: "rejected", reason: "promotion-required" };
    }

    const selectedMove = matchingMoves.find((move) => move.promotion === input.promotion);

    if (!selectedMove) {
      return { status: "rejected", reason: "illegal-move" };
    }

    try {
      const move = this.chess.move({
        from: input.from,
        to: input.to,
        ...(input.promotion ? { promotion: mapPromotionToChessJs(input.promotion) } : {}),
      });

      return {
        status: "committed",
        move: mapMove(move),
        fenBefore,
        fenAfter: this.getFen(),
      };
    } catch (error: unknown) {
      throw new ChessRulesAdapterError("A validated legal move could not be applied.", {
        cause: error,
      });
    }
  }

  undo(): UndoResult {
    const move = this.chess.undo();

    if (!move) {
      return { status: "unavailable", reason: "no-move" };
    }

    return {
      status: "undone",
      undoneMove: mapMove(move),
      restoredFen: this.getFen(),
    };
  }

  isCheck(): boolean {
    return this.chess.isCheck();
  }

  getTerminalState(): TerminalState {
    if (this.chess.isCheckmate()) {
      const loser = this.getTurn();
      return {
        status: "checkmate",
        reason: "checkmate",
        loser,
        winner: oppositeColor(loser),
      };
    }

    if (this.chess.isStalemate()) {
      return { status: "draw", reason: "stalemate" };
    }

    if (this.chess.isInsufficientMaterial()) {
      return { status: "draw", reason: "insufficient-material" };
    }

    if (this.chess.isThreefoldRepetition()) {
      return { status: "draw", reason: "threefold-repetition" };
    }

    if (this.chess.isDrawByFiftyMoves()) {
      return { status: "draw", reason: "fifty-move-rule" };
    }

    return { status: "ongoing" };
  }

  exportPgn(): Pgn {
    return parsePgn(this.chess.pgn());
  }

  private getPosition(): ChessPosition {
    return {
      fen: this.getFen(),
      turn: this.getTurn(),
      inCheck: this.isCheck(),
      legalMoveCount: this.chess.moves().length,
    };
  }
}

function mapMove(move: Move): ChessMove {
  const promotion = move.promotion ? mapPromotionPiece(move.promotion) : undefined;
  const captured = move.captured ? mapPiece(move.captured) : undefined;

  return {
    color: mapColor(move.color),
    from: parseSquare(move.from),
    to: parseSquare(move.to),
    piece: mapPiece(move.piece),
    san: parseSanMove(move.san),
    uci: parseUciMove(`${move.from}${move.to}${move.promotion ?? ""}`),
    ...(captured ? { captured } : {}),
    ...(promotion ? { promotion } : {}),
  } satisfies AppliedMove;
}

function mapColor(color: "b" | "w"): Color {
  return color === "w" ? "white" : "black";
}

function toChessJsSquare(square: Square): Parameters<Chess["get"]>[0] {
  return square as Parameters<Chess["get"]>[0];
}

function oppositeColor(color: Color): Color {
  return color === "white" ? "black" : "white";
}

function mapPiece(piece: string): PieceType {
  switch (piece) {
    case "p":
      return "pawn";
    case "n":
      return "knight";
    case "b":
      return "bishop";
    case "r":
      return "rook";
    case "q":
      return "queen";
    case "k":
      return "king";
    default:
      throw new ChessRulesAdapterError(`Unexpected chess.js piece symbol: ${piece}`);
  }
}

function mapPromotionPiece(piece: string): PromotionPiece {
  const mappedPiece = mapPiece(piece);

  if (mappedPiece === "king" || mappedPiece === "pawn") {
    throw new ChessRulesAdapterError(`Unexpected promotion piece: ${piece}`);
  }

  return mappedPiece;
}

function mapPromotionToChessJs(piece: PromotionPiece): "b" | "n" | "q" | "r" {
  switch (piece) {
    case "bishop":
      return "b";
    case "knight":
      return "n";
    case "queen":
      return "q";
    case "rook":
      return "r";
  }
}
