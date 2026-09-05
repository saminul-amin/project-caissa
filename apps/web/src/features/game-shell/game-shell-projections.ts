import type {
  ClockDurationMs,
  Color,
  GameParticipant,
  GameResult,
  GameSession,
  MoveRecord,
  TimeControl,
} from "@caissa/chess-core";

export interface PlayerPanelModel {
  readonly color: Color;
  readonly isActive: boolean;
  readonly kindLabel: string;
  readonly label: string;
}

export interface MoveHistoryRow {
  readonly black: MoveRecord | undefined;
  readonly moveNumber: number;
  readonly white: MoveRecord | undefined;
}

export function createPlayerPanelModel(
  color: Color,
  participant: GameParticipant,
  session: GameSession,
): PlayerPanelModel {
  return Object.freeze({
    color,
    isActive: isActiveColor(session, color),
    kindLabel: participant.kind === "human" ? "Human player" : "External opponent",
    label: participant.label ?? capitalize(color),
  });
}

/**
 * How loudly a clock should read. Only a running clock becomes urgent: a paused or
 * expired display must stay calm, and an untimed game has no clock at all.
 */
export type ClockUrgency = "calm" | "critical" | "low";

export const LOW_TIME_THRESHOLD_MS = 30_000;
export const CRITICAL_TIME_THRESHOLD_MS = 10_000;

export function clockUrgency(
  remainingMs: ClockDurationMs | undefined,
  isRunning: boolean,
): ClockUrgency {
  if (remainingMs === undefined || !isRunning) return "calm";
  if (remainingMs <= CRITICAL_TIME_THRESHOLD_MS) return "critical";
  if (remainingMs <= LOW_TIME_THRESHOLD_MS) return "low";
  return "calm";
}

/** The side shown at the top of the board is the one the viewer is looking across at. */
export function boardPlayerOrder(orientation: Color): readonly [top: Color, bottom: Color] {
  return orientation === "white" ? ["black", "white"] : ["white", "black"];
}

export function createMoveHistoryRows(history: readonly MoveRecord[]): readonly MoveHistoryRow[] {
  const rows: MoveHistoryRow[] = [];
  for (let index = 0; index < history.length; index += 2) {
    rows.push(
      Object.freeze({
        black: history[index + 1],
        moveNumber: Math.floor(index / 2) + 1,
        white: history[index],
      }),
    );
  }
  return Object.freeze(rows);
}

export function gameStatusLabel(session: GameSession): string {
  const phase = session.lifecycle.phase;
  switch (phase) {
    case "creating":
      return "Preparing game";
    case "ready":
      return "Ready";
    case "player-turn":
    case "opponent-turn":
    case "committing":
      return `${capitalize(session.position.turn)} to move`;
    case "awaiting-opponent":
      return "Waiting for opponent";
    case "paused":
      return "Paused";
    case "degraded":
      return "Connection or opponent unavailable";
    case "completed":
      return resultLabel(session.result);
    case "abandoned":
      return "Abandoned";
    case "recovery":
      return "Recovery required";
    case "failed":
      return "Recovery required";
  }
}

export function timeControlLabel(timeControl: TimeControl): string {
  switch (timeControl.kind) {
    case "untimed":
      return "Untimed";
    case "sudden-death":
      return `${String(timeControl.initialMs / 60_000)} minutes`;
    case "increment":
      return `${String(timeControl.initialMs / 60_000)} + ${String(timeControl.incrementMs / 1_000)}`;
  }
}

export function resultLabel(result: GameResult | undefined): string {
  if (!result) return "Completed";
  if (result.status === "abandoned") return "Abandoned";
  if (result.status === "draw") return `Draw by ${drawReason(result.reason)}`;
  return `${capitalize(result.winner)} won by ${result.reason}`;
}

function isActiveColor(session: GameSession, color: Color): boolean {
  return (
    session.position.turn === color &&
    (session.lifecycle.phase === "player-turn" ||
      session.lifecycle.phase === "opponent-turn" ||
      session.lifecycle.phase === "committing" ||
      session.lifecycle.phase === "awaiting-opponent")
  );
}

function drawReason(reason: string): string {
  return reason.replaceAll("-", " ");
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
