import type { DrawReason, TerminalState } from "./chess-rules";
import type { Color } from "./primitives";

export type PgnResultToken = "0-1" | "1-0" | "1/2-1/2";

export type DecisiveGameResultReason = "checkmate" | "timeout";
export type DrawGameResultReason = DrawReason;

export type DecisiveGameResult = {
  readonly isDraw: false;
  readonly loser: Color;
  readonly pgnResult: "0-1" | "1-0";
  readonly reason: DecisiveGameResultReason;
  readonly status: "decisive";
  readonly winner: Color;
};

export type DrawGameResult = {
  readonly isDraw: true;
  readonly pgnResult: "1/2-1/2";
  readonly reason: DrawGameResultReason;
  readonly status: "draw";
};

export type AbandonedGameResult =
  | {
      readonly isDraw: false;
      readonly reason: "abandoned";
      readonly status: "abandoned";
    }
  | {
      readonly isDraw: false;
      readonly loser: Color;
      readonly pgnResult: "0-1" | "1-0";
      readonly reason: "abandoned";
      readonly status: "abandoned";
      readonly winner: Color;
    };

export type CompletedGameResult = DecisiveGameResult | DrawGameResult;
export type GameResult = AbandonedGameResult | CompletedGameResult;

/**
 * Version 1 timeout policy: the non-expired side wins.
 *
 * This deliberately does not attempt a handcrafted per-color mating-material adjudication.
 */
export function createTimeoutGameResult(expiredColor: Color): DecisiveGameResult {
  return createDecisiveResult("timeout", oppositeColor(expiredColor), expiredColor);
}

export function createAbandonedGameResult(awardedWinner?: Color): AbandonedGameResult {
  if (!awardedWinner) {
    return { isDraw: false, reason: "abandoned", status: "abandoned" };
  }

  const loser = oppositeColor(awardedWinner);
  return {
    isDraw: false,
    loser,
    pgnResult: resultTokenForWinner(awardedWinner),
    reason: "abandoned",
    status: "abandoned",
    winner: awardedWinner,
  };
}

export function createGameResultFromTerminalState(
  terminalState: Exclude<TerminalState, { readonly status: "ongoing" }>,
): CompletedGameResult {
  if (terminalState.status === "checkmate") {
    return createDecisiveResult("checkmate", terminalState.winner, terminalState.loser);
  }

  return {
    isDraw: true,
    pgnResult: "1/2-1/2",
    reason: terminalState.reason,
    status: "draw",
  };
}

function createDecisiveResult(
  reason: DecisiveGameResultReason,
  winner: Color,
  loser: Color,
): DecisiveGameResult {
  return {
    isDraw: false,
    loser,
    pgnResult: resultTokenForWinner(winner),
    reason,
    status: "decisive",
    winner,
  };
}

function resultTokenForWinner(winner: Color): "0-1" | "1-0" {
  return winner === "white" ? "1-0" : "0-1";
}

function oppositeColor(color: Color): Color {
  return color === "white" ? "black" : "white";
}
