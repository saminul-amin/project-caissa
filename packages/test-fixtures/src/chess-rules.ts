export interface ChessRulesFixture {
  readonly description: string;
  readonly expected: string;
  readonly fen: string;
  readonly id: string;
  readonly purpose: string;
}

export const chessRulesFixtures = {
  initialPosition: {
    id: "initial-position",
    purpose: "Verify the standard starting position and White to move.",
    description: "The canonical standard-chess initial position.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    expected: "White has twenty legal moves and e2e4 is legal.",
  },
  castling: {
    id: "white-kingside-castling",
    purpose: "Verify legal White kingside castling.",
    description: "Both kings and rooks retain castling rights with an open path.",
    fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
    expected: "e1g1 commits as O-O and moves the rook to f1.",
  },
  castlingThroughCheck: {
    id: "castling-through-check",
    purpose: "Verify that a king cannot castle through an attacked transit square.",
    description: "A Black rook on f3 attacks f1 while White retains nominal castling rights.",
    fen: "r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1",
    expected: "e1g1 is rejected without changing the FEN.",
  },
  enPassant: {
    id: "legal-en-passant",
    purpose: "Verify a legal en passant capture.",
    description: "White may capture the Black pawn from e5 onto d6.",
    fen: "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2",
    expected: "e5d6 removes the pawn from d5 and commits as exd6.",
  },
  illegalEnPassantExposesKing: {
    id: "illegal-en-passant-exposes-king",
    purpose: "Verify that en passant cannot expose the moving side's king.",
    description: "Moving the e5 pawn would expose the White king to the rook on e8.",
    fen: "k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 2",
    expected: "e5d6 is rejected without changing the FEN.",
  },
  queenPromotion: {
    id: "queen-promotion",
    purpose: "Verify explicit promotion to a queen.",
    description: "The White a-pawn is one move from promotion.",
    fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    expected: "a7a8q commits with SAN a8=Q+.",
  },
  knightUnderpromotion: {
    id: "knight-underpromotion",
    purpose: "Verify explicit underpromotion to a knight.",
    description: "The same promotion position is resolved with a knight choice.",
    fen: "4k3/P7/8/8/8/8/8/4K3 w - - 0 1",
    expected: "a7a8n commits with SAN a8=N.",
  },
  check: {
    id: "check-detection",
    purpose: "Verify check detection without a terminal result.",
    description: "A White rook attacks the Black king along the e-file.",
    fen: "4k3/8/8/8/8/8/4R3/4K3 b - - 0 1",
    expected: "Black is in check and still has legal replies.",
  },
  checkmate: {
    id: "checkmate",
    purpose: "Verify checkmate detection and winner mapping.",
    description: "The Black king is checked by the queen and has no legal move.",
    fen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",
    expected: "The terminal state is checkmate with White as winner.",
  },
  stalemate: {
    id: "stalemate",
    purpose: "Verify stalemate detection.",
    description: "The Black king is not checked but has no legal move.",
    fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
    expected: "The terminal state is a draw by stalemate.",
  },
  insufficientMaterial: {
    id: "insufficient-material",
    purpose: "Verify insufficient-material detection.",
    description: "Only the two kings remain.",
    fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    expected: "The terminal state is a draw by insufficient material.",
  },
  threefoldRepetition: {
    id: "threefold-repetition",
    purpose: "Verify repetition tracking over maintained move history.",
    description: "Both knights return to their starting squares twice.",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    moves: ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"],
    expected: "The terminal state is a draw by threefold repetition after eight plies.",
  },
  fiftyMoveRule: {
    id: "fifty-move-rule",
    purpose: "Verify the fifty-move rule from the FEN halfmove clock.",
    description: "The halfmove clock is 100 and sufficient mating material remains.",
    fen: "4k3/8/8/8/8/8/8/4K2R w - - 100 51",
    expected: "The terminal state is a draw by the fifty-move rule.",
  },
} as const satisfies Record<
  string,
  ChessRulesFixture | (ChessRulesFixture & { moves: readonly string[] })
>;
