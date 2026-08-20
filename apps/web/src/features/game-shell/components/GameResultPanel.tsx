import { useEffect, useRef } from "react";

interface GameResultPanelProps {
  readonly detail: string;
  readonly headline: string;
  readonly isSaved: boolean;
  readonly onExportPgn: () => void;
  readonly onNewGame: () => void;
  readonly onReview: () => void;
  readonly outcome: "draw" | "loss" | "unfinished" | "win";
}

const OUTCOME_EYEBROW: Readonly<Record<GameResultPanelProps["outcome"], string>> = Object.freeze({
  draw: "Drawn",
  loss: "Defeat",
  unfinished: "Game ended",
  win: "Victory",
});

/**
 * Shown once a game is over. It takes focus so the outcome is announced, and it offers the
 * three things a player actually wants next: another game, the review, or the moves.
 */
export function GameResultPanel({
  detail,
  headline,
  isSaved,
  onExportPgn,
  onNewGame,
  onReview,
  outcome,
}: GameResultPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="game-result-title"
      className={`game-result-panel is-${outcome}`}
      data-outcome={outcome}
    >
      <p className="eyebrow">{OUTCOME_EYEBROW[outcome]}</p>
      <h2 id="game-result-title" ref={headingRef} tabIndex={-1}>
        {headline}
      </h2>
      <p>{detail}</p>
      <div className="state-actions">
        <button className="button button-primary" onClick={onNewGame} type="button">
          New Game
        </button>
        <button
          className="button button-secondary"
          disabled={!isSaved}
          onClick={onReview}
          type="button"
        >
          Review This Game
        </button>
        <button className="button button-ghost" onClick={onExportPgn} type="button">
          Copy PGN
        </button>
      </div>
      {isSaved ? null : (
        <p className="field-note">
          This game is not saved to history yet, so the review is unavailable.
        </p>
      )}
    </section>
  );
}
