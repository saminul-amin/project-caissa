import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Color, PromotionPiece } from "@caissa/chess-core";

interface PromotionDialogProps {
  readonly choices: readonly PromotionPiece[];
  readonly color: Color;
  readonly onCancel: () => void;
  readonly onChoose: (piece: PromotionPiece) => void;
}

const pieceSymbols: Readonly<Record<Color, Readonly<Record<PromotionPiece, string>>>> = {
  black: { bishop: "\u265d", knight: "\u265e", queen: "\u265b", rook: "\u265c" },
  white: { bishop: "\u2657", knight: "\u2658", queen: "\u2655", rook: "\u2656" },
};

export function PromotionDialog({ choices, color, onCancel, onChoose }: PromotionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const choiceRefs = useRef(new Map<PromotionPiece, HTMLButtonElement>());

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = choiceRefs.current.get(
      choices.includes("queen") ? "queen" : (choices[0] ?? "queen"),
    );
    initial?.focus();
    return () => previouslyFocused?.focus();
  }, [choices]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    if (focusable.length === 0) return;
    const current = focusable.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey
      ? current <= 0
        ? focusable.length - 1
        : current - 1
      : current === focusable.length - 1
        ? 0
        : current + 1;
    event.preventDefault();
    focusable[next]?.focus();
  };

  return (
    <div className="dialog-backdrop promotion-backdrop">
      <div
        aria-describedby="promotion-description"
        aria-labelledby="promotion-title"
        aria-modal="true"
        className="promotion-dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <p className="eyebrow">Pawn promotion</p>
        <h2 id="promotion-title">Choose a promotion piece</h2>
        <p className="dialog-copy" id="promotion-description">
          Select the {color} piece that will replace the pawn. No move is submitted until you
          choose.
        </p>
        <div className="promotion-choices">
          {choices.map((piece) => (
            <button
              aria-label={`Promote to ${piece}`}
              className="promotion-choice"
              key={piece}
              onClick={() => {
                onChoose(piece);
              }}
              ref={(element) => {
                if (element) choiceRefs.current.set(piece, element);
                else choiceRefs.current.delete(piece);
              }}
              type="button"
            >
              <span aria-hidden="true" className="promotion-piece">
                {pieceSymbols[color][piece]}
              </span>
              <span>{capitalize(piece)}</span>
            </button>
          ))}
        </div>
        <button
          className="button button-secondary promotion-cancel"
          onClick={onCancel}
          type="button"
        >
          Cancel promotion
        </button>
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
