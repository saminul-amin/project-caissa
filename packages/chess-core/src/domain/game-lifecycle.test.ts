import { gameLifecycleFixtures } from "@caissa/test-fixtures/game-lifecycle";
import { describe, expect, it } from "vitest";

import {
  createGameLifecycleState,
  transitionGameLifecycle,
  type GameLifecycleEvent,
  type GameLifecycleState,
} from "./game-lifecycle";

interface AllowedTransitionCase {
  readonly current: GameLifecycleState;
  readonly event: GameLifecycleEvent;
  readonly expected: GameLifecycleState;
  readonly name: string;
}

interface RejectedTransitionCase {
  readonly current: GameLifecycleState;
  readonly event: GameLifecycleEvent;
  readonly name: string;
}

const unexpectedFailure = { code: "unexpected-failure" } as const;
const failEvent = { type: "fail", failure: unexpectedFailure } as const;

const allowedTransitions = [
  {
    name: "creation succeeds to ready",
    current: gameLifecycleFixtures.creating.state,
    event: { type: "creation-succeeded" },
    expected: gameLifecycleFixtures.ready.state,
  },
  {
    name: "creation failure enters failed",
    current: gameLifecycleFixtures.creating.state,
    event: { type: "creation-failed" },
    expected: { phase: "failed", failure: { code: "creation-failed" } },
  },
  {
    name: "ready begins player turn",
    current: gameLifecycleFixtures.ready.state,
    event: { type: "begin-player-turn" },
    expected: gameLifecycleFixtures.playerTurn.state,
  },
  {
    name: "ready begins opponent turn",
    current: gameLifecycleFixtures.ready.state,
    event: { type: "begin-opponent-turn" },
    expected: gameLifecycleFixtures.opponentTurn.state,
  },
  {
    name: "ready may be abandoned",
    current: gameLifecycleFixtures.ready.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "player turn begins commit",
    current: gameLifecycleFixtures.playerTurn.state,
    event: { type: "begin-commit" },
    expected: { phase: "committing" },
  },
  {
    name: "player turn pauses with its resume phase",
    current: gameLifecycleFixtures.playerTurn.state,
    event: { type: "pause" },
    expected: gameLifecycleFixtures.paused.state,
  },
  {
    name: "player turn completes",
    current: gameLifecycleFixtures.playerTurn.state,
    event: { type: "complete-game" },
    expected: gameLifecycleFixtures.completed.state,
  },
  {
    name: "player turn may be abandoned",
    current: gameLifecycleFixtures.playerTurn.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "player turn may fail",
    current: gameLifecycleFixtures.playerTurn.state,
    event: failEvent,
    expected: { phase: "failed", failure: unexpectedFailure },
  },
  {
    name: "opponent turn requests an opponent move",
    current: gameLifecycleFixtures.opponentTurn.state,
    event: { type: "request-opponent-move" },
    expected: gameLifecycleFixtures.awaitingOpponent.state,
  },
  {
    name: "opponent turn pauses with its resume phase",
    current: gameLifecycleFixtures.opponentTurn.state,
    event: { type: "pause" },
    expected: { phase: "paused", resumePhase: "opponent-turn" },
  },
  {
    name: "opponent turn completes",
    current: gameLifecycleFixtures.opponentTurn.state,
    event: { type: "complete-game" },
    expected: gameLifecycleFixtures.completed.state,
  },
  {
    name: "opponent turn may be abandoned",
    current: gameLifecycleFixtures.opponentTurn.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "opponent turn may fail",
    current: gameLifecycleFixtures.opponentTurn.state,
    event: failEvent,
    expected: { phase: "failed", failure: unexpectedFailure },
  },
  {
    name: "awaiting opponent begins commit",
    current: gameLifecycleFixtures.awaitingOpponent.state,
    event: { type: "begin-commit" },
    expected: { phase: "committing" },
  },
  {
    name: "awaiting opponent enters degraded mode",
    current: gameLifecycleFixtures.awaitingOpponent.state,
    event: { type: "enter-degraded-mode" },
    expected: gameLifecycleFixtures.degraded.state,
  },
  {
    name: "awaiting opponent pauses with its resume phase",
    current: gameLifecycleFixtures.awaitingOpponent.state,
    event: { type: "pause" },
    expected: { phase: "paused", resumePhase: "awaiting-opponent" },
  },
  {
    name: "awaiting opponent completes",
    current: gameLifecycleFixtures.awaitingOpponent.state,
    event: { type: "complete-game" },
    expected: gameLifecycleFixtures.completed.state,
  },
  {
    name: "awaiting opponent may be abandoned",
    current: gameLifecycleFixtures.awaitingOpponent.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "awaiting opponent may fail",
    current: gameLifecycleFixtures.awaitingOpponent.state,
    event: failEvent,
    expected: { phase: "failed", failure: unexpectedFailure },
  },
  {
    name: "degraded provider recovery returns to awaiting opponent",
    current: gameLifecycleFixtures.degraded.state,
    event: { type: "recover-provider" },
    expected: gameLifecycleFixtures.awaitingOpponent.state,
  },
  {
    name: "degraded mode begins commit",
    current: gameLifecycleFixtures.degraded.state,
    event: { type: "begin-commit" },
    expected: { phase: "committing" },
  },
  {
    name: "degraded mode pauses with its resume phase",
    current: gameLifecycleFixtures.degraded.state,
    event: { type: "pause" },
    expected: { phase: "paused", resumePhase: "degraded" },
  },
  {
    name: "degraded mode may be abandoned",
    current: gameLifecycleFixtures.degraded.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "degraded mode may fail",
    current: gameLifecycleFixtures.degraded.state,
    event: failEvent,
    expected: { phase: "failed", failure: unexpectedFailure },
  },
  {
    name: "committing returns to player turn",
    current: { phase: "committing" },
    event: { type: "commit-to-player-turn" },
    expected: gameLifecycleFixtures.playerTurn.state,
  },
  {
    name: "committing returns to opponent turn",
    current: { phase: "committing" },
    event: { type: "commit-to-opponent-turn" },
    expected: gameLifecycleFixtures.opponentTurn.state,
  },
  {
    name: "committing completes",
    current: { phase: "committing" },
    event: { type: "complete-game" },
    expected: gameLifecycleFixtures.completed.state,
  },
  {
    name: "committing may fail",
    current: { phase: "committing" },
    event: failEvent,
    expected: { phase: "failed", failure: unexpectedFailure },
  },
  {
    name: "paused player turn resumes to player turn",
    current: gameLifecycleFixtures.paused.state,
    event: { type: "resume" },
    expected: gameLifecycleFixtures.playerTurn.state,
  },
  {
    name: "paused opponent turn resumes to opponent turn",
    current: { phase: "paused", resumePhase: "opponent-turn" },
    event: { type: "resume" },
    expected: gameLifecycleFixtures.opponentTurn.state,
  },
  {
    name: "paused awaiting opponent resumes to awaiting opponent",
    current: { phase: "paused", resumePhase: "awaiting-opponent" },
    event: { type: "resume" },
    expected: gameLifecycleFixtures.awaitingOpponent.state,
  },
  {
    name: "paused degraded mode resumes to degraded mode",
    current: { phase: "paused", resumePhase: "degraded" },
    event: { type: "resume" },
    expected: gameLifecycleFixtures.degraded.state,
  },
  {
    name: "paused game may be abandoned",
    current: gameLifecycleFixtures.paused.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "paused game may fail",
    current: gameLifecycleFixtures.paused.state,
    event: failEvent,
    expected: { phase: "failed", failure: unexpectedFailure },
  },
  {
    name: "failed game begins recovery with its failure context",
    current: gameLifecycleFixtures.failed.state,
    event: { type: "begin-recovery" },
    expected: gameLifecycleFixtures.recovery.state,
  },
  {
    name: "failed game may be abandoned",
    current: gameLifecycleFixtures.failed.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "recovery restores player turn",
    current: gameLifecycleFixtures.recovery.state,
    event: { type: "recover-to-player-turn" },
    expected: gameLifecycleFixtures.playerTurn.state,
  },
  {
    name: "recovery restores opponent turn",
    current: gameLifecycleFixtures.recovery.state,
    event: { type: "recover-to-opponent-turn" },
    expected: gameLifecycleFixtures.opponentTurn.state,
  },
  {
    name: "recovery restores awaiting opponent",
    current: gameLifecycleFixtures.recovery.state,
    event: { type: "recover-to-awaiting-opponent" },
    expected: gameLifecycleFixtures.awaitingOpponent.state,
  },
  {
    name: "recovery may be abandoned",
    current: gameLifecycleFixtures.recovery.state,
    event: { type: "abandon" },
    expected: gameLifecycleFixtures.abandoned.state,
  },
  {
    name: "recovery may fail again",
    current: gameLifecycleFixtures.recovery.state,
    event: failEvent,
    expected: { phase: "failed", failure: unexpectedFailure },
  },
] as const satisfies readonly AllowedTransitionCase[];

const invalidTransitions = [
  {
    name: "creating cannot begin a commit",
    current: gameLifecycleFixtures.creating.state,
    event: { type: "begin-commit" },
  },
  {
    name: "ready cannot resume",
    current: gameLifecycleFixtures.ready.state,
    event: { type: "resume" },
  },
  {
    name: "player turn cannot recover a provider",
    current: gameLifecycleFixtures.playerTurn.state,
    event: { type: "recover-provider" },
  },
  {
    name: "opponent turn cannot begin a commit before requesting a move",
    current: gameLifecycleFixtures.opponentTurn.state,
    event: { type: "begin-commit" },
  },
  {
    name: "awaiting opponent cannot repeat creation",
    current: gameLifecycleFixtures.awaitingOpponent.state,
    event: { type: "creation-succeeded" },
  },
  {
    name: "degraded mode cannot complete directly",
    current: gameLifecycleFixtures.degraded.state,
    event: { type: "complete-game" },
  },
  {
    name: "committing cannot pause",
    current: { phase: "committing" },
    event: { type: "pause" },
  },
  {
    name: "paused cannot complete directly",
    current: gameLifecycleFixtures.paused.state,
    event: { type: "complete-game" },
  },
  {
    name: "failed cannot resume",
    current: gameLifecycleFixtures.failed.state,
    event: { type: "resume" },
  },
  {
    name: "recovery cannot use the ready turn event",
    current: gameLifecycleFixtures.recovery.state,
    event: { type: "begin-player-turn" },
  },
] as const satisfies readonly RejectedTransitionCase[];

const everyEvent = [
  { type: "creation-succeeded" },
  { type: "creation-failed" },
  { type: "begin-player-turn" },
  { type: "begin-opponent-turn" },
  { type: "request-opponent-move" },
  { type: "begin-commit" },
  { type: "commit-to-player-turn" },
  { type: "commit-to-opponent-turn" },
  { type: "complete-game" },
  { type: "pause" },
  { type: "resume" },
  { type: "enter-degraded-mode" },
  { type: "recover-provider" },
  failEvent,
  { type: "begin-recovery" },
  { type: "recover-to-player-turn" },
  { type: "recover-to-opponent-turn" },
  { type: "recover-to-awaiting-opponent" },
  { type: "abandon" },
] as const satisfies readonly GameLifecycleEvent[];

describe("game lifecycle state machine", () => {
  it("creates a fresh lifecycle in the creating phase", () => {
    const first = createGameLifecycleState();
    const second = createGameLifecycleState();

    expect(first).toEqual(gameLifecycleFixtures.creating.state);
    expect(second).toEqual(gameLifecycleFixtures.creating.state);
    expect(first).not.toBe(second);
  });

  describe.each(allowedTransitions)("$name", ({ current, event, expected }) => {
    it("applies the approved transition without mutating its prior state", () => {
      const result = transitionGameLifecycle(current, event);

      expect(result).toEqual({ status: "applied", state: expected });
      if (result.status === "applied") {
        expect(result.state).not.toBe(current);
      }
    });
  });

  describe.each(invalidTransitions)("$name", ({ current, event }) => {
    it("rejects with the exact prior state", () => {
      const result = transitionGameLifecycle(current, event);

      expect(result).toEqual({
        status: "rejected",
        reason: "invalid-transition",
        state: current,
      });
      expect(result.state).toBe(current);
    });
  });

  describe.each([gameLifecycleFixtures.completed.state, gameLifecycleFixtures.abandoned.state])(
    "terminal phase $phase",
    (terminalState) => {
      it.each(everyEvent)("rejects $type without reopening the game", (event) => {
        const result = transitionGameLifecycle(terminalState, event);

        expect(result).toEqual({
          status: "rejected",
          reason: "terminal-state",
          state: terminalState,
        });
        expect(result.state).toBe(terminalState);
      });
    },
  );

  it("copies safe failure metadata instead of retaining caller-owned data", () => {
    const failure = { code: "commit-failed" } as const;
    const result = transitionGameLifecycle({ phase: "committing" }, { type: "fail", failure });

    expect(result).toEqual({
      status: "applied",
      state: { phase: "failed", failure },
    });
    if (result.status === "applied" && result.state.phase === "failed") {
      expect(result.state.failure).not.toBe(failure);
    }
  });

  it("copies failure context when entering recovery", () => {
    const failure = { code: "recovery-failed" } as const;
    const current = { phase: "failed", failure } as const;
    const result = transitionGameLifecycle(current, { type: "begin-recovery" });

    expect(result).toEqual({
      status: "applied",
      state: { phase: "recovery", failure },
    });
    if (result.status === "applied" && result.state.phase === "recovery") {
      expect(result.state.failure).not.toBe(failure);
    }
  });
});
