import {
  parseSquare,
  parseUciMove,
  type Color,
  type Fen,
  type Pgn,
  type SanMove,
  type Square,
  type UciMove,
} from "./primitives";
import { DomainValidationError } from "./errors";

export type PieceType = "bishop" | "king" | "knight" | "pawn" | "queen" | "rook";
export type PromotionPiece = "bishop" | "knight" | "queen" | "rook";

export interface ChessPosition {
  readonly fen: Fen;
  readonly inCheck: boolean;
  readonly legalMoveCount: number;
  readonly turn: Color;
}

export interface LegalMoveQuery {
  readonly from?: Square;
}

export interface MoveInput {
  readonly from: Square;
  readonly promotion?: PromotionPiece;
  readonly to: Square;
}

export function moveInputFromUci(value: UciMove | string): MoveInput {
  const uci = parseUciMove(value);
  const promotionSymbol = uci[4];
  const promotion = promotionSymbol ? promotionFromUciSymbol(promotionSymbol) : undefined;

  return {
    from: parseSquare(uci.slice(0, 2)),
    to: parseSquare(uci.slice(2, 4)),
    ...(promotion ? { promotion } : {}),
  };
}

export interface ChessMove {
  readonly captured?: PieceType;
  readonly color: Color;
  readonly from: Square;
  readonly piece: PieceType;
  readonly promotion?: PromotionPiece;
  readonly san: SanMove;
  readonly to: Square;
  readonly uci: UciMove;
}

export type LegalMove = ChessMove;
export type AppliedMove = ChessMove;

export type MoveRejectionReason = "illegal-move" | "promotion-required";

export type MoveApplicationResult =
  | {
      readonly fenAfter: Fen;
      readonly fenBefore: Fen;
      readonly move: AppliedMove;
      readonly status: "committed";
    }
  | {
      readonly reason: MoveRejectionReason;
      readonly status: "rejected";
    };

export type UndoResult =
  | {
      readonly restoredFen: Fen;
      readonly status: "undone";
      readonly undoneMove: AppliedMove;
    }
  | {
      readonly reason: "no-move";
      readonly status: "unavailable";
    };

export type DrawReason =
  "fifty-move-rule" | "insufficient-material" | "stalemate" | "threefold-repetition";

export type TerminalState =
  | {
      readonly status: "ongoing";
    }
  | {
      readonly loser: Color;
      readonly reason: "checkmate";
      readonly status: "checkmate";
      readonly winner: Color;
    }
  | {
      readonly reason: DrawReason;
      readonly status: "draw";
    };

/** Framework-independent boundary around the authoritative chess rules implementation. */
export interface ChessRulesPort {
  createInitialPosition(): ChessPosition;
  loadFen(fen: Fen | string): ChessPosition;
  loadPgn(pgn: Pgn | string): ChessPosition;
  getFen(): Fen;
  getTurn(): Color;
  getLegalMoves(options?: LegalMoveQuery): readonly LegalMove[];
  attemptMove(move: MoveInput): MoveApplicationResult;
  undo(): UndoResult;
  isCheck(): boolean;
  getTerminalState(): TerminalState;
  exportPgn(): Pgn;
}

function promotionFromUciSymbol(symbol: string): PromotionPiece {
  switch (symbol) {
    case "b":
      return "bishop";
    case "n":
      return "knight";
    case "q":
      return "queen";
    case "r":
      return "rook";
    default:
      throw new DomainValidationError(
        "invalid-uci",
        `Unexpected validated UCI promotion symbol: ${symbol}`,
      );
  }
}
