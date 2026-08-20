import { useCallback, useMemo, useRef, useState } from "react";
import { parseUndoPlyCount, type GameSession, type UndoPlyCount } from "@caissa/chess-core";

import { useCaissaApp, type ActiveGameRuntimeView } from "../../app/CaissaAppProvider";
import type {
  GameControlMessageKey,
  GameControlUiResult,
  PendingGameControl,
} from "../../app/game-runtime-results";
import { deriveGameControlsAvailability, type GameControlsAvailability } from "./game-controls";

export type GameControlConfirmation =
  | { readonly kind: "undo-completed"; readonly plies: 1 | 2 }
  | { readonly kind: "restart" }
  | { readonly kind: "abandon" };

export interface GameControlFeedback {
  readonly kind: "error" | "success";
  readonly message: string;
}

export interface ActiveGameControls {
  readonly announcement: string;
  readonly availability: GameControlsAvailability;
  readonly confirmation: GameControlConfirmation | undefined;
  readonly feedback: GameControlFeedback | undefined;
  readonly focusStatusRequest: number;
  readonly isLocked: boolean;
  readonly pendingControl: PendingGameControl | undefined;
  readonly abandonGame: () => Promise<GameControlUiResult>;
  readonly cancelConfirmation: () => void;
  readonly confirmControl: () => Promise<void>;
  readonly pauseGame: () => Promise<GameControlUiResult>;
  readonly requestAbandon: () => void;
  readonly requestRestart: () => void;
  readonly requestUndoMoves: (plies: 1 | 2) => Promise<void>;
  readonly restartGame: () => Promise<GameControlUiResult>;
  readonly resumeGame: () => Promise<GameControlUiResult>;
  readonly retryPersistence: () => Promise<void>;
  readonly undoMoves: (plies: UndoPlyCount) => Promise<GameControlUiResult>;
}

interface ActiveGameControlsOptions {
  readonly interactionStatus: "idle" | "move-pending" | "promotion-pending";
  readonly onReconcileInteraction: () => void;
}

export function useActiveGameControls(
  activeGame: ActiveGameRuntimeView,
  options: ActiveGameControlsOptions,
): ActiveGameControls {
  const { actions } = useCaissaApp();
  const [pendingControl, setPendingControl] = useState<PendingGameControl | undefined>(undefined);
  const [confirmation, setConfirmation] = useState<GameControlConfirmation | undefined>(undefined);
  const [feedback, setFeedback] = useState<GameControlFeedback | undefined>(undefined);
  const [announcement, setAnnouncement] = useState("");
  const [focusStatusRequest, setFocusStatusRequest] = useState(0);
  const pendingRef = useRef<PendingGameControl | undefined>(undefined);
  const { session, persistence } = activeGame;

  const availability = useMemo(
    () =>
      deriveGameControlsAvailability({
        isConfirmationOpen: confirmation !== undefined,
        isMovePending: options.interactionStatus === "move-pending",
        isPromotionPending: options.interactionStatus === "promotion-pending",
        pendingControl,
        persistence,
        session,
      }),
    [confirmation, options.interactionStatus, pendingControl, persistence, session],
  );

  const run = useCallback(
    async (
      control: PendingGameControl,
      operation: () => Promise<GameControlUiResult>,
    ): Promise<GameControlUiResult> => {
      if (pendingRef.current) {
        return Object.freeze({
          control,
          messageKey: "operation-in-progress",
          status: "blocked",
        });
      }
      pendingRef.current = control;
      setPendingControl(control);
      setFeedback(undefined);
      try {
        const result = await operation();
        const message = gameControlResultMessage(result, session);
        if (result.status === "applied" || result.status === "completed") {
          options.onReconcileInteraction();
          setFeedback(Object.freeze({ kind: "success", message }));
          setFocusStatusRequest((value) => value + 1);
        } else {
          setFeedback(Object.freeze({ kind: "error", message }));
        }
        setAnnouncement(message);
        return result;
      } finally {
        pendingRef.current = undefined;
        setPendingControl(undefined);
      }
    },
    [options, session],
  );

  const pauseGame = useCallback(
    () => run("pause", actions.pauseCurrentGame),
    [actions.pauseCurrentGame, run],
  );
  const resumeGame = useCallback(
    () => run("resume", actions.resumeCurrentGame),
    [actions.resumeCurrentGame, run],
  );
  const undoMoves = useCallback(
    (plies: UndoPlyCount) => {
      return run(plies === 1 ? "undo-one" : "undo-two", () => actions.undoCurrentGameMoves(plies));
    },
    [actions, run],
  );
  const restartGame = useCallback(
    () => run("restart", actions.restartCurrentGame),
    [actions.restartCurrentGame, run],
  );
  const abandonGame = useCallback(
    () => run("abandon", actions.abandonCurrentGame),
    [actions.abandonCurrentGame, run],
  );

  const requestUndoMoves = useCallback(
    async (plies: 1 | 2) => {
      if (session.lifecycle.phase === "completed") {
        setConfirmation(Object.freeze({ kind: "undo-completed", plies }));
        return;
      }
      await undoMoves(parseUndoPlyCount(plies));
    },
    [session.lifecycle.phase, undoMoves],
  );

  const confirmControl = useCallback(async () => {
    const current = confirmation;
    if (!current || pendingRef.current) return;
    try {
      switch (current.kind) {
        case "undo-completed":
          await undoMoves(parseUndoPlyCount(current.plies));
          break;
        case "restart":
          await restartGame();
          break;
        case "abandon":
          await abandonGame();
      }
    } finally {
      setConfirmation(undefined);
    }
  }, [abandonGame, confirmation, restartGame, undoMoves]);

  const retryPersistence = useCallback(async () => {
    await actions.retryCurrentGamePersistence();
  }, [actions]);

  return {
    announcement,
    availability,
    confirmation,
    feedback,
    focusStatusRequest,
    isLocked: pendingControl !== undefined || confirmation !== undefined,
    pendingControl,
    abandonGame,
    cancelConfirmation: () => {
      setConfirmation(undefined);
    },
    confirmControl,
    pauseGame,
    requestAbandon: () => {
      setConfirmation(Object.freeze({ kind: "abandon" }));
    },
    requestRestart: () => {
      setConfirmation(Object.freeze({ kind: "restart" }));
    },
    requestUndoMoves,
    restartGame,
    resumeGame,
    retryPersistence,
    undoMoves,
  };
}

export function gameControlResultMessage(
  result: GameControlUiResult,
  session: GameSession,
): string {
  if ("messageKey" in result) {
    return rejectionMessage(result.messageKey);
  }

  const persistence = persistenceMessage(result.persistence);
  if (result.status === "completed") {
    if (result.expiredColor) {
      const action = result.control === "pause" ? "paused" : "ended as abandoned";
      return `${capitalize(result.expiredColor)}'s time expired before the game could be ${action}.${persistence}`;
    }
    if (result.control === "abandon") {
      return `Game ended without awarding a winner.${persistence}`;
    }
    return `${capitalize(session.position.turn)}'s time expired before the game could be paused.${persistence}`;
  }

  switch (result.control) {
    case "pause":
      return `Game paused. Neither clock is running.${persistence}`;
    case "resume":
      return `Game resumed. ${capitalize(session.position.turn)} to move.${persistence}`;
    case "undo-one":
      return `${result.reopened ? "Completed game reopened. " : ""}Undid the last move.${persistence}`;
    case "undo-two":
      return `${result.reopened ? "Completed game reopened. " : ""}Undid the last two plies.${persistence}`;
    case "restart":
      return `Game returned to its starting position. Choose Begin Game when ready.${persistence}`;
  }

  return "The game action completed.";
}

function persistenceMessage(
  persistence: "finalization-pending" | "finalized" | "saved" | "unsaved",
): string {
  switch (persistence) {
    case "saved":
    case "finalized":
      return " Saved locally.";
    case "unsaved":
      return " The change is active but has not been saved locally.";
    case "finalization-pending":
      return " Saving the completed game to history is still pending.";
  }
}

function rejectionMessage(key: GameControlMessageKey): string {
  switch (key) {
    case "no-active-game":
      return "No active game is available.";
    case "operation-in-progress":
      return "Another game action is already in progress.";
    case "persistence-pending":
      return "Save the completed game to history before changing it.";
    case "position-changed":
      return "The game changed before that action completed. Review the current position.";
    case "game-paused":
      return "The game is already paused.";
    case "game-not-paused":
      return "The game is not paused.";
    case "game-completed":
      return "This game has already ended.";
    case "undo-disabled":
      return "Undo is disabled for this game.";
    case "insufficient-history":
      return "There are not enough moves to undo.";
    case "resume-before-undo":
      return "Resume the game before undoing.";
    case "already-ready":
      return "This game is already at its starting position.";
    case "invalid-state":
      return "That action is unavailable in the current game state.";
    case "temporarily-unavailable":
      return "That action could not be completed. The current game was kept unchanged.";
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
