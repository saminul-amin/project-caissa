import {
  parseSessionRevision,
  parseUndoPlyCount,
  type GameCommandRejectionReason,
} from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import type { GameOperationResult } from "../application";
import type { RejectedCoordinatorDomainResult } from "../application/game-session/game-session-types";
import { at, createControllerFixture, humanMove } from "../test/application-service-test-kit";
import {
  mapGameOperationRejectionReason,
  mapGameControlOperationResult,
  mapMoveOperationResult,
  mapStartOperationResult,
} from "./game-runtime-results";

describe("game runtime result mapping", () => {
  it.each([
    ["illegal-move", "illegal-move"],
    ["promotion-required", "promotion-required"],
    ["stale-revision", "position-changed"],
    ["position-mismatch", "position-changed"],
    ["ply-mismatch", "position-changed"],
    ["wrong-actor", "wrong-turn"],
    ["wrong-side-to-move", "wrong-turn"],
    ["request-color-mismatch", "wrong-turn"],
    ["already-paused", "game-paused"],
    ["already-completed", "game-completed"],
    ["already-abandoned", "game-completed"],
    ["clock-expired", "clock-expired"],
    ["already-started", "invalid-state"],
    ["invalid-lifecycle", "invalid-state"],
    ["missing-opponent-request", "invalid-state"],
    ["not-paused", "invalid-state"],
    ["opponent-request-active", "invalid-state"],
    ["request-id-mismatch", "invalid-state"],
    ["timestamp-regression", "invalid-state"],
  ] satisfies readonly (readonly [GameCommandRejectionReason, string])[])(
    "maps %s to the safe key %s",
    (reason, expected) => {
      expect(mapGameOperationRejectionReason(reason)).toBe(expected);
    },
  );

  it("maps authoritative start and move events", () => {
    const controller = createControllerFixture();
    const started = controller.start(at(1_000));
    if (started.status !== "applied") throw new Error("Expected applied start fixture.");
    const startOperation: GameOperationResult = {
      domainResult: started,
      events: started.events,
      persistence: { revision: started.session.revision, status: "saved" },
      persistenceEvents: [],
      session: started.session,
      status: "applied",
    };
    expect(mapStartOperationResult(startOperation)).toEqual({
      activeColor: "white",
      persistence: "saved",
      status: "applied",
    });

    const moved = controller.submitHumanMove(humanMove("e2e4", 1_100, 1));
    if (moved.status !== "applied") throw new Error("Expected applied move fixture.");
    const moveOperation: GameOperationResult = {
      domainResult: moved,
      events: moved.events,
      persistence: { revision: moved.session.revision, status: "unsaved", error: fixtureError },
      persistenceEvents: [],
      session: moved.session,
      status: "applied",
    };
    expect(mapMoveOperationResult(moveOperation)).toMatchObject({
      move: { san: "e4" },
      persistence: "unsaved",
      status: "applied",
    });
  });

  it("fails safely when an applied operation omits its required event", () => {
    const controller = createControllerFixture();
    const started = controller.start(at(1_000));
    if (started.status !== "applied") throw new Error("Expected applied start fixture.");
    const operation: GameOperationResult = {
      domainResult: started,
      events: [],
      persistence: { revision: started.session.revision, status: "saved" },
      persistenceEvents: [],
      session: started.session,
      status: "applied",
    };
    expect(mapStartOperationResult(operation)).toEqual({
      messageKey: "temporarily-unavailable",
      status: "failed",
    });
    expect(mapMoveOperationResult(operation)).toEqual({
      messageKey: "temporarily-unavailable",
      status: "failed",
    });
    for (const control of [
      "pause",
      "resume",
      "undo-one",
      "undo-two",
      "restart",
      "abandon",
    ] as const) {
      expect(mapGameControlOperationResult(control, operation)).toEqual({
        control,
        messageKey: "temporarily-unavailable",
        status: "failed",
      });
    }
  });

  it("maps rejection, blocked, and unexpected failure without raw errors", () => {
    const controller = createControllerFixture();
    controller.start(at(1_000));
    const rejected = controller.start(at(1_000));
    if (rejected.status !== "rejected") throw new Error("Expected rejected start fixture.");
    const rejectedOperation: GameOperationResult = {
      domainResult: rejected,
      events: [],
      persistence: { status: "not-attempted" },
      persistenceEvents: [],
      session: rejected.session,
      status: "rejected",
    };
    expect(mapStartOperationResult(rejectedOperation)).toEqual({
      messageKey: "invalid-state",
      status: "rejected",
    });
    expect(mapMoveOperationResult(rejectedOperation)).toEqual({
      messageKey: "invalid-state",
      status: "rejected",
    });

    const blocked: GameOperationResult = {
      events: [],
      persistence: {
        error: fixtureError,
        operation: "finalize-game",
        retryAvailable: true,
        status: "finalization-pending",
        targetRevision: parseSessionRevision(1),
      },
      persistenceEvents: [],
      reason: "finalization-pending",
      session: controller.getSession(),
      status: "blocked",
    };
    expect(mapStartOperationResult(blocked)).toEqual({
      messageKey: "persistence-pending",
      status: "blocked",
    });
    expect(mapMoveOperationResult(blocked)).toEqual({
      messageKey: "persistence-pending",
      status: "blocked",
    });
    expect(mapGameControlOperationResult("restart", blocked)).toEqual({
      control: "restart",
      messageKey: "persistence-pending",
      status: "blocked",
    });

    const failed: GameOperationResult = {
      error: { code: "unexpected-operation-failure", operation: "start", retryable: false },
      events: [],
      persistence: { status: "not-attempted" },
      persistenceEvents: [],
      session: controller.getSession(),
      status: "failed",
    };
    expect(mapStartOperationResult(failed)).toEqual({
      messageKey: "temporarily-unavailable",
      status: "failed",
    });
    expect(mapMoveOperationResult(failed)).toEqual({
      messageKey: "temporarily-unavailable",
      status: "failed",
    });
    expect(mapGameControlOperationResult("pause", failed)).toEqual({
      control: "pause",
      messageKey: "temporarily-unavailable",
      status: "failed",
    });
  });

  it("maps exact-boundary timeout completion for start and move consumers", () => {
    const controller = createControllerFixture({
      timeControl: { initialMs: 1_000, kind: "sudden-death" },
    });
    controller.start(at(0));
    const completed = controller.submitHumanMove(humanMove("e2e4", 1_000, 1));
    if (completed.status !== "completed") throw new Error("Expected completed timeout fixture.");
    const operation: GameOperationResult = {
      domainResult: completed,
      events: completed.events,
      persistence: { revision: completed.session.revision, status: "finalized" },
      persistenceEvents: [],
      result: completed.result,
      session: completed.session,
      status: "completed",
    };
    expect(mapStartOperationResult(operation)).toMatchObject({
      persistence: "finalized",
      result: { reason: "timeout" },
      status: "completed",
    });
    expect(mapMoveOperationResult(operation)).toMatchObject({
      expiredColor: "white",
      move: undefined,
      persistence: "finalized",
      result: { reason: "timeout" },
      status: "completed",
    });
    expect(mapGameControlOperationResult("restart", operation)).toEqual({
      control: "restart",
      messageKey: "temporarily-unavailable",
      status: "failed",
    });
  });

  it("maps pause, resume, undo, restart, and abandonment through bounded control results", () => {
    const controller = createControllerFixture();
    controller.start(at(1_000));
    const paused = controller.pause(at(1_100));
    if (paused.status !== "applied") throw new Error("Expected pause fixture.");
    expect(mapGameControlOperationResult("pause", appliedOperation(paused))).toMatchObject({
      control: "pause",
      persistence: "saved",
      resumePhase: "player-turn",
      status: "applied",
    });

    const resumed = controller.resume(at(1_200));
    if (resumed.status !== "applied") throw new Error("Expected resume fixture.");
    expect(mapGameControlOperationResult("resume", appliedOperation(resumed))).toMatchObject({
      resumedPhase: "player-turn",
      status: "applied",
    });

    controller.submitHumanMove(humanMove("e2e4", 1_300, 3));
    const undone = controller.undoMoves({
      expectedRevision: controller.getSession().revision,
      now: at(1_400),
      plies: parseUndoPlyCount(1),
    });
    if (undone.status !== "applied") throw new Error("Expected undo fixture.");
    expect(mapGameControlOperationResult("undo-one", appliedOperation(undone))).toMatchObject({
      control: "undo-one",
      removedPlies: 1,
      reopened: false,
      status: "applied",
    });

    const restarted = controller.restart({ expectedRevision: controller.getSession().revision });
    if (restarted.status !== "applied") throw new Error("Expected restart fixture.");
    expect(mapGameControlOperationResult("restart", appliedOperation(restarted))).toMatchObject({
      control: "restart",
      status: "applied",
    });

    const abandoned = controller.abandon({ now: at(1_500) });
    if (abandoned.status !== "completed") throw new Error("Expected abandonment fixture.");
    const operation: GameOperationResult = {
      domainResult: abandoned,
      events: abandoned.events,
      persistence: { revision: abandoned.session.revision, status: "finalized" },
      persistenceEvents: [],
      result: abandoned.result,
      session: abandoned.session,
      status: "completed",
    };
    expect(mapGameControlOperationResult("abandon", operation)).toMatchObject({
      control: "abandon",
      expiredColor: undefined,
      persistence: "finalized",
      result: { status: "abandoned" },
      status: "completed",
    });
  });

  it.each([
    ["already-reset", "already-ready"],
    ["already-paused", "game-paused"],
    ["not-paused", "game-not-paused"],
    ["game-paused", "resume-before-undo"],
    ["undo-disabled", "undo-disabled"],
    ["insufficient-history", "insufficient-history"],
    ["stale-revision", "position-changed"],
    ["position-mismatch", "position-changed"],
    ["ply-mismatch", "position-changed"],
    ["already-completed", "game-completed"],
    ["already-abandoned", "game-completed"],
    ["game-abandoned", "game-completed"],
    ["internal-restoration-failure", "temporarily-unavailable"],
    ["invalid-lifecycle", "invalid-state"],
  ] satisfies readonly (readonly [RejectedCoordinatorDomainResult["reason"], string])[])(
    "maps control rejection %s to safe key %s",
    (reason, expected) => {
      expect(mapGameControlOperationResult("undo-one", controlRejection(reason))).toEqual({
        control: "undo-one",
        messageKey: expected,
        status: "rejected",
      });
    },
  );
});

function appliedOperation(
  domainResult: Extract<GameOperationResult, { status: "applied" }>["domainResult"],
): GameOperationResult {
  return {
    domainResult,
    events: domainResult.events,
    persistence: { revision: domainResult.session.revision, status: "saved" },
    persistenceEvents: [],
    session: domainResult.session,
    status: "applied",
  };
}

function controlRejection(reason: RejectedCoordinatorDomainResult["reason"]): GameOperationResult {
  const session = createControllerFixture().getSession();
  const domainResult = {
    events: [],
    reason,
    session,
    status: "rejected",
  } as RejectedCoordinatorDomainResult;
  return {
    domainResult,
    events: [],
    persistence: { status: "not-attempted" },
    persistenceEvents: [],
    session,
    status: "rejected",
  };
}

const fixtureError = Object.freeze({
  code: "storage-unavailable" as const,
  operation: "test",
  retryable: true,
});
