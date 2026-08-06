import type { Color, GameResult, MoveInput, MoveRecord, SessionRevision } from "@caissa/chess-core";
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
