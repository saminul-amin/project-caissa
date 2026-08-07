import type { GameSession } from "@caissa/chess-core";

import type { PendingGameControl } from "../../app/game-runtime-results";
import type { SessionPersistenceState } from "../../application";

export type GameControlUnavailableReason =
  | "already-ready"
  | "feature-unavailable"
  | "finish-promotion"
  | "game-completed"
  | "insufficient-history"
  | "invalid-lifecycle"
  | "no-active-game"
  | "operation-in-progress"
  | "persistence-in-progress"
  | "persistence-pending"
  | "resume-before-undo"
  | "undo-disabled";

export type GameControlAvailability =
  | { readonly available: true }
  | {
      readonly available: false;
      readonly message: string;
      readonly reason: GameControlUnavailableReason;
    };

export interface GameControlsAvailability {
  readonly abandon: GameControlAvailability;
  readonly pause: GameControlAvailability;
  readonly restart: GameControlAvailability;
  readonly resume: GameControlAvailability;
  readonly undoOne: GameControlAvailability;
  readonly undoTwo: GameControlAvailability;
}

export interface GameControlsAvailabilityInput {
  readonly isConfirmationOpen: boolean;
  readonly isMovePending: boolean;
  readonly isPromotionPending: boolean;
  readonly pendingControl: PendingGameControl | undefined;
  readonly persistence: SessionPersistenceState | undefined;
  readonly session: GameSession | undefined;
}

const available: GameControlAvailability = Object.freeze({ available: true });

export function deriveGameControlsAvailability(
  input: GameControlsAvailabilityInput,
): GameControlsAvailability {
  const globalBlock = globalUnavailable(input);
  if (globalBlock) return allUnavailable(globalBlock);

  const session = input.session;
  if (!session)
    return allUnavailable(unavailable("no-active-game", "No active game is available."));

  const phase = session.lifecycle.phase;
  return Object.freeze({
    abandon: canAbandon(phase)
      ? available
      : unavailable("game-completed", "This game has already ended."),
    pause: isResumablePhase(phase)
      ? available
      : unavailable(
          "invalid-lifecycle",
          phase === "paused" ? "The game is already paused." : "Pause is unavailable right now.",
        ),
    restart:
      phase === "creating" || phase === "committing"
        ? unavailable("invalid-lifecycle", "Restart is unavailable while a change is committing.")
        : phase === "ready" && session.history.length === 0 && !session.result
          ? unavailable("already-ready", "This game is already at its starting position.")
          : available,
    resume:
      phase === "paused"
        ? available
        : unavailable("invalid-lifecycle", "Resume is available only while the game is paused."),
    undoOne: undoAvailability(session, 1),
    undoTwo: undoAvailability(session, 2),
  });
}

function globalUnavailable(
  input: GameControlsAvailabilityInput,
): GameControlAvailability | undefined {
  if (!input.session || !input.persistence) {
    return unavailable("no-active-game", "No active game is available.");
  }
  if (input.persistence.status === "finalization-pending") {
    return unavailable(
      "persistence-pending",
      "Save the completed game to history before changing it.",
    );
  }
  if (input.persistence.status === "saving" || input.persistence.status === "retrying") {
    return unavailable("persistence-in-progress", "Wait for the local save to finish.");
  }
  if (input.pendingControl || input.isMovePending || input.isConfirmationOpen) {
    return unavailable("operation-in-progress", "Wait for the current game action to finish.");
  }
  if (input.isPromotionPending) {
    return unavailable("finish-promotion", "Finish or cancel the promotion choice first.");
  }
  return undefined;
}

function undoAvailability(session: GameSession, plies: 1 | 2): GameControlAvailability {
  const phase = session.lifecycle.phase;
  if (!session.configuration.allowUndo) {
    return unavailable("undo-disabled", "Undo is disabled for this game.");
  }
  if (phase === "paused") {
    return unavailable("resume-before-undo", "Resume the game before undoing.");
  }
  if (phase === "abandoned") {
    return unavailable("game-completed", "An abandoned game cannot be reopened with undo.");
  }
  if (!isUndoablePhase(phase)) {
    return unavailable("invalid-lifecycle", "Undo is unavailable in the current game state.");
  }
  if (session.history.length < plies) {
    return unavailable(
      "insufficient-history",
      plies === 1 ? "There is no move to undo." : "Two plies have not been played yet.",
    );
  }
  return available;
}

function isUndoablePhase(phase: GameSession["lifecycle"]["phase"]): boolean {
  return (
    phase === "player-turn" ||
    phase === "opponent-turn" ||
    phase === "awaiting-opponent" ||
    phase === "degraded" ||
    phase === "completed"
  );
}

function isResumablePhase(phase: GameSession["lifecycle"]["phase"]): boolean {
  return (
    phase === "player-turn" ||
    phase === "opponent-turn" ||
    phase === "awaiting-opponent" ||
    phase === "degraded"
  );
}

function canAbandon(phase: GameSession["lifecycle"]["phase"]): boolean {
  return (
    phase !== "creating" && phase !== "committing" && phase !== "completed" && phase !== "abandoned"
  );
}

function unavailable(
  reason: GameControlUnavailableReason,
  message: string,
): GameControlAvailability {
  return Object.freeze({ available: false, message, reason });
}

function allUnavailable(value: GameControlAvailability): GameControlsAvailability {
  return Object.freeze({
    abandon: value,
    pause: value,
    restart: value,
    resume: value,
    undoOne: value,
    undoTwo: value,
  });
}
