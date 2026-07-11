/** Public package version for diagnostics during the foundation phase. */
export const CHESS_CORE_VERSION = "0.1.0" as const;

export { ChessJsRulesAdapter } from "./adapters/chess-js-rules-adapter";
export {
  moveInputFromUci,
  type AppliedMove,
  type ChessMove,
  type ChessPosition,
  type ChessRulesPort,
  type DrawReason,
  type LegalMove,
  type LegalMoveQuery,
  type MoveApplicationResult,
  type MoveInput,
  type MoveRejectionReason,
  type PieceType,
  type PromotionPiece,
  type TerminalState,
  type UndoResult,
} from "./domain/chess-rules";
export {
  ChessRulesAdapterError,
  DomainValidationError,
  type DomainValidationErrorCode,
} from "./domain/errors";
export {
  parseFen,
  parseColor,
  parseGameId,
  parsePgn,
  parsePly,
  parseRequestId,
  parseSanMove,
  parseSquare,
  parseUciMove,
  type Color,
  type Fen,
  type GameId,
  type Pgn,
  type Ply,
  type RequestId,
  type SanMove,
  type Square,
  type UciMove,
} from "./domain/primitives";
