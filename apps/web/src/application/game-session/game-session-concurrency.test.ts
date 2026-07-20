import type { GameController } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import {
  MemoryGameRepository,
  at,
  createControllerFixture,
  createDeferred,
  humanMove,
  retryableStorageError,
} from "../../test/application-service-test-kit";
import { FixedWallClock } from "../../test/persistence-test-kit";
import { createGameSessionCoordinator } from "./game-session-coordinator";

describe("GameSessionCoordinator serialization", () => {
  it("executes overlapping commands and persistence in invocation order", async () => {
    const repository = new MemoryGameRepository();
    const firstWrite = createDeferred<{ readonly status: "saved" }>();
    const entered = createDeferred<undefined>();
    repository.saveActiveImplementation = (checkpoint) => {
      if (checkpoint.revision === 1) {
        entered.resolve(undefined);
        return firstWrite.promise;
      }
      repository.active = checkpoint;
      return { status: "saved" };
    };
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    });

    const start = coordinator.start(at(0));
    const move = coordinator.submitHumanMove(humanMove("e2e4", 1));
    await entered.promise;
    expect(coordinator.getSession().revision).toBe(1);
    expect(repository.activeSaves).toHaveLength(1);
    firstWrite.resolve({ status: "saved" });

    await expect(start).resolves.toMatchObject({ status: "applied" });
    await expect(move).resolves.toMatchObject({ persistence: { revision: 2 }, status: "applied" });
    expect(repository.activeSaves.map((checkpoint) => checkpoint.revision)).toEqual([1, 2]);
  });

  it("serializes an overlapping retry before a later gameplay command", async () => {
    const repository = new MemoryGameRepository();
    let call = 0;
    const retryWrite = createDeferred<{ readonly status: "saved" }>();
    const retryEntered = createDeferred<undefined>();
    repository.saveActiveImplementation = () => {
      call += 1;
      if (call === 1) return { error: retryableStorageError, status: "failed" };
      if (call === 2) {
        retryEntered.resolve(undefined);
        return retryWrite.promise;
      }
      return { status: "saved" };
    };
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    });
    await coordinator.start(at(0));

    const retry = coordinator.retryPersistence();
    const move = coordinator.submitHumanMove(humanMove("e2e4", 1));
    await retryEntered.promise;
    expect(coordinator.getSession().revision).toBe(1);
    retryWrite.resolve({ status: "saved" });

    await expect(retry).resolves.toMatchObject({ status: "succeeded" });
    await expect(move).resolves.toMatchObject({ persistence: { revision: 2 } });
  });

  it("cannot persist an older revision after a newer revision", async () => {
    const repository = new MemoryGameRepository();
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    });

    await Promise.all([
      coordinator.start(at(0)),
      coordinator.submitHumanMove(humanMove("e2e4", 1)),
      coordinator.submitHumanMove(humanMove("e7e5", 2)),
    ]);

    expect(repository.activeSaves.map((checkpoint) => checkpoint.revision)).toEqual([1, 2, 3]);
    expect(repository.active?.revision).toBe(3);
  });

  it("does not race terminal finalization with a later active save", async () => {
    const repository = new MemoryGameRepository();
    const finalization = createDeferred<{ readonly status: "saved" }>();
    const entered = createDeferred<undefined>();
    repository.finalizeImplementation = () => {
      entered.resolve(undefined);
      return finalization.promise;
    };
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    });
    await coordinator.start(at(0));

    const abandon = coordinator.abandon({ now: at(1) });
    const restart = coordinator.restart({});
    await entered.promise;
    expect(repository.calls.at(-1)).toBe("finalize");
    finalization.resolve({ status: "saved" });

    await expect(abandon).resolves.toMatchObject({ status: "completed" });
    await expect(restart).resolves.toMatchObject({ status: "applied" });
    expect(repository.calls.slice(-2)).toEqual(["finalize", "save-active"]);
  });

  it("recovers the queue after a repository promise rejects", async () => {
    const repository = new MemoryGameRepository();
    let call = 0;
    repository.saveActiveImplementation = () => {
      call += 1;
      if (call === 1) throw new Error("storage failed unexpectedly");
      return { status: "saved" };
    };
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    });

    await expect(coordinator.start(at(0))).resolves.toMatchObject({
      persistence: { status: "unsaved" },
    });
    await expect(coordinator.submitHumanMove(humanMove("e2e4", 1))).resolves.toMatchObject({
      persistence: { status: "saved" },
    });
  });

  it("maps an unexpected controller failure and keeps future queue work live", async () => {
    const real = createControllerFixture();
    let first = true;
    const controller = new Proxy(real, {
      get(target, property, receiver) {
        if (property === "start") {
          return (now: Parameters<GameController["start"]>[0]) => {
            if (first) {
              first = false;
              throw new Error("private controller error");
            }
            return target.start(now);
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const coordinator = createGameSessionCoordinator({
      controller,
      gameRepository: new MemoryGameRepository(),
      wallClock: new FixedWallClock(),
    });

    await expect(coordinator.start(at(0))).resolves.toMatchObject({
      error: { code: "unexpected-operation-failure" },
      status: "failed",
    });
    await expect(coordinator.start(at(1))).resolves.toMatchObject({ status: "applied" });
  });

  it("does not let a rejected command block the queue", async () => {
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture(),
      gameRepository: new MemoryGameRepository(),
      wallClock: new FixedWallClock(),
    });

    const rejected = coordinator.submitHumanMove(humanMove("e2e4", 0));
    const start = coordinator.start(at(1));

    await expect(rejected).resolves.toMatchObject({ status: "rejected" });
    await expect(start).resolves.toMatchObject({ status: "applied" });
  });

  it("allows concurrent read-only access without changing session identity", async () => {
    const coordinator = createGameSessionCoordinator({
      controller: createControllerFixture(),
      gameRepository: new MemoryGameRepository(),
      wallClock: new FixedWallClock(),
    });
    const session = coordinator.getSession();

    const pending = coordinator.start(at(0));

    expect(coordinator.getSession()).toBe(session);
    await pending;
    expect(coordinator.getSession().revision).toBe(1);
  });
});
