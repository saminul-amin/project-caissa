import { useCallback, useRef, useState } from "react";
import type {
  GameResult,
  GameSession,
  LegalMove,
  MoveInput,
  MoveRecord,
  PromotionPiece,
  Square,
} from "@caissa/chess-core";

import { useCaissaApp, type ActiveGameRuntimeView } from "../../app/CaissaAppProvider";
import type { MoveSubmissionUiResult, StartGameUiResult } from "../../app/game-runtime-results";
import {
  createSourceSelection,
  moveFeedbackMessage,
  type BoardInputMethod,
  type BoardInteractionState,
  type BoardMoveIntent,
  type MoveFeedbackMessageKey,
} from "./board-interaction";

export interface ActiveGameInteraction {
  readonly announcement: string;
  readonly disabledReason: string | undefined;
  readonly feedback: MoveFeedbackMessageKey | undefined;
  readonly interaction: BoardInteractionState;
  readonly isInteractive: boolean;
  readonly isStarting: boolean;
  readonly persistence: ActiveGameRuntimeView["persistence"];
  readonly session: GameSession;
  readonly attemptMove: (intent: BoardMoveIntent) => Promise<MoveSubmissionUiResult | undefined>;
  readonly cancelPromotion: () => void;
  readonly choosePromotion: (piece: PromotionPiece) => Promise<MoveSubmissionUiResult | undefined>;
  readonly clearSelection: () => void;
  readonly retryPersistence: () => Promise<void>;
  readonly selectSquare: (square: Square, inputMethod?: BoardInputMethod) => Promise<void>;
  readonly startGame: () => Promise<StartGameUiResult>;
}

const idleState = Object.freeze({ status: "idle" as const });
const promotionOrder: readonly PromotionPiece[] = Object.freeze([
  "queen",
  "rook",
  "bishop",
  "knight",
]);

interface ScopedInteractionState {
  readonly interaction: BoardInteractionState;
  readonly scope: string;
}

interface ScopedFeedbackState {
  readonly scope: string;
  readonly value: MoveFeedbackMessageKey | undefined;
}

interface ScopedInteractionUpdate {
  readonly announcement?: string;
  readonly feedback?: MoveFeedbackMessageKey | undefined;
  readonly interaction?: BoardInteractionState;
}

export function useActiveGameInteraction(activeGame: ActiveGameRuntimeView): ActiveGameInteraction {
  const { actions } = useCaissaApp();
  const [isStarting, setIsStarting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const startPending = useRef(false);
  const submitPending = useRef(false);
  const { orientation, persistence, session } = activeGame;
  const scope = `${String(session.gameId)}:${String(session.revision)}:${session.lifecycle.phase}:${orientation}`;
  const [storedInteraction, setStoredInteraction] = useState<ScopedInteractionState>(() =>
    createScopedInteractionState(scope),
  );
  const [storedFeedback, setStoredFeedback] = useState<ScopedFeedbackState>(() =>
    Object.freeze({ scope, value: undefined }),
  );
  const interaction = storedInteraction.scope === scope ? storedInteraction.interaction : idleState;
  const feedback = storedFeedback.scope === scope ? storedFeedback.value : undefined;
  const baseEligibility = getGameInteractionEligibility(session, persistence);
  const isInteractive =
    baseEligibility.enabled &&
    interaction.status !== "submitting" &&
    interaction.status !== "promotion-required";

  const updateTransient = useCallback(
    (update: ScopedInteractionUpdate) => {
      if (update.interaction) {
        setStoredInteraction(Object.freeze({ interaction: update.interaction, scope }));
      }
      if ("announcement" in update) setAnnouncement(update.announcement ?? "");
      if ("feedback" in update) {
        setStoredFeedback(Object.freeze({ scope, value: update.feedback }));
      }
    },
    [scope],
  );

  const updateInteraction = useCallback(
    (next: BoardInteractionState) => {
      updateTransient({ interaction: next });
    },
    [updateTransient],
  );

  const clearSelection = useCallback(() => {
    updateTransient({ feedback: undefined, interaction: idleState });
  }, [updateTransient]);

  const submitMove = useCallback(
    async (move: MoveInput, inputMethod: BoardInputMethod): Promise<MoveSubmissionUiResult> => {
      if (submitPending.current) {
        return Object.freeze({ messageKey: "operation-in-progress", status: "blocked" });
      }
      submitPending.current = true;
      updateInteraction(
        Object.freeze({
          inputMethod,
          promotion: move.promotion,
          source: move.from,
          status: "submitting",
          target: move.to,
        }),
      );
      updateTransient({ feedback: undefined });

      try {
        const result = await actions.submitCurrentHumanMove({
          expectedRevision: session.revision,
          move,
        });
        if (result.status === "applied") {
          updateInteraction(idleState);
          updateTransient({ announcement: moveAnnouncement(result.move) });
          return result;
        }
        if (result.status === "completed") {
          updateInteraction(idleState);
          updateTransient({ announcement: completionAnnouncement(result) });
          return result;
        }

        updateInteraction(Object.freeze({ messageKey: result.messageKey, status: "rejected" }));
        updateTransient({
          announcement: moveFeedbackMessage(result.messageKey),
          feedback: result.messageKey,
        });
        return result;
      } finally {
        submitPending.current = false;
      }
    },
    [actions, session.revision, updateInteraction, updateTransient],
  );

  const attemptMove = useCallback(
    async (intent: BoardMoveIntent): Promise<MoveSubmissionUiResult | undefined> => {
      if (!getGameInteractionEligibility(session, persistence).enabled || submitPending.current) {
        updateTransient({ feedback: "invalid-state" });
        return undefined;
      }
      if (interaction.status === "promotion-required" || interaction.status === "submitting") {
        updateTransient({ feedback: "operation-in-progress" });
        return undefined;
      }

      const candidates = actions
        .readCurrentLegalMoves({ from: intent.from })
        .filter((move) => move.to === intent.to);
      if (candidates.length === 0) {
        updateInteraction(Object.freeze({ messageKey: "illegal-destination", status: "rejected" }));
        updateTransient({
          announcement: "That destination is not available in this position.",
          feedback: "illegal-destination",
        });
        return undefined;
      }

      const promotionCandidates = candidates.filter((move) => move.promotion !== undefined);
      if (promotionCandidates.length > 0) {
        const choices = promotionOrder.filter((piece) =>
          promotionCandidates.some((move) => move.promotion === piece),
        );
        updateInteraction(
          Object.freeze({
            choices: Object.freeze(choices),
            color: promotionCandidates[0]?.color ?? session.position.turn,
            inputMethod: intent.inputMethod,
            source: intent.from,
            status: "promotion-required",
            target: intent.to,
          }),
        );
        updateTransient({ announcement: "Choose a piece for promotion." });
        return undefined;
      }

      return submitMove(Object.freeze({ from: intent.from, to: intent.to }), intent.inputMethod);
    },
    [
      actions,
      interaction.status,
      persistence,
      session,
      submitMove,
      updateInteraction,
      updateTransient,
    ],
  );

  const selectSquare = useCallback(
    async (square: Square, inputMethod: BoardInputMethod = "click"): Promise<void> => {
      if (!getGameInteractionEligibility(session, persistence).enabled || submitPending.current) {
        updateTransient({ feedback: "invalid-state" });
        return;
      }

      const current = interaction;
      if (current.status === "promotion-required" || current.status === "submitting") return;
      if (current.status === "source-selected" && current.source === square) {
        clearSelection();
        updateTransient({ announcement: "Selection cleared." });
        return;
      }
      if (current.status === "source-selected" && current.legalTargets.includes(square)) {
        await attemptMove({ from: current.source, inputMethod, to: square });
        return;
      }

      const legalMoves = actions.readCurrentLegalMoves({ from: square });
      if (legalMoves.length === 0) {
        const messageKey =
          current.status === "source-selected" ? "illegal-destination" : "no-legal-moves";
        updateInteraction(Object.freeze({ messageKey, status: "rejected" }));
        updateTransient({
          announcement:
            messageKey === "illegal-destination"
              ? "That destination is not available in this position."
              : "That square has no available move.",
          feedback: messageKey,
        });
        return;
      }

      updateInteraction(createSourceSelection(square, legalMoves));
      updateTransient({
        announcement: selectionAnnouncement(square, legalMoves),
        feedback: undefined,
      });
    },
    [
      actions,
      attemptMove,
      clearSelection,
      interaction,
      persistence,
      session,
      updateInteraction,
      updateTransient,
    ],
  );

  const choosePromotion = useCallback(
    async (piece: PromotionPiece): Promise<MoveSubmissionUiResult | undefined> => {
      const current = interaction;
      if (current.status !== "promotion-required" || !current.choices.includes(piece)) {
        return undefined;
      }
      return submitMove(
        Object.freeze({ from: current.source, promotion: piece, to: current.target }),
        current.inputMethod,
      );
    },
    [interaction, submitMove],
  );

  const cancelPromotion = useCallback(() => {
    if (interaction.status !== "promotion-required") return;
    updateTransient({
      announcement: "Promotion cancelled. No move was made.",
      feedback: undefined,
      interaction: idleState,
    });
  }, [interaction.status, updateTransient]);

  const startGame = useCallback(async (): Promise<StartGameUiResult> => {
    if (startPending.current) {
      return Object.freeze({ messageKey: "operation-in-progress", status: "blocked" });
    }
    startPending.current = true;
    setIsStarting(true);
    updateTransient({ feedback: undefined });
    try {
      const result = await actions.startCurrentGame();
      if (result.status === "applied") {
        updateTransient({ announcement: `${capitalize(result.activeColor)} to move.` });
      } else if (result.status === "completed") {
        updateTransient({ announcement: resultAnnouncement(result.result) });
      } else {
        updateTransient({
          announcement: moveFeedbackMessage(result.messageKey),
          feedback: result.messageKey,
        });
      }
      return result;
    } finally {
      startPending.current = false;
      setIsStarting(false);
    }
  }, [actions, updateTransient]);

  const retryPersistence = useCallback(async (): Promise<void> => {
    await actions.retryCurrentGamePersistence();
  }, [actions]);

  return {
    announcement,
    disabledReason: baseEligibility.reason,
    feedback,
    interaction,
    isInteractive,
    isStarting,
    persistence,
    session,
    attemptMove,
    cancelPromotion,
    choosePromotion,
    clearSelection,
    retryPersistence,
    selectSquare,
    startGame,
  };
}

export interface GameInteractionEligibility {
  readonly enabled: boolean;
  readonly reason?: string;
}

function createScopedInteractionState(scope: string): ScopedInteractionState {
  return Object.freeze({
    interaction: idleState,
    scope,
  });
}

export function getGameInteractionEligibility(
  session: GameSession,
  persistence: ActiveGameRuntimeView["persistence"],
): GameInteractionEligibility {
  if (persistence.status === "finalization-pending") {
    return { enabled: false, reason: "This completed game is waiting to be saved." };
  }
  if (session.result || session.position.terminalState.status !== "ongoing") {
    return { enabled: false, reason: "This game is complete." };
  }
  if (session.lifecycle.phase !== "player-turn") {
    return { enabled: false, reason: phaseReason(session.lifecycle.phase) };
  }
  if (session.configuration.participants[session.position.turn].kind !== "human") {
    return { enabled: false, reason: "Waiting for the other participant." };
  }
  return { enabled: true };
}

function phaseReason(phase: GameSession["lifecycle"]["phase"]): string {
  switch (phase) {
    case "ready":
      return "Begin the game before moving a piece.";
    case "paused":
      return "The game is paused.";
    case "opponent-turn":
    case "awaiting-opponent":
      return "Waiting for the other participant.";
    case "degraded":
      return "The opponent is currently unavailable.";
    case "completed":
      return "This game is complete.";
    case "abandoned":
      return "This game was abandoned.";
    case "committing":
      return "The move is being committed.";
    case "creating":
      return "The game is being prepared.";
    case "failed":
    case "recovery":
      return "This game needs recovery before play can continue.";
    case "player-turn":
      return "Move input is unavailable.";
  }
}

function selectionAnnouncement(square: Square, moves: readonly LegalMove[]): string {
  const move = moves[0];
  if (!move) return `Selected ${String(square)}.`;
  const count = new Set(moves.map((candidate) => candidate.to)).size;
  return `${capitalize(move.color)} ${move.piece} on ${String(square)} selected. ${String(count)} legal ${count === 1 ? "destination" : "destinations"}.`;
}

function moveAnnouncement(move: MoveRecord): string {
  const next = move.mover === "white" ? "Black" : "White";
  const promotion = move.promotion
    ? ` ${capitalize(move.mover)} promoted to ${capitalize(move.promotion)} on ${String(move.uci).slice(2, 4)}.`
    : "";
  const check = move.givesCheck ? " Check." : "";
  return `${capitalize(move.mover)} played ${String(move.san)}. ${next} to move.${promotion}${check}`;
}

function completionAnnouncement(
  result: MoveSubmissionUiResult & { readonly status: "completed" },
): string {
  if (result.expiredColor) {
    return `${capitalize(result.expiredColor)}'s time expired. ${resultAnnouncement(result.result)}`;
  }
  const move = result.move
    ? `${capitalize(result.move.mover)} played ${String(result.move.san)}. `
    : "";
  return `${move}${resultAnnouncement(result.result)}`;
}

function resultAnnouncement(result: GameResult): string {
  if (result.status === "draw") return `Game drawn by ${result.reason.replaceAll("-", " ")}.`;
  if (result.status === "abandoned") return "Game abandoned.";
  return `${capitalize(result.winner)} wins by ${result.reason}.`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
