import { parseSessionRevision, type GameSession } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import { at, createControllerFixture, humanMove } from "../../test/application-service-test-kit";
import { deriveGameControlsAvailability } from "./game-controls";

const cleanPersistence = Object.freeze({ retryAvailable: false, status: "clean" as const });

describe("game control availability", () => {
  it("offers pause only during resumable play and resume only while paused", () => {
    const controller = createControllerFixture();
    expect(availability(controller.getSession()).pause).toMatchObject({
      available: false,
      reason: "invalid-lifecycle",
    });

    controller.start(at(1_000));
    expect(availability(controller.getSession())).toMatchObject({
      pause: { available: true },
      resume: { available: false },
    });

    controller.pause(at(1_100));
    expect(availability(controller.getSession())).toMatchObject({
      pause: { available: false },
      resume: { available: true },
      undoOne: { available: false, reason: "resume-before-undo" },
    });
  });

  it("distinguishes one-ply and two-ply undo from policy and history limits", () => {
    const controller = createControllerFixture();
    controller.start(at(1_000));
    expect(availability(controller.getSession()).undoOne).toMatchObject({
      available: false,
      reason: "insufficient-history",
    });

    controller.submitHumanMove(humanMove("e2e4", 1_100, 1));
    expect(availability(controller.getSession())).toMatchObject({
      undoOne: { available: true },
      undoTwo: { available: false, reason: "insufficient-history" },
    });
    controller.submitHumanMove(humanMove("e7e5", 1_200, 2));
    expect(availability(controller.getSession()).undoTwo).toEqual({ available: true });

    const disabled: GameSession = {
      ...controller.getSession(),
      configuration: { ...controller.getSession().configuration, allowUndo: false },
    };
    expect(availability(disabled).undoOne).toMatchObject({
      available: false,
      reason: "undo-disabled",
    });
  });

  it("allows confirmed reopening from completion but not from abandonment", () => {
    const completed = checkmateSession();
    expect(availability(completed)).toMatchObject({
      abandon: { available: false },
      restart: { available: true },
      undoOne: { available: true },
      undoTwo: { available: true },
    });

    const controller = createControllerFixture();
    controller.start(at(1_000));
    controller.submitHumanMove(humanMove("e2e4", 1_100, 1));
    controller.abandon({ now: at(1_200) });
    expect(availability(controller.getSession())).toMatchObject({
      abandon: { available: false },
      restart: { available: true },
      undoOne: { available: false, reason: "game-completed" },
    });
  });

  it("blocks all mutations during finalization, persistence, another operation, or promotion", () => {
    const session = checkmateSession();
    const finalizationPending = {
      error: {
        code: "storage-unavailable" as const,
        operation: "finalize-game",
        retryable: true,
      },
      operation: "finalize-game" as const,
      retryAvailable: true,
      status: "finalization-pending" as const,
      targetRevision: parseSessionRevision(5),
    };
    expect(availability(session, { persistence: finalizationPending }).restart).toMatchObject({
      available: false,
      reason: "persistence-pending",
    });

    const active = activeSession();
    expect(availability(active, { pendingControl: "pause" }).undoOne).toMatchObject({
      available: false,
      reason: "operation-in-progress",
    });
    expect(availability(active, { isMovePending: true }).pause).toMatchObject({
      available: false,
      reason: "operation-in-progress",
    });
    expect(availability(active, { isPromotionPending: true }).pause).toMatchObject({
      available: false,
      reason: "finish-promotion",
    });
    expect(
      availability(active, {
        persistence: {
          operation: "save-active-game",
          retryAvailable: false,
          status: "saving",
          targetRevision: active.revision,
        },
      }).pause,
    ).toMatchObject({ available: false, reason: "persistence-in-progress" });
  });

  it("reports an absent session and a pristine restart without guessing domain state", () => {
    const missing = deriveGameControlsAvailability({
      isConfirmationOpen: false,
      isMovePending: false,
      isPromotionPending: false,
      pendingControl: undefined,
      persistence: undefined,
      session: undefined,
    });
    expect(missing.abandon).toMatchObject({ available: false, reason: "no-active-game" });
    expect(availability(createControllerFixture().getSession()).restart).toMatchObject({
      available: false,
      reason: "already-ready",
    });
  });
});

interface AvailabilityOverrides {
  readonly isConfirmationOpen?: boolean;
  readonly isMovePending?: boolean;
  readonly isPromotionPending?: boolean;
  readonly pendingControl?: "pause";
  readonly persistence?: Parameters<typeof deriveGameControlsAvailability>[0]["persistence"];
}

function availability(session: GameSession, overrides: AvailabilityOverrides = {}) {
  return deriveGameControlsAvailability({
    isConfirmationOpen: overrides.isConfirmationOpen ?? false,
    isMovePending: overrides.isMovePending ?? false,
    isPromotionPending: overrides.isPromotionPending ?? false,
    pendingControl: overrides.pendingControl,
    persistence: overrides.persistence ?? cleanPersistence,
    session,
  });
}

function activeSession(): GameSession {
  const controller = createControllerFixture();
  controller.start(at(1_000));
  controller.submitHumanMove(humanMove("e2e4", 1_100, 1));
  return controller.getSession();
}

function checkmateSession(): GameSession {
  const controller = createControllerFixture();
  controller.start(at(1_000));
  controller.submitHumanMove(humanMove("f2f3", 1_100, 1));
  controller.submitHumanMove(humanMove("e7e5", 1_200, 2));
  controller.submitHumanMove(humanMove("g2g4", 1_300, 3));
  controller.submitHumanMove(humanMove("d8h4", 1_400, 4));
  return controller.getSession();
}
