export type GamePhase =
  | "creating"
  | "ready"
  | "player-turn"
  | "opponent-turn"
  | "awaiting-opponent"
  | "committing"
  | "paused"
  | "degraded"
  | "completed"
  | "abandoned"
  | "recovery"
  | "failed";

export type ResumableGamePhase = "player-turn" | "opponent-turn" | "awaiting-opponent" | "degraded";

export type GameLifecycleFailureCode =
  | "creation-failed"
  | "commit-failed"
  | "opponent-provider-failed"
  | "recovery-failed"
  | "unexpected-failure";

export interface GameLifecycleFailure {
  readonly code: GameLifecycleFailureCode;
}

export type GameLifecycleState =
  | { readonly phase: "creating" }
  | { readonly phase: "ready" }
  | { readonly phase: "player-turn" }
  | { readonly phase: "opponent-turn" }
  | { readonly phase: "awaiting-opponent" }
  | { readonly phase: "committing" }
  | {
      readonly phase: "paused";
      readonly resumePhase: ResumableGamePhase;
    }
  | { readonly phase: "degraded" }
  | { readonly phase: "completed" }
  | { readonly phase: "abandoned" }
  | {
      readonly phase: "recovery";
      readonly failure: GameLifecycleFailure;
    }
  | {
      readonly phase: "failed";
      readonly failure: GameLifecycleFailure;
    };

export type GameLifecycleEvent =
  | { readonly type: "creation-succeeded" }
  | { readonly type: "creation-failed" }
  | { readonly type: "begin-player-turn" }
  | { readonly type: "begin-opponent-turn" }
  | { readonly type: "request-opponent-move" }
  | { readonly type: "begin-commit" }
  | { readonly type: "commit-to-player-turn" }
  | { readonly type: "commit-to-opponent-turn" }
  | { readonly type: "complete-game" }
  | { readonly type: "pause" }
  | { readonly type: "resume" }
  | { readonly type: "enter-degraded-mode" }
  | { readonly type: "recover-provider" }
  | {
      readonly type: "fail";
      readonly failure: GameLifecycleFailure;
    }
  | { readonly type: "begin-recovery" }
  | { readonly type: "recover-to-player-turn" }
  | { readonly type: "recover-to-opponent-turn" }
  | { readonly type: "recover-to-awaiting-opponent" }
  | { readonly type: "abandon" };

export type GameLifecycleTransitionRejectionReason = "invalid-transition" | "terminal-state";

export type GameLifecycleTransitionResult =
  | {
      readonly status: "applied";
      readonly state: GameLifecycleState;
    }
  | {
      readonly status: "rejected";
      readonly state: GameLifecycleState;
      readonly reason: GameLifecycleTransitionRejectionReason;
    };

/** Creates a fresh lifecycle at the only valid entry phase. */
export function createGameLifecycleState(): GameLifecycleState {
  return { phase: "creating" };
}

/** Applies an approved event without mutating the caller-owned lifecycle state. */
export function transitionGameLifecycle(
  current: GameLifecycleState,
  event: GameLifecycleEvent,
): GameLifecycleTransitionResult {
  switch (current.phase) {
    case "creating":
      if (event.type === "creation-succeeded") {
        return applied({ phase: "ready" });
      }

      if (event.type === "creation-failed") {
        return applied(failedState("creation-failed"));
      }

      break;

    case "ready":
      if (event.type === "begin-player-turn") {
        return applied({ phase: "player-turn" });
      }

      if (event.type === "begin-opponent-turn") {
        return applied({ phase: "opponent-turn" });
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      break;

    case "player-turn":
      if (event.type === "begin-commit") {
        return applied({ phase: "committing" });
      }

      if (event.type === "pause") {
        return applied(pausedState(current.phase));
      }

      if (event.type === "complete-game") {
        return applied({ phase: "completed" });
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      if (event.type === "fail") {
        return applied(failedState(event.failure.code));
      }

      break;

    case "opponent-turn":
      if (event.type === "request-opponent-move") {
        return applied({ phase: "awaiting-opponent" });
      }

      if (event.type === "pause") {
        return applied(pausedState(current.phase));
      }

      if (event.type === "complete-game") {
        return applied({ phase: "completed" });
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      if (event.type === "fail") {
        return applied(failedState(event.failure.code));
      }

      break;

    case "awaiting-opponent":
      if (event.type === "begin-commit") {
        return applied({ phase: "committing" });
      }

      if (event.type === "enter-degraded-mode") {
        return applied({ phase: "degraded" });
      }

      if (event.type === "pause") {
        return applied(pausedState(current.phase));
      }

      if (event.type === "complete-game") {
        return applied({ phase: "completed" });
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      if (event.type === "fail") {
        return applied(failedState(event.failure.code));
      }

      break;

    case "degraded":
      if (event.type === "recover-provider") {
        return applied({ phase: "awaiting-opponent" });
      }

      if (event.type === "begin-commit") {
        return applied({ phase: "committing" });
      }

      if (event.type === "pause") {
        return applied(pausedState(current.phase));
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      if (event.type === "fail") {
        return applied(failedState(event.failure.code));
      }

      break;

    case "committing":
      if (event.type === "commit-to-player-turn") {
        return applied({ phase: "player-turn" });
      }

      if (event.type === "commit-to-opponent-turn") {
        return applied({ phase: "opponent-turn" });
      }

      if (event.type === "complete-game") {
        return applied({ phase: "completed" });
      }

      if (event.type === "fail") {
        return applied(failedState(event.failure.code));
      }

      break;

    case "paused":
      if (event.type === "resume") {
        return applied(resumedState(current.resumePhase));
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      if (event.type === "fail") {
        return applied(failedState(event.failure.code));
      }

      break;

    case "failed":
      if (event.type === "begin-recovery") {
        return applied({
          phase: "recovery",
          failure: { code: current.failure.code },
        });
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      break;

    case "recovery":
      if (event.type === "recover-to-player-turn") {
        return applied({ phase: "player-turn" });
      }

      if (event.type === "recover-to-opponent-turn") {
        return applied({ phase: "opponent-turn" });
      }

      if (event.type === "recover-to-awaiting-opponent") {
        return applied({ phase: "awaiting-opponent" });
      }

      if (event.type === "abandon") {
        return applied({ phase: "abandoned" });
      }

      if (event.type === "fail") {
        return applied(failedState(event.failure.code));
      }

      break;

    case "completed":
    case "abandoned":
      return rejected(current, "terminal-state");
  }

  return rejected(current, "invalid-transition");
}

function applied(state: GameLifecycleState): GameLifecycleTransitionResult {
  return { status: "applied", state };
}

function rejected(
  state: GameLifecycleState,
  reason: GameLifecycleTransitionRejectionReason,
): GameLifecycleTransitionResult {
  return { status: "rejected", state, reason };
}

function failedState(code: GameLifecycleFailureCode): GameLifecycleState {
  return { phase: "failed", failure: { code } };
}

function pausedState(resumePhase: ResumableGamePhase): GameLifecycleState {
  return { phase: "paused", resumePhase };
}

function resumedState(resumePhase: ResumableGamePhase): GameLifecycleState {
  switch (resumePhase) {
    case "player-turn":
      return { phase: "player-turn" };
    case "opponent-turn":
      return { phase: "opponent-turn" };
    case "awaiting-opponent":
      return { phase: "awaiting-opponent" };
    case "degraded":
      return { phase: "degraded" };
  }
}
