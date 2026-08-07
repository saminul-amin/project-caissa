import type {
  Color,
  GameResult,
  MoveInput,
  MoveRecord,
  ResumableGamePhase,
  SessionRevision,
  UndoPlyCount,
} from "@caissa/chess-core";
import type { GameOperationResult } from "../application/game-session/game-session-types";

export type GameInteractionMessageKey =
  | "clock-expired"
  | "game-completed"
  | "game-not-started"
  | "game-paused"
  | "illegal-move"
  | "invalid-state"
  | "no-active-game"
  | "operation-in-progress"
  | "persistence-pending"
  | "position-changed"
  | "promotion-required"
  | "temporarily-unavailable"
  | "wrong-turn";

export type GameUiPersistenceOutcome = "finalization-pending" | "finalized" | "saved" | "unsaved";

export type PendingGameControl =
  "pause" | "resume" | "undo-one" | "undo-two" | "restart" | "abandon";

export type GameControlMessageKey =
  | "already-ready"
  | "game-completed"
  | "game-not-paused"
  | "game-paused"
  | "insufficient-history"
  | "invalid-state"
  | "no-active-game"
  | "operation-in-progress"
  | "persistence-pending"
  | "position-changed"
  | "resume-before-undo"
  | "temporarily-unavailable"
  | "undo-disabled";

export interface SubmitCurrentHumanMoveCommand {
  readonly expectedRevision: SessionRevision;
  readonly move: MoveInput;
}

export type StartGameUiResult =
  | {
      readonly activeColor: Color;
      readonly persistence: "saved" | "unsaved";
      readonly status: "applied";
    }
  | {
      readonly messageKey: GameInteractionMessageKey;
      readonly status: "rejected" | "blocked" | "failed";
    }
  | {
      readonly persistence: "finalization-pending" | "finalized";
      readonly result: GameResult;
      readonly status: "completed";
    };

export type MoveSubmissionUiResult =
  | {
      readonly move: MoveRecord;
      readonly persistence: "saved" | "unsaved";
      readonly status: "applied";
    }
  | {
      readonly messageKey: GameInteractionMessageKey;
      readonly status: "rejected" | "blocked" | "failed";
    }
  | {
      readonly expiredColor: Color | undefined;
      readonly move: MoveRecord | undefined;
      readonly persistence: "finalization-pending" | "finalized";
      readonly result: GameResult;
      readonly status: "completed";
    };

export type GameControlUiResult =
  | {
      readonly control: "pause";
      readonly persistence: "saved" | "unsaved";
      readonly resumePhase: ResumableGamePhase;
      readonly status: "applied";
    }
  | {
      readonly control: "resume";
      readonly persistence: "saved" | "unsaved";
      readonly resumedPhase: ResumableGamePhase;
      readonly status: "applied";
    }
  | {
      readonly control: "undo-one" | "undo-two";
      readonly persistence: "saved" | "unsaved";
      readonly removedPlies: UndoPlyCount;
      readonly reopened: boolean;
      readonly status: "applied";
    }
  | {
      readonly control: "restart";
      readonly persistence: "saved" | "unsaved";
      readonly status: "applied";
    }
  | {
      readonly control: "abandon" | "pause";
      readonly expiredColor: Color | undefined;
      readonly persistence: "finalization-pending" | "finalized";
      readonly result: GameResult;
      readonly status: "completed";
    }
  | {
      readonly control: PendingGameControl;
      readonly messageKey: GameControlMessageKey;
      readonly status: "rejected" | "blocked" | "failed";
    };

export function mapStartOperationResult(result: GameOperationResult): StartGameUiResult {
  switch (result.status) {
    case "applied": {
      const started = result.events.find((event) => event.type === "game-started");
      if (!started) {
        return Object.freeze({ messageKey: "temporarily-unavailable", status: "failed" });
      }
      return Object.freeze({
        activeColor: started.activeColor,
        persistence: result.persistence.status,
        status: "applied",
      });
    }
    case "completed":
      return Object.freeze({
        persistence: result.persistence.status,
        result: result.result,
        status: "completed",
      });
    case "rejected":
      return Object.freeze({
        messageKey: mapGameOperationRejectionReason(result.domainResult.reason),
        status: "rejected",
      });
    case "blocked":
      return Object.freeze({ messageKey: "persistence-pending", status: "blocked" });
    case "failed":
      return Object.freeze({ messageKey: "temporarily-unavailable", status: "failed" });
  }
}

export function mapMoveOperationResult(result: GameOperationResult): MoveSubmissionUiResult {
  switch (result.status) {
    case "applied": {
      const committed = result.events.find((event) => event.type === "move-committed");
      if (!committed) {
        return Object.freeze({ messageKey: "temporarily-unavailable", status: "failed" });
      }
      return Object.freeze({
        move: committed.move,
        persistence: result.persistence.status,
        status: "applied",
      });
    }
    case "completed": {
      const committed = result.events.find((event) => event.type === "move-committed");
      const expiration = result.events.find((event) => event.type === "clock-expired");
      return Object.freeze({
        expiredColor: expiration?.expiredColor,
        move: committed?.move,
        persistence: result.persistence.status,
        result: result.result,
        status: "completed",
      });
    }
    case "rejected":
      return Object.freeze({
        messageKey: mapGameOperationRejectionReason(result.domainResult.reason),
        status: "rejected",
      });
    case "blocked":
      return Object.freeze({ messageKey: "persistence-pending", status: "blocked" });
    case "failed":
      return Object.freeze({ messageKey: "temporarily-unavailable", status: "failed" });
  }
}

export function mapGameControlOperationResult(
  control: PendingGameControl,
  result: GameOperationResult,
): GameControlUiResult {
  switch (result.status) {
    case "applied": {
      const persistence = result.persistence.status;
      if (control === "pause") {
        const event = result.events.find((candidate) => candidate.type === "game-paused");
        return event
          ? Object.freeze({
              control,
              persistence,
              resumePhase: event.resumePhase,
              status: "applied",
            })
          : controlFailure(control);
      }
      if (control === "resume") {
        const event = result.events.find((candidate) => candidate.type === "game-resumed");
        return event
          ? Object.freeze({
              control,
              persistence,
              resumedPhase: event.resumedPhase,
              status: "applied",
            })
          : controlFailure(control);
      }
      if (control === "undo-one" || control === "undo-two") {
        const event = result.events.find((candidate) => candidate.type === "moves-undone");
        return event
          ? Object.freeze({
              control,
              persistence,
              removedPlies: event.removedPlies,
              reopened: result.events.some((candidate) => candidate.type === "game-reopened"),
              status: "applied",
            })
          : controlFailure(control);
      }
      if (control === "restart") {
        return result.events.some((candidate) => candidate.type === "game-restarted")
          ? Object.freeze({ control, persistence, status: "applied" })
          : controlFailure(control);
      }
      return controlFailure(control);
    }
    case "completed": {
      const expiration = result.events.find((event) => event.type === "clock-expired");
      if (control !== "pause" && control !== "abandon") return controlFailure(control);
      return Object.freeze({
        control,
        expiredColor: expiration?.expiredColor,
        persistence: result.persistence.status,
        result: result.result,
        status: "completed",
      });
    }
    case "rejected":
      return Object.freeze({
        control,
        messageKey: mapGameControlRejectionReason(result.domainResult.reason),
        status: "rejected",
      });
    case "blocked":
      return Object.freeze({ control, messageKey: "persistence-pending", status: "blocked" });
    case "failed":
      return controlFailure(control);
  }
}

function controlFailure(control: PendingGameControl): GameControlUiResult {
  return Object.freeze({ control, messageKey: "temporarily-unavailable", status: "failed" });
}

function mapGameControlRejectionReason(reason: string): GameControlMessageKey {
  switch (reason) {
    case "already-reset":
      return "already-ready";
    case "already-paused":
      return "game-paused";
    case "not-paused":
      return "game-not-paused";
    case "game-paused":
      return "resume-before-undo";
    case "undo-disabled":
      return "undo-disabled";
    case "insufficient-history":
      return "insufficient-history";
    case "stale-revision":
    case "position-mismatch":
    case "ply-mismatch":
      return "position-changed";
    case "already-completed":
    case "already-abandoned":
    case "game-abandoned":
      return "game-completed";
    case "internal-restoration-failure":
      return "temporarily-unavailable";
    default:
      return "invalid-state";
  }
}

export function mapGameOperationRejectionReason(
  reason: Extract<GameOperationResult, { readonly status: "rejected" }>["domainResult"]["reason"],
): GameInteractionMessageKey {
  switch (reason) {
    case "illegal-move":
      return "illegal-move";
    case "promotion-required":
      return "promotion-required";
    case "stale-revision":
    case "position-mismatch":
    case "ply-mismatch":
      return "position-changed";
    case "wrong-actor":
    case "wrong-side-to-move":
    case "request-color-mismatch":
      return "wrong-turn";
    case "already-paused":
      return "game-paused";
    case "already-completed":
    case "already-abandoned":
      return "game-completed";
    case "clock-expired":
      return "clock-expired";
    case "already-started":
    case "invalid-lifecycle":
    case "missing-opponent-request":
    case "not-paused":
    case "opponent-request-active":
    case "request-id-mismatch":
    case "timestamp-regression":
      return "invalid-state";
    default:
      return "invalid-state";
  }
}
