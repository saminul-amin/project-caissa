import { clockFixtures } from "@caissa/test-fixtures/clocks";
import { describe, expect, it } from "vitest";

import {
  commitClockMove,
  createClock,
  pauseClock,
  projectClockDisplay,
  rebaseActiveClock,
  resumeClock,
  snapshotClock,
  startClock,
  stopClock,
  type ClockState,
  type ClockTransitionResult,
  type TimeControl,
} from "./clock";
import {
  parseClockDurationMs,
  parseClockIncrementMs,
  parseMonotonicTimestampMs,
} from "./clock-primitives";
import type { Color } from "./primitives";

const fiveMinuteSuddenDeath: TimeControl = {
  initialMs: parseClockDurationMs(clockFixtures.fiveMinuteSuddenDeath.timeControl.initialMs),
  kind: "sudden-death",
};

const threeMinuteIncrement: TimeControl = {
  incrementMs: parseClockIncrementMs(
    clockFixtures.threeMinuteTwoSecondIncrement.timeControl.incrementMs,
  ),
  initialMs: parseClockDurationMs(
    clockFixtures.threeMinuteTwoSecondIncrement.timeControl.initialMs,
  ),
  kind: "increment",
};

describe("deterministic clock creation", () => {
  it("creates an explicitly untimed clock", () => {
    expect(createClock({ kind: "untimed" })).toEqual({
      lastTimestampMs: undefined,
      status: "untimed",
      timeControl: { kind: "untimed" },
    });
  });

  it("creates a five-minute sudden-death clock with equal balances", () => {
    const state = createClock(fiveMinuteSuddenDeath);

    expect(state).toMatchObject({
      lastTimestampMs: undefined,
      remaining: { black: 300_000, white: 300_000 },
      status: "idle",
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
  });

  it("creates a three-minute clock with a two-second increment", () => {
    const state = createClock(threeMinuteIncrement);

    expect(state).toMatchObject({
      remaining: { black: 180_000, white: 180_000 },
      status: "idle",
      timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
    });
  });
});

describe("deterministic clock start and snapshot", () => {
  it.each(["white", "black"] as const)("starts %s without deducting initial time", (color) => {
    const state = createClock(fiveMinuteSuddenDeath);
    const result = startClock(state, color, timestamp(1_000));

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.state).toMatchObject({
        activeColor: color,
        lastTimestampMs: 1_000,
        remaining: { black: 300_000, white: 300_000 },
        status: "running",
      });
      expect(result.state).not.toBe(state);
    }
  });

  it("deducts the exact elapsed time from the active side", () => {
    const running = runningClock("white", 1_000);
    const result = snapshotClock(running, timestamp(4_000));

    expectAppliedRemaining(result, { black: 300_000, white: 297_000 });
  });

  it("deducts a complete delayed interval rather than one callback-sized tick", () => {
    const running = runningClock("black", 5_000);
    const result = snapshotClock(running, timestamp(125_000));

    expectAppliedRemaining(result, { black: 180_000, white: 300_000 });
  });

  it("does not mutate the running state while taking a snapshot", () => {
    const running = runningClock("white", 1_000);
    const before = structuredClone(running);

    const result = snapshotClock(running, timestamp(2_000));

    expect(result.status).toBe("applied");
    expect(running).toEqual(before);
    if (result.status === "applied") {
      expect(result.state).not.toBe(running);
    }
  });

  it("rejects a timestamp regression and returns the exact prior state", () => {
    const running = runningClock("white", 2_000);

    const result = snapshotClock(running, timestamp(1_999));

    expect(result).toEqual({
      reason: "timestamp-regression",
      state: running,
      status: "rejected",
    });
    expect(result.state).toBe(running);
  });

  it("records accepted idle snapshots for subsequent regression checks", () => {
    const idle = createClock(fiveMinuteSuddenDeath);
    const snapshot = snapshotClock(idle, timestamp(2_000));

    expect(snapshot.status).toBe("applied");
    if (snapshot.status === "applied") {
      expect(snapshot.state.lastTimestampMs).toBe(2_000);
      expect(startClock(snapshot.state, "white", timestamp(1_999))).toMatchObject({
        reason: "timestamp-regression",
        status: "rejected",
      });
    }
  });

  it("rejects a repeated timed start without charging elapsed time", () => {
    const running = runningClock("white", 1_000);

    const result = startClock(running, "black", timestamp(2_000));

    expectRejected(result, running, "already-running");
    expect(running.remaining.white).toBe(300_000);
  });
});

describe("deterministic clock move commit", () => {
  it("charges the active mover and switches to the opposite color", () => {
    const running = runningClock("white", 1_000);
    const result = commitClockMove(running, "white", timestamp(6_000));

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.state).toMatchObject({
        activeColor: "black",
        lastTimestampMs: 6_000,
        remaining: { black: 300_000, white: 295_000 },
        status: "running",
      });
    }
  });

  it("charges Black and switches the active clock to White", () => {
    const running = runningClock("black", 1_000);
    const result = commitClockMove(running, "black", timestamp(4_000));

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.state).toMatchObject({
        activeColor: "white",
        remaining: { black: 297_000, white: 300_000 },
      });
    }
  });

  it("rejects a move by the wrong side without charging either clock", () => {
    const running = runningClock("white", 1_000);

    const result = commitClockMove(running, "black", timestamp(10_000));

    expectRejected(result, running, "wrong-active-color");
    expect(running.remaining).toEqual({ black: 300_000, white: 300_000 });
  });

  it("rejects a move commit when its timestamp regresses", () => {
    const running = runningClock("white", 2_000);

    expectRejected(
      commitClockMove(running, "white", timestamp(1_999)),
      running,
      "timestamp-regression",
    );
  });

  it("adds increment only after charging a successful mover", () => {
    const running = runningClock("white", 1_000, threeMinuteIncrement);
    const result = commitClockMove(running, "white", timestamp(4_000));

    expectAppliedRemaining(result, { black: 180_000, white: 179_000 });
  });

  it("does not add time in sudden-death mode", () => {
    const running = runningClock("white", 1_000);
    const result = commitClockMove(running, "white", timestamp(4_000));

    expectAppliedRemaining(result, { black: 300_000, white: 297_000 });
  });

  it("expires the mover at the exact expiration boundary", () => {
    const running = runningClock("white", 1_000, incrementControl(1_000, 2_000));
    const result = commitClockMove(running, "white", timestamp(2_000));

    expectExpired(result, "white", { black: 1_000, white: 0 });
  });

  it("clamps past-boundary expiration to zero", () => {
    const running = runningClock("black", 2_000, suddenDeathControl(1_000));
    const result = commitClockMove(running, "black", timestamp(3_500));

    expectExpired(result, "black", { black: 0, white: 1_000 });
  });

  it("does not add increment or switch active color after expiration", () => {
    const running = runningClock("white", 10_000, incrementControl(1_000, 50_000));
    const result = commitClockMove(running, "white", timestamp(11_000));

    expect(result.status).toBe("expired");
    if (result.status === "expired") {
      expect(result.state.remaining.white).toBe(0);
      expect(result.state.expiredColor).toBe("white");
      expect("activeColor" in result.state).toBe(false);
    }
  });

  it("rejects increment overflow without changing the prior state", () => {
    const control = incrementControl(Number.MAX_SAFE_INTEGER, 1);
    const running = runningClock("white", 1_000, control);

    const result = commitClockMove(running, "white", timestamp(1_000));

    expectRejected(result, running, "duration-overflow");
  });

  it.each([
    ["idle", () => createClock(fiveMinuteSuddenDeath), "not-running"],
    ["paused", () => pausedClock("white", 1_000, 2_000), "not-running"],
    ["stopped", () => stoppedClock(), "already-stopped"],
    ["expired", () => expiredClock("white"), "already-expired"],
  ] as const)("rejects move commit from a %s clock", (_label, createState, reason) => {
    const state = createState();
    expectRejected(commitClockMove(state, "white", timestamp(20_000)), state, reason);
  });
});

describe("deterministic clock pause, resume, and stop", () => {
  it("charges elapsed time when pausing and records the resume color", () => {
    const running = runningClock("white", 1_000);
    const result = pauseClock(running, timestamp(3_500));

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.state).toMatchObject({
        lastTimestampMs: 3_500,
        remaining: { black: 300_000, white: 297_500 },
        resumeColor: "white",
        status: "paused",
      });
    }
  });

  it("does not charge paused duration during snapshots or resume", () => {
    const paused = pausedClock("black", 2_000, 5_000);
    const snapshot = snapshotClock(paused, timestamp(50_000));

    expectAppliedRemaining(snapshot, { black: 297_000, white: 300_000 });
    if (snapshot.status === "applied") {
      const resumed = resumeClock(snapshot.state, timestamp(80_000));
      expectAppliedRemaining(resumed, { black: 297_000, white: 300_000 });
    }
  });

  it.each(["white", "black"] as const)("resumes the previously active %s clock", (color) => {
    const paused = pausedClock(color, 1_000, 2_000);
    const result = resumeClock(paused, timestamp(100_000));

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.state).toMatchObject({ activeColor: color, status: "running" });
    }
  });

  it("rejects resume outside a paused state", () => {
    const running = runningClock("white", 1_000);
    expectRejected(resumeClock(running, timestamp(2_000)), running, "not-paused");
  });

  it.each([
    ["pause", pauseClock, () => runningClock("white", 2_000)],
    ["resume", resumeClock, () => pausedClock("white", 1_000, 2_000)],
    ["stop", stopClock, () => runningClock("white", 2_000)],
  ] as const)("rejects timestamp regression during %s", (_label, transition, createState) => {
    const state = createState();
    expectRejected(transition(state, timestamp(1_999)), state, "timestamp-regression");
  });

  it("expires instead of pausing at the exact boundary", () => {
    const running = runningClock("white", 1_000, suddenDeathControl(1_000));

    expectExpired(pauseClock(running, timestamp(2_000)), "white", {
      black: 1_000,
      white: 0,
    });
  });

  it("charges elapsed time when stopping a running clock", () => {
    const running = runningClock("white", 1_000);
    const result = stopClock(running, timestamp(5_000));

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.state).toMatchObject({
        remaining: { black: 300_000, white: 296_000 },
        status: "stopped",
      });
    }
  });

  it("stops a paused clock without charging paused duration", () => {
    const paused = pausedClock("black", 1_000, 4_000);
    const result = stopClock(paused, timestamp(100_000));

    expectAppliedRemaining(result, { black: 297_000, white: 300_000 });
    if (result.status === "applied") {
      expect(result.state.status).toBe("stopped");
    }
  });

  it("keeps stopped balances stable across later snapshots", () => {
    const stopped = stoppedClock();
    const result = snapshotClock(stopped, timestamp(1_000_000));

    expectAppliedRemaining(result, { black: 300_000, white: 296_000 });
    if (result.status === "applied") {
      expect(result.state.status).toBe("stopped");
    }
  });

  it("keeps an expired snapshot expired while advancing its accepted timestamp", () => {
    const state = expiredClock("black");
    const result = snapshotClock(state, timestamp(20_000));

    expect(result.status).toBe("expired");
    if (result.status === "expired") {
      expect(result.expiredColor).toBe("black");
      expect(result.state.lastTimestampMs).toBe(20_000);
      expect(result.state.remaining.black).toBe(0);
      expect(result.state).not.toBe(state);
    }
  });

  it("rejects repeated stop and returns the exact stopped state", () => {
    const stopped = stoppedClock();

    expectRejected(stopClock(stopped, timestamp(10_000)), stopped, "already-stopped");
  });

  it("detects expiration while stopping", () => {
    const running = runningClock("black", 1_000, suddenDeathControl(1_000));

    expectExpired(stopClock(running, timestamp(2_000)), "black", {
      black: 0,
      white: 1_000,
    });
  });

  it.each([
    ["idle pause", pauseClock, () => createClock(fiveMinuteSuddenDeath), "not-running"],
    ["repeated pause", pauseClock, () => pausedClock("white", 1_000, 2_000), "invalid-state"],
    ["paused start", startClockForWhite, () => pausedClock("white", 1_000, 2_000), "invalid-state"],
    ["stopped start", startClockForWhite, stoppedClock, "already-stopped"],
    ["expired start", startClockForWhite, () => expiredClock("black"), "already-expired"],
    ["idle stop", stopClock, () => createClock(fiveMinuteSuddenDeath), "not-running"],
    ["stopped resume", resumeClock, stoppedClock, "already-stopped"],
    ["expired resume", resumeClock, () => expiredClock("white"), "already-expired"],
    ["expired pause", pauseClock, () => expiredClock("white"), "already-expired"],
    ["stopped pause", pauseClock, stoppedClock, "already-stopped"],
    ["expired stop", stopClock, () => expiredClock("white"), "already-expired"],
  ] as const)("rejects %s safely", (_label, transition, createState, reason) => {
    const state = createState();
    expectRejected(transition(state, timestamp(20_000)), state, reason);
  });
});

describe("historical active-clock rebasing", () => {
  it("preserves timed balances and active color while replacing the monotonic origin", () => {
    const running = runningClock("white", 900);
    const snapshot = snapshotClock(running, timestamp(1_000));
    if (snapshot.status !== "applied") {
      throw new Error("Expected a settled running clock fixture.");
    }
    const settled = snapshot.state;

    const result = rebaseActiveClock(settled, "white", timestamp(25));

    expect(result).toEqual({
      state: {
        activeColor: "white",
        lastTimestampMs: 25,
        remaining: { black: 300_000, white: 299_900 },
        status: "running",
        timeControl: fiveMinuteSuddenDeath,
      },
      status: "applied",
    });
    expect(settled).toMatchObject({ lastTimestampMs: 1_000 });
  });

  it("rebases untimed state without inventing balances", () => {
    expect(rebaseActiveClock(createClock({ kind: "untimed" }), "black", timestamp(50))).toEqual({
      state: { lastTimestampMs: 50, status: "untimed", timeControl: { kind: "untimed" } },
      status: "applied",
    });
  });

  it("rejects inactive and contradictory historical states without mutation", () => {
    const idle = createClock(fiveMinuteSuddenDeath);
    expect(rebaseActiveClock(idle, "white", timestamp(0))).toEqual({
      reason: "invalid-state",
      state: idle,
      status: "rejected",
    });

    const running = runningClock("white", 0);
    expect(rebaseActiveClock(running, "black", timestamp(1))).toEqual({
      reason: "wrong-active-color",
      state: running,
      status: "rejected",
    });
  });
});

describe("untimed clock behavior", () => {
  it("accepts every lifecycle operation as an immutable untimed transition", () => {
    let state = createClock({ kind: "untimed" });
    const transitions = [
      (current: ClockState) => startClock(current, "white", timestamp(1_000)),
      (current: ClockState) => snapshotClock(current, timestamp(2_000)),
      (current: ClockState) => commitClockMove(current, "black", timestamp(3_000)),
      (current: ClockState) => pauseClock(current, timestamp(4_000)),
      (current: ClockState) => resumeClock(current, timestamp(5_000)),
      (current: ClockState) => stopClock(current, timestamp(6_000)),
    ];

    for (const transition of transitions) {
      const before = state;
      const result = transition(state);
      expect(result.status).toBe("applied");
      if (result.status === "applied") {
        expect(result.state.status).toBe("untimed");
        expect(result.state).not.toBe(before);
        state = result.state;
      }
    }
  });

  it("never expires even after an extremely delayed snapshot", () => {
    const state = createClock({ kind: "untimed" });
    const result = snapshotClock(state, timestamp(Number.MAX_SAFE_INTEGER));

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.state.status).toBe("untimed");
    }
  });

  it("still rejects time moving backward after an accepted untimed operation", () => {
    const started = startClock(createClock({ kind: "untimed" }), "white", timestamp(10));
    expect(started.status).toBe("applied");
    if (started.status === "applied") {
      expectRejected(
        snapshotClock(started.state, timestamp(9)),
        started.state,
        "timestamp-regression",
      );
    }
  });
});

describe("clock display projection", () => {
  it("projects untimed mode without inventing time balances", () => {
    const result = projectClockDisplay(createClock({ kind: "untimed" }), timestamp(1_000));

    expect(result).toEqual({
      display: {
        activeColor: undefined,
        blackRemainingMs: undefined,
        expiredColor: undefined,
        status: "untimed",
        whiteRemainingMs: undefined,
      },
      status: "projected",
    });
  });

  it("projects effective running balances without advancing the input state", () => {
    const running = runningClock("white", 1_000);
    const result = projectClockDisplay(running, timestamp(6_000));

    expect(result).toMatchObject({
      display: {
        activeColor: "white",
        blackRemainingMs: 300_000,
        expiredColor: undefined,
        status: "running",
        whiteRemainingMs: 295_000,
      },
      status: "projected",
    });
    expect(running.remaining.white).toBe(300_000);
  });

  it("projects expiration at the exact boundary with a zero balance", () => {
    const running = runningClock("black", 1_000, suddenDeathControl(1_000));
    const result = projectClockDisplay(running, timestamp(2_000));

    expect(result).toMatchObject({
      display: {
        activeColor: undefined,
        blackRemainingMs: 0,
        expiredColor: "black",
        status: "expired",
        whiteRemainingMs: 1_000,
      },
      status: "projected",
    });
  });

  it.each([
    ["idle", () => createClock(fiveMinuteSuddenDeath), "idle", undefined],
    ["paused", () => pausedClock("white", 1_000, 2_000), "paused", undefined],
    ["stopped", stoppedClock, "stopped", undefined],
    ["expired", () => expiredClock("white"), "expired", "white"],
  ] as const)("projects a %s timed clock", (_label, createState, status, expiredColor) => {
    const result = projectClockDisplay(createState(), timestamp(20_000));

    expect(result).toMatchObject({
      display: { activeColor: undefined, expiredColor, status },
      status: "projected",
    });
  });

  it("rejects display projection for a regressing timestamp", () => {
    const running = runningClock("white", 2_000);

    const result = projectClockDisplay(running, timestamp(1_999));

    expect(result).toEqual({
      reason: "timestamp-regression",
      state: running,
      status: "rejected",
    });
  });
});

function timestamp(value: number) {
  return parseMonotonicTimestampMs(value);
}

function suddenDeathControl(initialMs: number): TimeControl {
  return { initialMs: parseClockDurationMs(initialMs), kind: "sudden-death" };
}

function incrementControl(initialMs: number, incrementMs: number): TimeControl {
  return {
    incrementMs: parseClockIncrementMs(incrementMs),
    initialMs: parseClockDurationMs(initialMs),
    kind: "increment",
  };
}

function runningClock(
  color: Color,
  startAtMs: number,
  timeControl: TimeControl = fiveMinuteSuddenDeath,
): Extract<ClockState, { readonly status: "running" }> {
  const result = startClock(createClock(timeControl), color, timestamp(startAtMs));
  if (result.status !== "applied" || result.state.status !== "running") {
    throw new Error("Expected a running clock fixture.");
  }
  return result.state;
}

function pausedClock(
  color: Color,
  startAtMs: number,
  pauseAtMs: number,
): Extract<ClockState, { readonly status: "paused" }> {
  const result = pauseClock(runningClock(color, startAtMs), timestamp(pauseAtMs));
  if (result.status !== "applied" || result.state.status !== "paused") {
    throw new Error("Expected a paused clock fixture.");
  }
  return result.state;
}

function stoppedClock(): Extract<ClockState, { readonly status: "stopped" }> {
  const result = stopClock(runningClock("white", 1_000), timestamp(5_000));
  if (result.status !== "applied" || result.state.status !== "stopped") {
    throw new Error("Expected a stopped clock fixture.");
  }
  return result.state;
}

function expiredClock(color: Color): Extract<ClockState, { readonly status: "expired" }> {
  const result = snapshotClock(
    runningClock(color, 1_000, suddenDeathControl(1_000)),
    timestamp(2_000),
  );
  if (result.status !== "expired") {
    throw new Error("Expected an expired clock fixture.");
  }
  return result.state;
}

function startClockForWhite(state: ClockState, now: ReturnType<typeof timestamp>) {
  return startClock(state, "white", now);
}

function expectAppliedRemaining(
  result: ClockTransitionResult,
  expected: { readonly black: number; readonly white: number },
): void {
  expect(result.status).toBe("applied");
  if (result.status === "applied" && result.state.status !== "untimed") {
    expect(result.state.remaining).toEqual(expected);
  }
}

function expectExpired(
  result: ClockTransitionResult,
  color: Color,
  expected: { readonly black: number; readonly white: number },
): void {
  expect(result.status).toBe("expired");
  if (result.status === "expired") {
    expect(result.expiredColor).toBe(color);
    expect(result.state.remaining).toEqual(expected);
  }
}

function expectRejected(
  result: ClockTransitionResult,
  state: ClockState,
  reason: Extract<ClockTransitionResult, { readonly status: "rejected" }>["reason"],
): void {
  expect(result).toEqual({ reason, state, status: "rejected" });
  expect(result.state).toBe(state);
}
