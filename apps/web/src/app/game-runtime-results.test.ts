import { parseSessionRevision, type GameCommandRejectionReason } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import type { GameOperationResult } from "../application";
import { at, createControllerFixture, humanMove } from "../test/application-service-test-kit";
import {
  mapGameOperationRejectionReason,
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
  });
});

const fixtureError = Object.freeze({
  code: "storage-unavailable" as const,
  operation: "test",
  retryable: true,
});
