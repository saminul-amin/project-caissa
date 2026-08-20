import type { Color, GameResult, GameSession } from "@caissa/chess-core";

import type { OpponentRuntimeStatus } from "../../application/opponent";
import type { OpponentPanelState } from "./components/OpponentStatusPanel";
import { resultLabel } from "./game-shell-projections";

export interface OpponentPanelInput {
  readonly hasExternalOpponent: boolean;
  readonly opponentLabel: string;
  readonly session: GameSession;
  readonly status: OpponentRuntimeStatus;
}

const degradedDetail =
  "Caissa could not get a move from the engine. Your position and clock are unchanged.";

/** Derives the single opponent message a player should see for the current position. */
export function projectOpponentPanel(input: OpponentPanelInput): OpponentPanelState {
  if (!input.hasExternalOpponent) return Object.freeze({ kind: "hidden" as const });

  const phase = input.session.lifecycle.phase;
  if (phase === "degraded") {
    return Object.freeze({
      detail: degradedDetail,
      kind: "unavailable" as const,
      retryable: true,
    });
  }
  if (input.status.kind === "unavailable") {
    return Object.freeze({
      detail: input.status.detail,
      kind: "unavailable" as const,
      retryable: phase === "opponent-turn" || phase === "awaiting-opponent",
    });
  }
  if (phase !== "opponent-turn" && phase !== "awaiting-opponent") {
    return Object.freeze({ kind: "hidden" as const });
  }
  if (input.status.kind === "loading") {
    return Object.freeze({
      kind: "loading" as const,
      percent: input.status.ratio === undefined ? undefined : Math.round(input.status.ratio * 100),
    });
  }
  return Object.freeze({ kind: "thinking" as const, label: input.opponentLabel });
}

export interface GameResultPresentation {
  readonly detail: string;
  readonly headline: string;
  readonly outcome: "draw" | "loss" | "unfinished" | "win";
}

export interface GameResultInput {
  readonly playerColor: Color | undefined;
  readonly result: GameResult;
}

/**
 * Result copy is written from the player's point of view when Caissa knows which side
 * they played, and stays neutral when it does not.
 */
export function projectGameResult(input: GameResultInput): GameResultPresentation {
  const label = resultLabel(input.result);

  if (input.result.status === "abandoned") {
    return Object.freeze({
      detail: "The game was ended before a chess result was reached.",
      headline: "Game ended",
      outcome: "unfinished" as const,
    });
  }

  if (input.result.status === "draw") {
    return Object.freeze({
      detail: `${label}. Neither side could force a win from the final position.`,
      headline: "Drawn game",
      outcome: "draw" as const,
    });
  }

  if (input.playerColor === undefined) {
    return Object.freeze({
      detail: `${label}.`,
      headline: `${capitalize(input.result.winner)} wins`,
      outcome: "unfinished" as const,
    });
  }

  const playerWon = input.result.winner === input.playerColor;
  return Object.freeze({
    detail: playerWon
      ? `${label}. Well played.`
      : `${label}. The position is worth a second look in review.`,
    headline: playerWon ? "You won" : "You lost",
    outcome: playerWon ? ("win" as const) : ("loss" as const),
  });
}

/** The colour the local player controls, or undefined when both sides are human. */
export function localPlayerColor(session: GameSession): Color | undefined {
  const { participants } = session.configuration;
  if (participants.white.kind === "human" && participants.black.kind === "human") return undefined;
  return participants.white.kind === "human" ? "white" : "black";
}

export function opponentLabel(session: GameSession): string {
  const { participants } = session.configuration;
  const external =
    participants.white.kind === "external-opponent" ? participants.white : participants.black;
  return external.label ?? "Caissa";
}

export function gameModeLabel(session: GameSession): string {
  const { participants } = session.configuration;
  return participants.white.kind === "human" && participants.black.kind === "human"
    ? "Local two-player game"
    : `Game against ${opponentLabel(session)}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
