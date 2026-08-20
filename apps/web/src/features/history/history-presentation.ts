import type { GameResult, TimeControl } from "@caissa/chess-core";

import type { GameHistoryListItem } from "../../application/history";

export interface HistoryRowModel {
  readonly blackLabel: string;
  readonly completedLabel: string;
  readonly gameId: string;
  readonly moveLabel: string;
  readonly outcome: "draw" | "loss" | "unfinished" | "win";
  readonly resultLabel: string;
  readonly reviewLabel: string;
  readonly timeControlLabel: string;
  readonly whiteLabel: string;
}

export interface HistoryRowOptions {
  readonly formatDate?: (epochMs: number) => string;
}

const defaultDateFormatter = (epochMs: number): string =>
  new Date(epochMs).toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });

/** Turns a stored history entry into the exact strings the list renders. */
export function createHistoryRowModel(
  item: GameHistoryListItem,
  options: HistoryRowOptions = {},
): HistoryRowModel {
  const formatDate = options.formatDate ?? defaultDateFormatter;
  const playerColor = localPlayerColorFromParticipants(item);

  return Object.freeze({
    blackLabel: item.participants.black.label ?? "Black",
    completedLabel: formatDate(item.completedAt),
    gameId: String(item.gameId),
    moveLabel: `${String(fullMoveCount(item.moveCount))} ${fullMoveCount(item.moveCount) === 1 ? "move" : "moves"}`,
    outcome: outcomeFor(item.result, playerColor),
    resultLabel: describeResult(item.result),
    reviewLabel: describeReview(item),
    timeControlLabel: describeTimeControl(item.timeControl),
    whiteLabel: item.participants.white.label ?? "White",
  });
}

export function describeResult(result: GameResult): string {
  if (result.status === "abandoned") return "Ended early";
  if (result.status === "draw") return `Draw · ${humanize(result.reason)}`;
  return `${capitalize(result.winner)} won · ${humanize(result.reason)}`;
}

export function describeTimeControl(timeControl: TimeControl): string {
  switch (timeControl.kind) {
    case "untimed":
      return "Untimed";
    case "sudden-death":
      return `${String(Math.round(timeControl.initialMs / 60_000))} min`;
    case "increment":
      return `${String(Math.round(timeControl.initialMs / 60_000))}+${String(Math.round(timeControl.incrementMs / 1_000))}`;
  }
}

function describeReview(item: GameHistoryListItem): string {
  if (item.review.status === "unavailable") return "Review status unknown";
  if (item.review.status === "not-available") return "Not reviewed";
  switch (item.review.reviewStatus) {
    case "completed":
      return "Reviewed";
    case "in-progress":
      return "Review running";
    case "partial":
      return "Partial review";
    case "failed":
      return "Review failed";
    case "not-started":
      return "Not reviewed";
  }
}

function localPlayerColorFromParticipants(
  item: GameHistoryListItem,
): "black" | "white" | undefined {
  const { black, white } = item.participants;
  if (white.kind === "human" && black.kind === "human") return undefined;
  return white.kind === "human" ? "white" : "black";
}

function outcomeFor(
  result: GameResult,
  playerColor: "black" | "white" | undefined,
): HistoryRowModel["outcome"] {
  if (result.status === "abandoned") return "unfinished";
  if (result.status === "draw") return "draw";
  if (playerColor === undefined) return "unfinished";
  return result.winner === playerColor ? "win" : "loss";
}

function fullMoveCount(plies: number): number {
  return Math.ceil(plies / 2);
}

function humanize(value: string): string {
  return value.replaceAll("-", " ");
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
