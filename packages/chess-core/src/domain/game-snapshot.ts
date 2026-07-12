import type { ClockState, TimeControl, TimedTimeControl } from "./clock";
import type { GameLifecycleState } from "./game-lifecycle";
import type {
  GameConfiguration,
  GameParticipant,
  GameSession,
  InitialPosition,
  MoveRecord,
  OpponentRequestState,
  PositionSnapshot,
} from "./game-session";

export function freezeGameSessionSnapshot(session: GameSession): GameSession {
  return Object.freeze({
    ...session,
    activeOpponentRequest: session.activeOpponentRequest
      ? freezeOpponentRequestSnapshot(session.activeOpponentRequest)
      : undefined,
    clock: freezeClockStateSnapshot(session.clock),
    configuration: freezeGameConfigurationSnapshot(session.configuration),
    history: Object.freeze(session.history.map(freezeMoveRecordSnapshot)),
    lifecycle: freezeLifecycleStateSnapshot(session.lifecycle),
    position: freezePositionSnapshot(session.position),
    result: session.result ? Object.freeze({ ...session.result }) : undefined,
  });
}

export function freezeGameConfigurationSnapshot(
  configuration: GameConfiguration,
): GameConfiguration {
  return Object.freeze({
    ...configuration,
    initialPosition: freezeInitialPosition(configuration.initialPosition),
    participants: Object.freeze({
      black: freezeParticipant(configuration.participants.black),
      white: freezeParticipant(configuration.participants.white),
    }),
    timeControl: freezeTimeControl(configuration.timeControl),
  });
}

export function freezeClockStateSnapshot(state: ClockState): ClockState {
  if (state.status === "untimed") {
    return Object.freeze({
      ...state,
      timeControl: Object.freeze({ kind: "untimed" as const }),
    });
  }

  return Object.freeze({
    ...state,
    remaining: Object.freeze({ ...state.remaining }),
    timeControl: freezeTimedTimeControl(state.timeControl),
  });
}

export function freezeLifecycleStateSnapshot(state: GameLifecycleState): GameLifecycleState {
  if (state.phase === "failed" || state.phase === "recovery") {
    return Object.freeze({ ...state, failure: Object.freeze({ ...state.failure }) });
  }
  return Object.freeze({ ...state });
}

export function freezePositionSnapshot(position: PositionSnapshot): PositionSnapshot {
  return Object.freeze({
    ...position,
    terminalState: Object.freeze({ ...position.terminalState }),
  });
}

export function freezeMoveRecordSnapshot(record: MoveRecord): MoveRecord {
  return Object.freeze({
    ...record,
    clockAfter: freezeClockStateSnapshot(record.clockAfter),
    clockBefore: freezeClockStateSnapshot(record.clockBefore),
  });
}

export function freezeOpponentRequestSnapshot(request: OpponentRequestState): OpponentRequestState {
  return Object.freeze({ ...request });
}

function freezeParticipant(participant: GameParticipant): GameParticipant {
  return Object.freeze({ ...participant });
}

function freezeInitialPosition(initialPosition: InitialPosition): InitialPosition {
  return initialPosition.kind === "standard"
    ? Object.freeze({ kind: "standard" as const })
    : Object.freeze({ fen: initialPosition.fen, kind: "fen" as const });
}

function freezeTimeControl(timeControl: TimeControl): TimeControl {
  switch (timeControl.kind) {
    case "untimed":
      return Object.freeze({ kind: "untimed" });
    case "sudden-death":
      return Object.freeze({ initialMs: timeControl.initialMs, kind: "sudden-death" });
    case "increment":
      return Object.freeze({
        incrementMs: timeControl.incrementMs,
        initialMs: timeControl.initialMs,
        kind: "increment",
      });
  }
}

function freezeTimedTimeControl(timeControl: TimedTimeControl): TimedTimeControl {
  return timeControl.kind === "increment"
    ? Object.freeze({
        incrementMs: timeControl.incrementMs,
        initialMs: timeControl.initialMs,
        kind: "increment" as const,
      })
    : Object.freeze({
        initialMs: timeControl.initialMs,
        kind: "sudden-death" as const,
      });
}
