import type { Color, LegalMove, PromotionPiece, Square } from "@caissa/chess-core";

import type { GameInteractionMessageKey } from "../../app/game-runtime-results";

export type BoardInputMethod = "click" | "drag" | "keyboard" | "touch";

export interface BoardMoveIntent {
  readonly from: Square;
  readonly inputMethod: BoardInputMethod;
  readonly to: Square;
}

export type MoveFeedbackMessageKey =
  GameInteractionMessageKey | "illegal-destination" | "no-legal-moves";

export function moveFeedbackMessage(messageKey: MoveFeedbackMessageKey): string {
  switch (messageKey) {
    case "illegal-move":
    case "illegal-destination":
      return "That move is not available in this position.";
    case "no-legal-moves":
      return "That square has no available move.";
    case "position-changed":
      return "The position changed. Choose the move again.";
    case "wrong-turn":
      return "It is not that participant's turn.";
    case "game-not-started":
      return "Begin the game before moving a piece.";
    case "game-paused":
      return "The game is paused.";
    case "game-completed":
      return "This game is complete.";
    case "clock-expired":
      return "The active clock expired before the move was completed.";
    case "persistence-pending":
      return "The completed game must be saved before another action.";
    case "promotion-required":
      return "Choose a promotion piece.";
    case "operation-in-progress":
      return "The previous action is still being completed.";
    case "no-active-game":
    case "invalid-state":
    case "temporarily-unavailable":
      return "That action is not available right now. Your position is unchanged.";
  }
}

export type BoardInteractionState =
  | { readonly status: "idle" }
  | {
      readonly captureTargets: readonly Square[];
      readonly legalMoves: readonly LegalMove[];
      readonly legalTargets: readonly Square[];
      readonly source: Square;
      readonly status: "source-selected";
    }
  | {
      readonly choices: readonly PromotionPiece[];
      readonly color: Color;
      readonly inputMethod: BoardInputMethod;
      readonly source: Square;
      readonly status: "promotion-required";
      readonly target: Square;
    }
  | {
      readonly inputMethod: BoardInputMethod;
      readonly promotion: PromotionPiece | undefined;
      readonly source: Square;
      readonly status: "submitting";
      readonly target: Square;
    }
  | {
      readonly messageKey: MoveFeedbackMessageKey;
      readonly status: "rejected";
    };

export interface BoardSelectionProjection {
  readonly captureTargets: readonly Square[];
  readonly legalTargets: readonly Square[];
  readonly selectedSource: Square | undefined;
}

export function projectBoardSelection(
  interaction: BoardInteractionState,
): BoardSelectionProjection {
  if (interaction.status !== "source-selected") {
    return Object.freeze({
      captureTargets: Object.freeze([]),
      legalTargets: Object.freeze([]),
      selectedSource: undefined,
    });
  }
  return Object.freeze({
    captureTargets: interaction.captureTargets,
    legalTargets: interaction.legalTargets,
    selectedSource: interaction.source,
  });
}

export function createSourceSelection(
  source: Square,
  legalMoves: readonly LegalMove[],
): Extract<BoardInteractionState, { readonly status: "source-selected" }> {
  const moves = Object.freeze(legalMoves.map((move) => Object.freeze({ ...move })));
  return Object.freeze({
    captureTargets: uniqueTargets(moves.filter((move) => move.captured !== undefined)),
    legalMoves: moves,
    legalTargets: uniqueTargets(moves),
    source,
    status: "source-selected",
  });
}

function uniqueTargets(moves: readonly LegalMove[]): readonly Square[] {
  return Object.freeze([...new Set(moves.map((move) => move.to))]);
}
