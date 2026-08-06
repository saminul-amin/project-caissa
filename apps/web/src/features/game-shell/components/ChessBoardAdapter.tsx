import { useRef } from "react";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import type { Color, Fen, Square } from "@caissa/chess-core";
import { parseSquare } from "@caissa/chess-core";

import { findKingSquare } from "../position-summary";
import type { BoardInputMethod, BoardMoveIntent } from "../board-interaction";

export interface ChessBoardAdapterProps {
  readonly ariaLabel: string;
  readonly captureTargets?: readonly Square[];
  readonly fen: Fen;
  readonly interactive?: boolean;
  readonly isInCheck: boolean;
  readonly lastMove?: Readonly<{ readonly from: Square; readonly to: Square }>;
  readonly legalTargets?: readonly Square[];
  readonly onMoveIntent?: (intent: BoardMoveIntent) => void;
  readonly onSquareActivate?: (square: Square, inputMethod: BoardInputMethod) => void;
  readonly orientation: Color;
  readonly selectedSource?: Square;
  readonly turn: Color;
}

export function ChessBoardAdapter({
  ariaLabel,
  captureTargets = [],
  fen,
  interactive = false,
  isInCheck,
  lastMove,
  legalTargets = [],
  onMoveIntent,
  onSquareActivate,
  orientation,
  selectedSource,
  turn,
}: ChessBoardAdapterProps) {
  const pointerInputMethod = useRef<"click" | "touch">("click");
  const squareStyles: NonNullable<ChessboardOptions["squareStyles"]> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: "var(--color-board-last-move-light)" };
    squareStyles[lastMove.to] = { backgroundColor: "var(--color-board-last-move-dark)" };
  }
  const checkSquare = isInCheck ? findKingSquare(fen, turn) : undefined;
  if (checkSquare) {
    squareStyles[checkSquare] = { backgroundColor: "var(--color-board-check)" };
  }

  if (selectedSource) {
    squareStyles[selectedSource] = {
      backgroundColor: "var(--color-accent)",
      boxShadow: "inset 0 0 0 3px var(--color-focus)",
    };
  }
  for (const target of legalTargets) {
    const isCapture = captureTargets.includes(target);
    squareStyles[target] = isCapture
      ? {
          backgroundImage:
            "radial-gradient(circle, transparent 54%, var(--color-focus) 56%, var(--color-focus) 68%, transparent 70%)",
        }
      : {
          backgroundImage:
            "radial-gradient(circle, var(--color-border-strong) 0 18%, transparent 20%)",
        };
  }

  const options = {
    allowAutoScroll: false,
    allowDragOffBoard: false,
    allowDragging: interactive,
    allowDrawingArrows: false,
    animationDurationInMs: 0,
    boardOrientation: orientation,
    boardStyle: {
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-board)",
    },
    darkSquareStyle: { backgroundColor: "var(--color-board-dark-square)" },
    id: "caissa-game-board",
    lightSquareStyle: { backgroundColor: "var(--color-board-light-square)" },
    ...(interactive
      ? {
          onPieceDrag: ({ square }) => {
            const parsed = safeSquare(square);
            if (parsed) onSquareActivate?.(parsed, "drag");
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            const from = safeSquare(sourceSquare);
            const to = safeSquare(targetSquare);
            if (from && to) onMoveIntent?.(Object.freeze({ from, inputMethod: "drag", to }));
            // react-chessboard requires a synchronous decision. Refusing the visual drop keeps the
            // authoritative session FEN as the only rendered position while the command resolves.
            return false;
          },
          onSquareClick: ({ square }) => {
            const parsed = safeSquare(square);
            if (parsed) onSquareActivate?.(parsed, pointerInputMethod.current);
            pointerInputMethod.current = "click";
          },
        }
      : {}),
    position: String(fen),
    showAnimations: false,
    showNotation: true,
    squareStyles,
  } satisfies ChessboardOptions;

  return (
    <div
      aria-label={ariaLabel}
      className="chessboard-frame"
      onPointerDownCapture={(event) => {
        pointerInputMethod.current = event.pointerType === "touch" ? "touch" : "click";
      }}
      role="img"
    >
      <Chessboard options={options} />
    </div>
  );
}

function safeSquare(value: string | null): Square | undefined {
  if (value === null) return undefined;
  try {
    return parseSquare(value);
  } catch {
    return undefined;
  }
}
