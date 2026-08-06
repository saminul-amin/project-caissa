import type { Color, Fen, Square } from "@caissa/chess-core";

export interface AccessiblePiecePosition {
  readonly color: Color;
  readonly name: string;
  readonly square: Square;
}

const pieceNames = {
  b: "bishop",
  k: "king",
  n: "knight",
  p: "pawn",
  q: "queen",
  r: "rook",
} as const;

export function createPiecePositionSummary(fen: Fen): readonly AccessiblePiecePosition[] {
  const board = String(fen).split(" ")[0] ?? "";
  const ranks = board.split("/");
  const pieces: AccessiblePiecePosition[] = [];
  for (const [rankIndex, rank] of ranks.entries()) {
    let fileIndex = 0;
    for (const symbol of rank) {
      if (/^[1-8]$/u.test(symbol)) {
        fileIndex += Number(symbol);
        continue;
      }
      const normalized = symbol.toLowerCase();
      const name = Object.prototype.hasOwnProperty.call(pieceNames, normalized)
        ? pieceNames[normalized as keyof typeof pieceNames]
        : undefined;
      if (!name || fileIndex > 7 || rankIndex > 7) continue;
      pieces.push(
        Object.freeze({
          color: symbol === symbol.toUpperCase() ? "white" : "black",
          name,
          square: `${String.fromCharCode(97 + fileIndex)}${String(8 - rankIndex)}` as Square,
        }),
      );
      fileIndex += 1;
    }
  }
  return Object.freeze(pieces);
}

export function findKingSquare(fen: Fen, color: Color): Square | undefined {
  return createPiecePositionSummary(fen).find(
    (piece) => piece.color === color && piece.name === "king",
  )?.square;
}
