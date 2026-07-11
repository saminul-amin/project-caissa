import {
  parseClockDurationMs,
  type ClockDurationMs,
  type ClockIncrementMs,
  type MonotonicTimestampMs,
} from "./clock-primitives";
import type { Color } from "./primitives";

export type TimeControl =
  | {
      readonly kind: "untimed";
    }
  | {
      readonly initialMs: ClockDurationMs;
      readonly kind: "sudden-death";
    }
  | {
      readonly incrementMs: ClockIncrementMs;
      readonly initialMs: ClockDurationMs;
      readonly kind: "increment";
    };

export type TimedTimeControl = Exclude<TimeControl, { readonly kind: "untimed" }>;

export interface ClockRemaining {
  readonly black: ClockDurationMs;
  readonly white: ClockDurationMs;
}

interface UntimedClockState {
  readonly lastTimestampMs: MonotonicTimestampMs | undefined;
  readonly status: "untimed";
  readonly timeControl: Extract<TimeControl, { readonly kind: "untimed" }>;
}

interface TimedClockStateBase {
  readonly lastTimestampMs: MonotonicTimestampMs | undefined;
  readonly remaining: ClockRemaining;
  readonly timeControl: TimedTimeControl;
}

interface IdleClockState extends TimedClockStateBase {
  readonly status: "idle";
}

interface RunningClockState extends TimedClockStateBase {
  readonly activeColor: Color;
  readonly lastTimestampMs: MonotonicTimestampMs;
  readonly status: "running";
}

interface PausedClockState extends TimedClockStateBase {
  readonly lastTimestampMs: MonotonicTimestampMs;
  readonly resumeColor: Color;
  readonly status: "paused";
}

interface StoppedClockState extends TimedClockStateBase {
  readonly lastTimestampMs: MonotonicTimestampMs;
  readonly status: "stopped";
}

interface ExpiredClockState extends TimedClockStateBase {
  readonly expiredColor: Color;
  readonly lastTimestampMs: MonotonicTimestampMs;
  readonly status: "expired";
}

export type TimedClockState =
  ExpiredClockState | IdleClockState | PausedClockState | RunningClockState | StoppedClockState;

export type ClockState = TimedClockState | UntimedClockState;

export type ClockTransitionRejectionReason =
  | "already-expired"
  | "already-running"
  | "already-stopped"
  | "duration-overflow"
  | "invalid-state"
  | "not-paused"
  | "not-running"
  | "timestamp-regression"
  | "wrong-active-color";

export type ClockTransitionResult =
  | {
      readonly state: ClockState;
      readonly status: "applied";
    }
  | {
      readonly expiredColor: Color;
      readonly state: ExpiredClockState;
      readonly status: "expired";
    }
  | {
      readonly reason: ClockTransitionRejectionReason;
      readonly state: ClockState;
      readonly status: "rejected";
    };

export type ClockSnapshotResult = ClockTransitionResult;
export type ClockMoveCommitResult = ClockTransitionResult;

export interface ClockDisplay {
  readonly activeColor: Color | undefined;
  readonly blackRemainingMs: ClockDurationMs | undefined;
  readonly expiredColor: Color | undefined;
  readonly status: ClockState["status"];
  readonly whiteRemainingMs: ClockDurationMs | undefined;
}

export type ClockDisplayProjectionResult =
  | {
      readonly display: ClockDisplay;
      readonly status: "projected";
    }
  | {
      readonly reason: "timestamp-regression";
      readonly state: ClockState;
      readonly status: "rejected";
    };

type RunningClockSettlement =
  | {
      readonly state: RunningClockState;
      readonly status: "applied";
    }
  | {
      readonly expiredColor: Color;
      readonly state: ExpiredClockState;
      readonly status: "expired";
    };

/** Creates a deterministic clock without consulting any ambient time source. */
export function createClock(timeControl: TimeControl): ClockState {
  if (timeControl.kind === "untimed") {
    return {
      lastTimestampMs: undefined,
      status: "untimed",
      timeControl: { kind: "untimed" },
    };
  }

  const copiedTimeControl = cloneTimedTimeControl(timeControl);
  return {
    lastTimestampMs: undefined,
    remaining: {
      black: copiedTimeControl.initialMs,
      white: copiedTimeControl.initialMs,
    },
    status: "idle",
    timeControl: copiedTimeControl,
  };
}

export function startClock(
  state: ClockState,
  activeColor: Color,
  now: MonotonicTimestampMs,
): ClockTransitionResult {
  const regression = rejectTimestampRegression(state, now);
  if (regression) {
    return regression;
  }

  if (state.status === "untimed") {
    return applied(copyUntimedAt(state, now));
  }

  switch (state.status) {
    case "idle":
      return applied({
        activeColor,
        lastTimestampMs: now,
        remaining: copyRemaining(state.remaining),
        status: "running",
        timeControl: state.timeControl,
      });
    case "running":
      return rejected(state, "already-running");
    case "paused":
      return rejected(state, "invalid-state");
    case "stopped":
      return rejected(state, "already-stopped");
    case "expired":
      return rejected(state, "already-expired");
  }
}

export function snapshotClock(state: ClockState, now: MonotonicTimestampMs): ClockSnapshotResult {
  const regression = rejectTimestampRegression(state, now);
  if (regression) {
    return regression;
  }

  switch (state.status) {
    case "untimed":
      return applied(copyUntimedAt(state, now));
    case "idle":
      return applied({ ...state, lastTimestampMs: now, remaining: copyRemaining(state.remaining) });
    case "running":
      return settleRunningClock(state, now);
    case "paused":
      return applied({ ...state, lastTimestampMs: now, remaining: copyRemaining(state.remaining) });
    case "stopped":
      return applied({ ...state, lastTimestampMs: now, remaining: copyRemaining(state.remaining) });
    case "expired": {
      const expiredState: ExpiredClockState = {
        ...state,
        lastTimestampMs: now,
        remaining: copyRemaining(state.remaining),
      };
      return expired(expiredState);
    }
  }
}

export function commitClockMove(
  state: ClockState,
  mover: Color,
  now: MonotonicTimestampMs,
): ClockMoveCommitResult {
  const regression = rejectTimestampRegression(state, now);
  if (regression) {
    return regression;
  }

  if (state.status === "untimed") {
    return applied(copyUntimedAt(state, now));
  }

  if (state.status !== "running") {
    return rejectNonrunningTransition(state);
  }

  if (state.activeColor !== mover) {
    return rejected(state, "wrong-active-color");
  }

  const settled = settleRunningClock(state, now);
  if (settled.status === "expired") {
    return settled;
  }

  const incrementMs = state.timeControl.kind === "increment" ? state.timeControl.incrementMs : 0;
  const remainingAfterCharge = settled.state.remaining[mover];
  const remainingAfterIncrement = remainingAfterCharge + incrementMs;

  if (!Number.isSafeInteger(remainingAfterIncrement)) {
    return rejected(state, "duration-overflow");
  }

  return applied({
    activeColor: oppositeColor(mover),
    lastTimestampMs: now,
    remaining: replaceRemaining(
      settled.state.remaining,
      mover,
      parseClockDurationMs(remainingAfterIncrement),
    ),
    status: "running",
    timeControl: state.timeControl,
  });
}

export function pauseClock(state: ClockState, now: MonotonicTimestampMs): ClockTransitionResult {
  const regression = rejectTimestampRegression(state, now);
  if (regression) {
    return regression;
  }

  if (state.status === "untimed") {
    return applied(copyUntimedAt(state, now));
  }

  if (state.status !== "running") {
    if (state.status === "stopped") {
      return rejected(state, "already-stopped");
    }
    if (state.status === "expired") {
      return rejected(state, "already-expired");
    }
    return rejected(state, state.status === "idle" ? "not-running" : "invalid-state");
  }

  const settled = settleRunningClock(state, now);
  if (settled.status === "expired") {
    return settled;
  }

  return applied({
    lastTimestampMs: now,
    remaining: copyRemaining(settled.state.remaining),
    resumeColor: state.activeColor,
    status: "paused",
    timeControl: state.timeControl,
  });
}

export function resumeClock(state: ClockState, now: MonotonicTimestampMs): ClockTransitionResult {
  const regression = rejectTimestampRegression(state, now);
  if (regression) {
    return regression;
  }

  if (state.status === "untimed") {
    return applied(copyUntimedAt(state, now));
  }

  if (state.status !== "paused") {
    if (state.status === "stopped") {
      return rejected(state, "already-stopped");
    }
    if (state.status === "expired") {
      return rejected(state, "already-expired");
    }
    return rejected(state, "not-paused");
  }

  return applied({
    activeColor: state.resumeColor,
    lastTimestampMs: now,
    remaining: copyRemaining(state.remaining),
    status: "running",
    timeControl: state.timeControl,
  });
}

export function stopClock(state: ClockState, now: MonotonicTimestampMs): ClockTransitionResult {
  const regression = rejectTimestampRegression(state, now);
  if (regression) {
    return regression;
  }

  if (state.status === "untimed") {
    return applied(copyUntimedAt(state, now));
  }

  if (state.status === "running") {
    const settled = settleRunningClock(state, now);
    if (settled.status === "expired") {
      return settled;
    }

    return applied({
      lastTimestampMs: now,
      remaining: copyRemaining(settled.state.remaining),
      status: "stopped",
      timeControl: state.timeControl,
    });
  }

  switch (state.status) {
    case "paused":
      return applied({
        lastTimestampMs: now,
        remaining: copyRemaining(state.remaining),
        status: "stopped",
        timeControl: state.timeControl,
      });
    case "idle":
      return rejected(state, "not-running");
    case "stopped":
      return rejected(state, "already-stopped");
    case "expired":
      return rejected(state, "already-expired");
  }
}

/** Projects effective clock values without mutating or advancing the supplied state. */
export function projectClockDisplay(
  state: ClockState,
  now: MonotonicTimestampMs,
): ClockDisplayProjectionResult {
  if (isTimestampRegression(state, now)) {
    return { reason: "timestamp-regression", state, status: "rejected" };
  }

  if (state.status === "untimed") {
    return {
      display: {
        activeColor: undefined,
        blackRemainingMs: undefined,
        expiredColor: undefined,
        status: "untimed",
        whiteRemainingMs: undefined,
      },
      status: "projected",
    };
  }

  if (state.status === "running") {
    const elapsedMs = now - state.lastTimestampMs;
    const activeRemainingMs = state.remaining[state.activeColor];

    if (elapsedMs >= activeRemainingMs) {
      const remaining = replaceRemaining(
        state.remaining,
        state.activeColor,
        parseClockDurationMs(0),
      );
      return projectedTimedDisplay("expired", remaining, undefined, state.activeColor);
    }

    const remaining = replaceRemaining(
      state.remaining,
      state.activeColor,
      parseClockDurationMs(activeRemainingMs - elapsedMs),
    );
    return projectedTimedDisplay("running", remaining, state.activeColor, undefined);
  }

  return projectedTimedDisplay(
    state.status,
    state.remaining,
    undefined,
    state.status === "expired" ? state.expiredColor : undefined,
  );
}

function settleRunningClock(
  state: RunningClockState,
  now: MonotonicTimestampMs,
): RunningClockSettlement {
  const elapsedMs = now - state.lastTimestampMs;
  const activeRemainingMs = state.remaining[state.activeColor];

  if (elapsedMs >= activeRemainingMs) {
    const expiredState: ExpiredClockState = {
      expiredColor: state.activeColor,
      lastTimestampMs: now,
      remaining: replaceRemaining(state.remaining, state.activeColor, parseClockDurationMs(0)),
      status: "expired",
      timeControl: state.timeControl,
    };
    return { expiredColor: expiredState.expiredColor, state: expiredState, status: "expired" };
  }

  return {
    state: {
      ...state,
      lastTimestampMs: now,
      remaining: replaceRemaining(
        state.remaining,
        state.activeColor,
        parseClockDurationMs(activeRemainingMs - elapsedMs),
      ),
    },
    status: "applied",
  };
}

function rejectTimestampRegression(
  state: ClockState,
  now: MonotonicTimestampMs,
): Extract<ClockTransitionResult, { readonly status: "rejected" }> | undefined {
  return isTimestampRegression(state, now)
    ? { reason: "timestamp-regression", state, status: "rejected" }
    : undefined;
}

function isTimestampRegression(state: ClockState, now: MonotonicTimestampMs): boolean {
  return state.lastTimestampMs !== undefined && now < state.lastTimestampMs;
}

function rejectNonrunningTransition(state: TimedClockState): ClockTransitionResult {
  if (state.status === "stopped") {
    return rejected(state, "already-stopped");
  }
  if (state.status === "expired") {
    return rejected(state, "already-expired");
  }
  return rejected(state, "not-running");
}

function applied(state: ClockState): ClockTransitionResult {
  return { state, status: "applied" };
}

function expired(state: ExpiredClockState): ClockTransitionResult {
  return { expiredColor: state.expiredColor, state, status: "expired" };
}

function rejected(
  state: ClockState,
  reason: ClockTransitionRejectionReason,
): ClockTransitionResult {
  return { reason, state, status: "rejected" };
}

function projectedTimedDisplay(
  status: Exclude<ClockState["status"], "untimed">,
  remaining: ClockRemaining,
  activeColor: Color | undefined,
  expiredColor: Color | undefined,
): ClockDisplayProjectionResult {
  return {
    display: {
      activeColor,
      blackRemainingMs: remaining.black,
      expiredColor,
      status,
      whiteRemainingMs: remaining.white,
    },
    status: "projected",
  };
}

function copyUntimedAt(state: UntimedClockState, now: MonotonicTimestampMs): UntimedClockState {
  return { ...state, lastTimestampMs: now, timeControl: { kind: "untimed" } };
}

function cloneTimedTimeControl(timeControl: TimedTimeControl): TimedTimeControl {
  return timeControl.kind === "increment"
    ? {
        incrementMs: timeControl.incrementMs,
        initialMs: timeControl.initialMs,
        kind: "increment",
      }
    : { initialMs: timeControl.initialMs, kind: "sudden-death" };
}

function copyRemaining(remaining: ClockRemaining): ClockRemaining {
  return { black: remaining.black, white: remaining.white };
}

function replaceRemaining(
  remaining: ClockRemaining,
  color: Color,
  value: ClockDurationMs,
): ClockRemaining {
  return color === "white"
    ? { black: remaining.black, white: value }
    : { black: value, white: remaining.white };
}

function oppositeColor(color: Color): Color {
  return color === "white" ? "black" : "white";
}
