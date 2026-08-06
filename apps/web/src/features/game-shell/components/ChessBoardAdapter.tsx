import { Chessboard, type ChessboardOptions } from "react-chessboard";
import type { Color, Fen, Square } from "@caissa/chess-core";

import { findKingSquare } from "../position-summary";

export interface ReadOnlyChessBoardProps {
  readonly ariaLabel: string;
  readonly fen: Fen;
  readonly isInCheck: boolean;
  readonly lastMove?: Readonly<{ readonly from: Square; readonly to: Square }>;
  readonly orientation: Color;
  readonly turn: Color;
}

export function ChessBoardAdapter({
  ariaLabel,
  fen,
  isInCheck,
  lastMove,
  orientation,
  turn,
}: ReadOnlyChessBoardProps) {
  const squareStyles: NonNullable<ChessboardOptions["squareStyles"]> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: "var(--color-board-last-move-light)" };
    squareStyles[lastMove.to] = { backgroundColor: "var(--color-board-last-move-dark)" };
  }
  const checkSquare = isInCheck ? findKingSquare(fen, turn) : undefined;
  if (checkSquare) {
    squareStyles[checkSquare] = { backgroundColor: "var(--color-board-check)" };
  }

  return (
    <div aria-label={ariaLabel} className="chessboard-frame" role="img">
      <Chessboard
        options={{
          allowAutoScroll: false,
          allowDragOffBoard: false,
          allowDragging: false,
          allowDrawingArrows: false,
          animationDurationInMs: 0,
          boardOrientation: orientation,
          boardStyle: {
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-board)",
          },
          darkSquareStyle: { backgroundColor: "var(--color-board-dark-square)" },
          id: "caissa-read-only-board",
          lightSquareStyle: { backgroundColor: "var(--color-board-light-square)" },
          position: String(fen),
          showAnimations: false,
          showNotation: true,
          squareStyles,
        }}
      />
    </div>
  );
}
