import { parseSessionRevision, parseSquare, parseUndoPlyCount } from "@caissa/chess-core";
import { beforeEach, describe, expect, it } from "vitest";

import { FixedWallClock } from "../../test/persistence-test-kit";
import {
  MemoryGameRepository,
  at,
  createControllerFixture,
  createDeferred,
  createOpponentProposal,
  humanMove,
  requestId,
  retryableStorageError,
} from "../../test/application-service-test-kit";
import {
  createGameSessionCoordinator,
  type GameSessionCoordinator,
} from "./game-session-coordinator";

describe("GameSessionCoordinator command autosave", () => {
  let repository: MemoryGameRepository;
  let wallClock: FixedWallClock;

  beforeEach(() => {
    repository = new MemoryGameRepository();
    wallClock = new FixedWallClock();
  });

  it("delegates legal-move reads without queueing or persistence side effects", () => {
    const controller = createControllerFixture();
    const coordinator = create(controller, repository, wallClock);
    const priorSession = coordinator.getSession();
    const priorPersistence = coordinator.getPersistenceState();

    const moves = coordinator.getLegalMoves({ from: parseSquare("e2") });

    expect(moves.map((move) => move.uci)).toEqual(["e2e3", "e2e4"]);
    expect(Object.isFrozen(moves)).toBe(true);
    expect(coordinator.getSession()).toBe(priorSession);
    expect(coordinator.getPersistenceState()).toBe(priorPersistence);
    expect(repository.calls).toEqual([]);
  });

  it("delegates start once and saves the resulting active checkpoint", async () => {
    const controller = createControllerFixture();
    const coordinator = create(controller, repository, wallClock);

    const result = await coordinator.start(at(0));

    expect(result.status).toBe("applied");
    expect(repository.activeSaves).toHaveLength(1);
    expect(repository.activeSaves[0]?.revision).toBe(1);
    expect(coordinator.getSession()).toBe(controller.getSession());
  });

  it("does not persist a rejected repeated start", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));

    const result = await coordinator.start(at(1));

    expect(result).toMatchObject({
      persistence: { status: "not-attempted" },
      status: "rejected",
    });
    expect(repository.activeSaves).toHaveLength(1);
  });

  it("saves a human move checkpoint at the exact resulting revision", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));

    const result = await coordinator.submitHumanMove(humanMove("e2e4", 1));

    expect(result).toMatchObject({ persistence: { revision: 2, status: "saved" } });
    expect(repository.activeSaves.at(-1)?.history[0]?.uci).toBe("e2e4");
  });

  it("persists the exact pending external-opponent request", async () => {
    const coordinator = create(
      createControllerFixture({ white: "external-opponent" }),
      repository,
      wallClock,
    );
    await coordinator.start(at(0));

    const result = await coordinator.requestOpponentMove({ requestId: requestId() });

    expect(result.status).toBe("applied");
    expect(repository.activeSaves.at(-1)?.activeOpponentRequest?.requestId).toBe(requestId());
    expect(repository.activeSaves.at(-1)?.lifecycle.phase).toBe("awaiting-opponent");
  });

  it("persists an applied external-opponent proposal", async () => {
    const controller = createControllerFixture({ white: "external-opponent" });
    const coordinator = create(controller, repository, wallClock);
    await coordinator.start(at(0));
    await coordinator.requestOpponentMove({ requestId: requestId() });

    const result = await coordinator.commitOpponentMove(
      createOpponentProposal(controller, "e2e4"),
      at(1),
    );

    expect(result.status).toBe("applied");
    expect(repository.activeSaves.at(-1)?.history[0]?.uci).toBe("e2e4");
    expect(repository.activeSaves.at(-1)?.activeOpponentRequest).toBeUndefined();
  });

  it("saves a paused checkpoint", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));

    await coordinator.pause(at(10));

    expect(repository.activeSaves.at(-1)?.lifecycle).toEqual({
      phase: "paused",
      resumePhase: "player-turn",
    });
  });

  it("saves the resumed checkpoint", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));
    await coordinator.pause(at(10));

    await coordinator.resume(at(20));

    expect(repository.activeSaves.at(-1)?.lifecycle.phase).toBe("player-turn");
  });

  it("saves the checkpoint produced by practice undo", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));
    await coordinator.submitHumanMove(humanMove("e2e4", 1));

    const result = await coordinator.undoMoves({ now: at(2), plies: parseUndoPlyCount(1) });

    expect(result.status).toBe("applied");
    expect(repository.activeSaves.at(-1)?.history).toHaveLength(0);
  });

  it("saves the pristine ready checkpoint produced by restart", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));

    const result = await coordinator.restart({});

    expect(result.status).toBe("applied");
    expect(repository.activeSaves.at(-1)).toMatchObject({
      history: [],
      lifecycle: { phase: "ready" },
    });
  });

  it("saves a degraded checkpoint after an opponent request failure", async () => {
    const controller = createControllerFixture({ white: "external-opponent" });
    const coordinator = create(controller, repository, wallClock);
    await coordinator.start(at(0));
    await coordinator.requestOpponentMove({ requestId: requestId() });

    const result = await coordinator.rejectOpponentRequest({
      reason: "unavailable",
      requestId: requestId(),
    });

    expect(result.status).toBe("applied");
    expect(repository.activeSaves.at(-1)?.lifecycle.phase).toBe("degraded");
  });

  it("finalizes checkmate without saving the terminal checkpoint to the active slot", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));
    await coordinator.submitHumanMove(humanMove("f2f3", 1));
    await coordinator.submitHumanMove(humanMove("e7e5", 2));
    await coordinator.submitHumanMove(humanMove("g2g4", 3));
    const activeSaveCount = repository.activeSaves.length;

    const result = await coordinator.submitHumanMove(humanMove("d8h4", 4));

    expect(result).toMatchObject({
      persistence: { status: "finalized" },
      result: { reason: "checkmate" },
      status: "completed",
    });
    expect(repository.activeSaves).toHaveLength(activeSaveCount);
    expect(repository.finalizations).toHaveLength(1);
    expect(repository.finalizations[0]?.pgn).toContain("Qh4#");
  });

  it("finalizes a rules-authority draw", async () => {
    const coordinator = create(
      createControllerFixture({ fen: "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1" }),
      repository,
      wallClock,
    );
    await coordinator.start(at(0));

    const result = await coordinator.submitHumanMove(humanMove("f5f7", 1));

    expect(result).toMatchObject({
      persistence: { status: "finalized" },
      result: { reason: "stalemate" },
      status: "completed",
    });
  });

  it("finalizes a timeout at the exact boundary", async () => {
    const coordinator = create(
      createControllerFixture({ timeControl: { initialMs: 1, kind: "sudden-death" } }),
      repository,
      wallClock,
    );
    await coordinator.start(at(0));

    const result = await coordinator.submitHumanMove(humanMove("e2e4", 1));

    expect(result).toMatchObject({ result: { reason: "timeout" }, status: "completed" });
    expect(repository.finalizations).toHaveLength(1);
  });

  it("finalizes abandonment transactionally", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));

    const result = await coordinator.abandon({ now: at(1) });

    expect(result).toMatchObject({ result: { reason: "abandoned" }, status: "completed" });
    expect(repository.calls.at(-1)).toBe("finalize");
  });

  it("preserves the controller domain-event array unchanged", async () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);

    const result = await coordinator.start(at(0));

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.events).toBe(result.domainResult.events);
    expect(result.events[0]?.type).toBe("game-started");
  });

  it("records injected wall-clock start and completion timestamps", async () => {
    wallClock.set(10_000);
    const coordinator = create(createControllerFixture(), repository, wallClock);
    await coordinator.start(at(0));
    wallClock.set(20_000);

    await coordinator.abandon({ now: at(1) });

    expect(repository.finalizations[0]).toMatchObject({
      completedAt: 20_000,
      startedAt: 10_000,
    });
  });

  it("does not invent an original start timestamp for a restored controller", async () => {
    const controller = createControllerFixture();
    expect(controller.start(at(0)).status).toBe("applied");
    const coordinator = create(controller, repository, wallClock, parseSessionRevision(1));

    await coordinator.abandon({ now: at(1) });

    expect(repository.finalizations[0]?.startedAt).toBeUndefined();
  });

  it("read-only session and persistence access produce no write", () => {
    const coordinator = create(createControllerFixture(), repository, wallClock);

    expect(coordinator.getSession().revision).toBe(0);
    expect(coordinator.getPersistenceState().status).toBe("clean");
    expect(repository.calls).toEqual([]);
  });
});

describe("GameSessionCoordinator persistence failure and retry", () => {
  it("exposes saving state while a controlled active write is pending", async () => {
    const repository = new MemoryGameRepository();
    const write = createDeferred<{ readonly status: "saved" }>();
    const entered = createDeferred<undefined>();
    repository.saveActiveImplementation = () => {
      entered.resolve(undefined);
      return write.promise;
    };
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());

    const start = coordinator.start(at(0));
    await entered.promise;

    expect(coordinator.getPersistenceState()).toMatchObject({
      operation: "save-active-game",
      status: "saving",
      targetRevision: 1,
    });
    write.resolve({ status: "saved" });
    await start;
  });

  it("emits a separate application event after a successful save", async () => {
    const coordinator = create(
      createControllerFixture(),
      new MemoryGameRepository(),
      new FixedWallClock(),
    );

    const result = await coordinator.start(at(0));

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.persistenceEvents).toEqual([
      expect.objectContaining({ revision: 1, type: "session-persisted" }),
    ]);
  });

  it("emits a safe application failure event separately from domain events", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());

    const result = await coordinator.start(at(0));

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.events[0]?.type).toBe("game-started");
    expect(result.persistenceEvents[0]?.type).toBe("session-persistence-failed");
  });

  it("retains the last successful revision when a later save fails", async () => {
    const repository = new MemoryGameRepository();
    let fail = false;
    repository.saveActiveImplementation = () =>
      fail ? { error: retryableStorageError, status: "failed" } : { status: "saved" };
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));
    fail = true;

    await coordinator.submitHumanMove(humanMove("e2e4", 1));

    expect(coordinator.getPersistenceState()).toMatchObject({
      lastSuccessfulRevision: 1,
      status: "unsaved",
      targetRevision: 2,
    });
  });

  it("never exposes the private retry checkpoint through persistence state", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());

    await coordinator.start(at(0));

    const serialized = JSON.stringify(coordinator.getPersistenceState());
    expect(serialized).not.toContain("checkpointVersion");
    expect(serialized).not.toContain("history");
  });

  it("emits retry success only as an application event", async () => {
    const repository = new MemoryGameRepository();
    let fail = true;
    repository.saveActiveImplementation = () => {
      if (fail) return { error: retryableStorageError, status: "failed" };
      return { status: "saved" };
    };
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));
    fail = false;

    const retry = await coordinator.retryPersistence();

    expect(retry.events).toEqual([]);
    expect(retry.persistenceEvents[0]?.type).toBe("persistence-retry-succeeded");
  });

  it("keeps authoritative chess state and exposes unsaved state after a write failure", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());

    const result = await coordinator.start(at(0));

    expect(result).toMatchObject({ persistence: { status: "unsaved" }, status: "applied" });
    expect(coordinator.getSession().lifecycle.phase).toBe("player-turn");
    expect(coordinator.getPersistenceState()).toMatchObject({
      retryAvailable: true,
      status: "unsaved",
      targetRevision: 1,
    });
  });

  it("returns an immutable persistence snapshot containing no raw exception", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => {
      throw new Error("private database detail");
    };
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));

    const state = coordinator.getPersistenceState();

    expect(Object.isFrozen(state)).toBe(true);
    expect(JSON.stringify(state)).not.toContain("private database detail");
    expect(state.status).toBe("unsaved");
  });

  it("retries the exact active checkpoint without rerunning or revising the domain command", async () => {
    const repository = new MemoryGameRepository();
    let fail = true;
    repository.saveActiveImplementation = (checkpoint) => {
      if (fail) return { error: retryableStorageError, status: "failed" };
      repository.active = checkpoint;
      return { status: "saved" };
    };
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));
    const revision = coordinator.getSession().revision;
    const pending = repository.activeSaves[0];
    fail = false;

    const retry = await coordinator.retryPersistence();

    expect(retry).toMatchObject({ revision, status: "succeeded" });
    expect(coordinator.getSession().revision).toBe(revision);
    expect(repository.activeSaves[1]).toBe(pending);
    expect(retry.events).toEqual([]);
  });

  it("preserves the exact pending active checkpoint after another retry failure", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));

    const retry = await coordinator.retryPersistence();

    expect(retry.status).toBe("failed");
    expect(coordinator.getPersistenceState().status).toBe("unsaved");
    expect(repository.activeSaves[1]).toBe(repository.activeSaves[0]);
  });

  it("reports nothing pending while clean", async () => {
    const coordinator = create(
      createControllerFixture(),
      new MemoryGameRepository(),
      new FixedWallClock(),
    );

    await expect(coordinator.retryPersistence()).resolves.toMatchObject({
      persistenceEvents: [],
      status: "nothing-pending",
    });
  });

  it("replaces an older pending active save with a newer applied revision", async () => {
    const repository = new MemoryGameRepository();
    let call = 0;
    repository.saveActiveImplementation = (checkpoint) => {
      call += 1;
      if (call === 1) return { error: retryableStorageError, status: "failed" };
      repository.active = checkpoint;
      return { status: "saved" };
    };
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));

    const result = await coordinator.submitHumanMove(humanMove("e2e4", 1));

    expect(result).toMatchObject({ persistence: { revision: 2, status: "saved" } });
    expect(repository.active?.revision).toBe(2);
    expect(coordinator.getPersistenceState()).toMatchObject({
      lastSuccessfulRevision: 2,
      status: "clean",
    });
  });

  it("keeps the exact completed record pending and retries finalization", async () => {
    const repository = new MemoryGameRepository();
    let fail = true;
    repository.finalizeImplementation = (record) => {
      if (fail) return { error: retryableStorageError, status: "failed" };
      repository.completed.set(record.gameId, record);
      return { status: "saved" };
    };
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));
    const completed = await coordinator.abandon({ now: at(1) });
    const pending = repository.finalizations[0];
    fail = false;

    const retry = await coordinator.retryPersistence();

    expect(completed).toMatchObject({
      persistence: { status: "finalization-pending" },
      status: "completed",
    });
    expect(retry.status).toBe("succeeded");
    expect(repository.finalizations[1]).toBe(pending);
  });

  it("preserves finalization-pending state after a failed retry", async () => {
    const repository = new MemoryGameRepository();
    repository.finalizeImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));
    await coordinator.abandon({ now: at(1) });

    const retry = await coordinator.retryPersistence();

    expect(retry.status).toBe("failed");
    expect(coordinator.getPersistenceState()).toMatchObject({
      retryAvailable: true,
      status: "finalization-pending",
    });
  });

  it("blocks reopening commands while an exact finalization remains pending", async () => {
    const repository = new MemoryGameRepository();
    repository.finalizeImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());
    await coordinator.start(at(0));
    await coordinator.abandon({ now: at(1) });
    const revision = coordinator.getSession().revision;

    const result = await coordinator.restart({});

    expect(result).toMatchObject({ reason: "finalization-pending", status: "blocked" });
    expect(coordinator.getSession().revision).toBe(revision);
    expect(repository.activeSaves.at(-1)?.revision).not.toBeGreaterThan(revision);
  });

  it("maps a repository rejection to a safe application persistence error", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      reason: "validation-failed",
      status: "rejected",
    });
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());

    const result = await coordinator.start(at(0));

    expect(result).toMatchObject({
      persistence: { error: { code: "validation-failed", retryable: false }, status: "unsaved" },
    });
  });

  it("does not create a retry candidate for a rejected domain command", async () => {
    const repository = new MemoryGameRepository();
    const coordinator = create(createControllerFixture(), repository, new FixedWallClock());

    const result = await coordinator.submitHumanMove(humanMove("e2e4", 0));

    expect(result.status).toBe("rejected");
    expect(repository.calls).toEqual([]);
    await expect(coordinator.retryPersistence()).resolves.toMatchObject({
      status: "nothing-pending",
    });
  });

  it("uses authoritative controller PGN for finalized persistence", async () => {
    const repository = new MemoryGameRepository();
    const controller = createControllerFixture();
    const coordinator = create(controller, repository, new FixedWallClock());
    await coordinator.start(at(0));
    await coordinator.submitHumanMove(humanMove("e2e4", 1));

    await coordinator.abandon({ now: at(2) });

    expect(repository.finalizations[0]?.pgn).toBe(controller.exportPgn());
  });
});

function create(
  controller: ReturnType<typeof createControllerFixture>,
  repository: MemoryGameRepository,
  wallClock: FixedWallClock,
  lastPersistedRevision?: ReturnType<typeof parseSessionRevision>,
): GameSessionCoordinator {
  return createGameSessionCoordinator({
    controller,
    gameRepository: repository,
    wallClock,
    ...(lastPersistedRevision === undefined ? {} : { lastPersistedRevision }),
  });
}
