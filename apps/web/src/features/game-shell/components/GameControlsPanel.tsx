import { useId } from "react";

import { ConfirmationDialog } from "../../../components/ConfirmationDialog";
import type { ActiveGameControls, GameControlConfirmation } from "../use-active-game-controls";
import type { GameControlAvailability } from "../game-controls";

interface GameControlsPanelProps {
  readonly controls: ActiveGameControls;
  readonly isPaused: boolean;
}

export function GameControlsPanel({ controls, isPaused }: GameControlsPanelProps) {
  const titleId = useId();
  const isBusy = controls.pendingControl !== undefined;

  return (
    <>
      <section aria-busy={isBusy} aria-labelledby={titleId} className="game-controls-panel">
        <div className="game-controls-heading">
          <div>
            <p className="eyebrow">Game controls</p>
            <h2 id={titleId}>Manage this game</h2>
          </div>
          {isBusy ? <p role="status">{pendingLabel(controls.pendingControl)}</p> : null}
        </div>

        <div className="game-controls-groups">
          <div className="game-control-group" aria-label="Clock control">
            {isPaused ? (
              <ControlButton
                availability={controls.availability.resume}
                isBusy={isBusy}
                label="Resume"
                onActivate={() => void controls.resumeGame()}
              />
            ) : (
              <ControlButton
                availability={controls.availability.pause}
                isBusy={isBusy}
                label="Pause"
                onActivate={() => void controls.pauseGame()}
              />
            )}
          </div>

          <div className="game-control-group" aria-label="Move history controls">
            <ControlButton
              availability={controls.availability.undoOne}
              isBusy={isBusy}
              label="Undo last move"
              onActivate={() => void controls.requestUndoMoves(1)}
            />
            <ControlButton
              availability={controls.availability.undoTwo}
              isBusy={isBusy}
              label="Undo last two plies"
              onActivate={() => void controls.requestUndoMoves(2)}
            />
          </div>

          <div className="game-control-group" aria-label="Game reset control">
            <ControlButton
              availability={controls.availability.restart}
              isBusy={isBusy}
              label="Restart game"
              onActivate={controls.requestRestart}
            />
          </div>

          <div className="game-control-group game-control-danger" aria-label="End game control">
            <ControlButton
              availability={controls.availability.abandon}
              destructive
              isBusy={isBusy}
              label="End game"
              onActivate={controls.requestAbandon}
            />
          </div>
        </div>

        {controls.feedback ? (
          <p
            className={`game-control-feedback is-${controls.feedback.kind}`}
            role={controls.feedback.kind === "error" ? "alert" : "status"}
          >
            {controls.feedback.message}
          </p>
        ) : null}
      </section>

      {controls.confirmation ? (
        <GameControlConfirmationDialog confirmation={controls.confirmation} controls={controls} />
      ) : null}
    </>
  );
}

interface ControlButtonProps {
  readonly availability: GameControlAvailability;
  readonly destructive?: boolean;
  readonly isBusy: boolean;
  readonly label: string;
  readonly onActivate: () => void;
}

function ControlButton({
  availability,
  destructive = false,
  isBusy,
  label,
  onActivate,
}: ControlButtonProps) {
  const reasonId = useId();
  const unavailable = !availability.available;
  return (
    <div className="game-control-action">
      <button
        aria-describedby={unavailable ? reasonId : undefined}
        aria-disabled={isBusy || unavailable}
        className={destructive ? "button button-destructive" : "button button-secondary"}
        disabled={isBusy}
        onClick={() => {
          if (!unavailable && !isBusy) onActivate();
        }}
        type="button"
      >
        {label}
      </button>
      {unavailable ? (
        <span className="game-control-reason" id={reasonId}>
          {availability.message}
        </span>
      ) : null}
    </div>
  );
}

function GameControlConfirmationDialog({
  confirmation,
  controls,
}: {
  readonly confirmation: GameControlConfirmation;
  readonly controls: ActiveGameControls;
}) {
  const content = confirmationContent(confirmation);
  return (
    <ConfirmationDialog
      cancelLabel="Keep current game"
      confirmLabel={content.confirmLabel}
      destructive={content.destructive}
      isBusy={controls.pendingControl !== undefined}
      onCancel={controls.cancelConfirmation}
      onConfirm={() => void controls.confirmControl()}
      title={content.title}
    >
      <p>{content.description}</p>
    </ConfirmationDialog>
  );
}

function confirmationContent(confirmation: GameControlConfirmation): {
  readonly confirmLabel: string;
  readonly description: string;
  readonly destructive: boolean;
  readonly title: string;
} {
  switch (confirmation.kind) {
    case "undo-completed":
      return {
        confirmLabel: confirmation.plies === 1 ? "Reopen and undo move" : "Reopen and undo plies",
        description:
          "This reopens the completed game and removes its saved result from the active session. The change is written locally as one operation.",
        destructive: false,
        title: "Reopen this completed game?",
      };
    case "restart":
      return {
        confirmLabel: "Restart game",
        description:
          "This clears the move history, result, and clocks, then returns the same game to its starting position. You will need to choose Begin Game again.",
        destructive: true,
        title: "Restart this game?",
      };
    case "abandon":
      return {
        confirmLabel: "End game",
        description:
          "This ends the game without awarding a winner. The current position and move history remain available in local history.",
        destructive: true,
        title: "End this game?",
      };
  }
}

function pendingLabel(control: ActiveGameControls["pendingControl"]): string {
  switch (control) {
    case "pause":
      return "Pausing…";
    case "resume":
      return "Resuming…";
    case "undo-one":
    case "undo-two":
      return "Undoing…";
    case "restart":
      return "Restarting…";
    case "abandon":
      return "Ending game…";
    case undefined:
      return "";
  }
}
