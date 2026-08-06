import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { parseSquare, type Color, type Fen, type Square } from "@caissa/chess-core";

import { createPiecePositionSummary } from "../position-summary";

interface KeyboardChessBoardProps {
  readonly disabled: boolean;
  readonly fen: Fen;
  readonly legalTargets: readonly Square[];
  readonly onActivate: (square: Square) => void;
  readonly onClearSelection: () => void;
  readonly orientation: Color;
  readonly selectedSource: Square | undefined;
}

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function KeyboardChessBoard({
  disabled,
  fen,
  legalTargets,
  onActivate,
  onClearSelection,
  orientation,
  selectedSource,
}: KeyboardChessBoardProps) {
  const orderedSquares = useMemo(() => visualSquareOrder(orientation), [orientation]);
  const pieces = useMemo(
    () => new Map(createPiecePositionSummary(fen).map((piece) => [piece.square, piece])),
    [fen],
  );
  const [focusedSquare, setFocusedSquare] = useState<Square>(
    orderedSquares[0] ?? parseSquare("a1"),
  );
  const squareRefs = useRef(new Map<Square, HTMLButtonElement>());

  const moveFocus = (next: Square) => {
    setFocusedSquare(next);
    squareRefs.current.get(next)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, square: Square) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClearSelection();
      return;
    }
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(square);
      return;
    }

    const delta = keyboardDelta(event.key, orientation);
    if (!delta) return;
    event.preventDefault();
    moveFocus(offsetSquare(square, delta.file, delta.rank));
  };

  return (
    <div
      aria-label={`Keyboard chessboard, ${orientation} orientation`}
      className="keyboard-board"
      role="grid"
    >
      {orderedSquares.map((square) => {
        const piece = pieces.get(square);
        const isLegal = legalTargets.includes(square);
        const isSelected = selectedSource === square;
        return (
          <button
            aria-label={
              piece
                ? `${capitalize(piece.color)} ${piece.name} on ${String(square)}`
                : `Empty square ${String(square)}`
            }
            aria-disabled={disabled}
            aria-selected={isSelected}
            className={[
              "keyboard-square",
              isSelected ? "is-selected" : "",
              isLegal ? "is-legal" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-square={square}
            key={square}
            onFocus={() => {
              setFocusedSquare(square);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, square);
            }}
            ref={(element) => {
              if (element) squareRefs.current.set(square, element);
              else squareRefs.current.delete(square);
            }}
            role="gridcell"
            tabIndex={focusedSquare === square ? 0 : -1}
            type="button"
          />
        );
      })}
    </div>
  );
}

function visualSquareOrder(orientation: Color): readonly Square[] {
  const visualFiles = orientation === "white" ? files : [...files].reverse();
  const visualRanks = orientation === "white" ? [...ranks].reverse() : ranks;
  return Object.freeze(
    visualRanks.flatMap((rank) => visualFiles.map((file) => parseSquare(`${file}${String(rank)}`))),
  );
}

function keyboardDelta(
  key: string,
  orientation: Color,
): { readonly file: number; readonly rank: number } | undefined {
  const direction = orientation === "white" ? 1 : -1;
  switch (key) {
    case "ArrowRight":
      return { file: direction, rank: 0 };
    case "ArrowLeft":
      return { file: -direction, rank: 0 };
    case "ArrowUp":
      return { file: 0, rank: direction };
    case "ArrowDown":
      return { file: 0, rank: -direction };
    case "Home":
      return { file: orientation === "white" ? -8 : 8, rank: 0 };
    case "End":
      return { file: orientation === "white" ? 8 : -8, rank: 0 };
    default:
      return undefined;
  }
}

function offsetSquare(square: Square, fileDelta: number, rankDelta: number): Square {
  const fileIndex = files.indexOf(square[0] as (typeof files)[number]);
  const rank = Number(square[1]);
  const file = Math.max(0, Math.min(7, fileIndex + fileDelta));
  const nextRank = Math.max(1, Math.min(8, rank + rankDelta));
  return parseSquare(`${files[file] ?? "a"}${String(nextRank)}`);
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
