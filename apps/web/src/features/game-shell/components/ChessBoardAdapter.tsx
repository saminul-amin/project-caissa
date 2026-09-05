import { useEffect, useReducer, useRef, type CSSProperties } from "react";
import { Chessboard, type ChessboardOptions } from "react-chessboard";
import type { Color, Fen, Square } from "@caissa/chess-core";
import { parseSquare } from "@caissa/chess-core";

import { findKingSquare } from "../position-summary";
import type { BoardInputMethod, BoardMoveIntent } from "../board-interaction";

export interface ChessBoardAdapterProps {
  /**
   * Piece travel time in milliseconds. Zero renders every position change instantly, which
   * is what a reduced-motion preference asks for.
   */
  readonly animationDurationMs?: number;
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

/** Inline square styles may carry custom properties that the stylesheet animates. */
type SquareStyle = CSSProperties & {
  readonly "--board-capture"?: string;
  readonly "--board-hint"?: string;
};

type DragIntent = Readonly<{ readonly from: Square; readonly to: Square }>;

const FLIP_KEYFRAMES: Keyframe[] = [
  { opacity: 0.55, transform: "scale(0.96)" },
  { opacity: 1, transform: "scale(1)" },
];

export function ChessBoardAdapter({
  animationDurationMs = 0,
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
  const frameRef = useRef<HTMLDivElement>(null);
  const mountedOrientation = useRef(orientation);
  /**
   * A piece the player dragged is already sitting on its destination when the authoritative
   * position arrives, so animating that move would snap the piece back and slide it forward.
   * The intent is remembered until the next position change, and a matching change renders
   * instantly. This is transient input memory, not position state: the FEN stays a prop.
   */
  const [dragIntent, recordDragIntent] = useReducer(
    (_current: DragIntent | undefined, next: DragIntent | undefined) => next,
    undefined,
  );
  const reduceMotion = animationDurationMs <= 0;
  const settlesDraggedPiece =
    dragIntent !== undefined &&
    lastMove !== undefined &&
    dragIntent.from === lastMove.from &&
    dragIntent.to === lastMove.to;

  useEffect(() => {
    recordDragIntent(undefined);
  }, [fen]);

  useEffect(() => {
    if (mountedOrientation.current === orientation) return;
    mountedOrientation.current = orientation;
    const frame = frameRef.current;
    if (reduceMotion || !frame || typeof frame.animate !== "function") return;
    frame.animate(FLIP_KEYFRAMES, {
      duration: 320,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
  }, [orientation, reduceMotion]);

  const squareStyles: Record<string, SquareStyle> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: "var(--color-board-last-move-light)" };
    squareStyles[lastMove.to] = { backgroundColor: "var(--color-board-last-move-dark)" };
  }
  const checkSquare = isInCheck ? findKingSquare(fen, turn) : undefined;
  if (checkSquare) {
    squareStyles[checkSquare] = {
      backgroundColor: "var(--color-board-check)",
      ...(reduceMotion
        ? {}
        : { animation: "caissa-check-pulse var(--motion-emphasis) var(--ease-standard) 1" }),
    };
  }

  if (selectedSource) {
    squareStyles[selectedSource] = {
      backgroundColor: "var(--color-board-selected)",
      boxShadow: "inset 0 0 0 3px var(--color-focus)",
    };
  }
  for (const target of legalTargets) {
    squareStyles[target] = captureTargets.includes(target)
      ? { "--board-capture": "1" }
      : { "--board-hint": "1" };
  }

  const options = {
    allowAutoScroll: false,
    allowDragOffBoard: false,
    allowDragging: interactive,
    allowDrawingArrows: false,
    alphaNotationStyle: { fontFamily: "var(--font-ui)", fontSize: "0.65em", fontWeight: 650 },
    animationDurationInMs: animationDurationMs,
    boardOrientation: orientation,
    boardStyle: { borderRadius: "var(--radius-sm)" },
    darkSquareNotationStyle: { color: "var(--color-board-light-square)" },
    darkSquareStyle: { backgroundColor: "var(--color-board-dark-square)" },
    draggingPieceStyle: { filter: "var(--shadow-piece)", transform: "scale(1.06)" },
    dropSquareStyle: { boxShadow: "inset 0 0 0 3px var(--color-focus)" },
    id: "caissa-game-board",
    lightSquareNotationStyle: { color: "var(--color-board-dark-square)" },
    lightSquareStyle: { backgroundColor: "var(--color-board-light-square)" },
    numericNotationStyle: { fontFamily: "var(--font-ui)", fontSize: "0.65em", fontWeight: 650 },
    ...(interactive
      ? {
          onPieceDrag: ({ square }) => {
            const parsed = safeSquare(square);
            if (parsed) onSquareActivate?.(parsed, "drag");
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            const from = safeSquare(sourceSquare);
            const to = safeSquare(targetSquare);
            if (from && to) {
              recordDragIntent(Object.freeze({ from, to }));
              onMoveIntent?.(Object.freeze({ from, inputMethod: "drag", to }));
            }
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
    showAnimations: !reduceMotion && !settlesDraggedPiece,
    showNotation: true,
    squareStyles,
  } satisfies ChessboardOptions;

  return (
    <div
      aria-label={ariaLabel}
      className="chessboard-frame"
      data-orientation={orientation}
      onPointerDownCapture={(event) => {
        pointerInputMethod.current = event.pointerType === "touch" ? "touch" : "click";
      }}
      ref={frameRef}
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
