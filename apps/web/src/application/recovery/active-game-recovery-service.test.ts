import { ChessJsRulesAdapter } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import { createGameStartupService } from "../bootstrap";
import {
  MemoryGameRepository,
  retryableStorageError,
} from "../../test/application-service-test-kit";
import { FixedWallClock, createCheckpoint } from "../../test/persistence-test-kit";
import {
  DISCARD_ACTIVE_GAME_CONFIRMATION,
  createActiveGameRecoveryService,
} from "./active-game-recovery-service";
import { createRecoveryReadModel } from "./recovery-read-model";

describe("ActiveGameRecoveryService", () => {
  it("explicitly discards only the active-game slot", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createCheckpoint("ready", "discard-active");
    const service = createRecovery(repository);

    const result = await service.discardActiveGame({
      confirmation: DISCARD_ACTIVE_GAME_CONFIRMATION,
    });

    expect(result.status).toBe("discarded");
    expect(repository.active).toBeUndefined();
    expect(repository.calls).toEqual(["clear-active"]);
  });

  it("rejects an invalid runtime confirmation without touching storage", async () => {
    const repository = new MemoryGameRepository();
    const service = createRecovery(repository);

    const result = await service.discardActiveGame({ confirmation: "yes" } as never);

    expect(result).toEqual({ reason: "confirmation-required", status: "rejected" });
    expect(repository.calls).toEqual([]);
  });

  it("rejects a missing confirmation object without touching storage", async () => {
    const repository = new MemoryGameRepository();

    const result = await createRecovery(repository).discardActiveGame({} as never);

    expect(result.status).toBe("rejected");
    expect(repository.calls).toEqual([]);
  });

  it("does not clear completed history, preferences, reviews, or analysis cache", async () => {
    const repository = new MemoryGameRepository();
    const service = createRecovery(repository);

    await service.discardActiveGame({ confirmation: DISCARD_ACTIVE_GAME_CONFIRMATION });

    expect(repository.calls).not.toContain("clear-completed");
    expect(repository.calls).toEqual(["clear-active"]);
  });

  it("reports discard storage failure safely", async () => {
    const repository = new MemoryGameRepository();
    repository.clearActiveImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });

    const result = await createRecovery(repository).discardActiveGame({
      confirmation: DISCARD_ACTIVE_GAME_CONFIRMATION,
    });

    expect(result).toMatchObject({ error: { code: "storage-unavailable" }, status: "failed" });
  });

  it("maps a thrown discard failure without leaking the raw exception", async () => {
    const repository = new MemoryGameRepository();
    repository.clearActiveImplementation = () => Promise.reject(new Error("private"));

    const result = await createRecovery(repository).discardActiveGame({
      confirmation: DISCARD_ACTIVE_GAME_CONFIRMATION,
    });

    expect(result).toMatchObject({ error: { code: "unknown-storage-error" }, status: "failed" });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("continues without restoring without deleting the stored record", () => {
    const repository = new MemoryGameRepository();
    repository.active = createCheckpoint("ready", "continue-active");

    const result = createRecovery(repository).continueWithoutRestoring();

    expect(result).toEqual({ status: "continued", storageChanged: false });
    expect(repository.active).toBeDefined();
    expect(repository.calls).toEqual([]);
  });

  it("retries startup restoration without modifying storage first", async () => {
    const repository = new MemoryGameRepository();
    let attempt = 0;
    repository.getActiveImplementation = () => {
      attempt += 1;
      if (attempt === 1) return { error: retryableStorageError, status: "failed" };
      return {
        checkpoint: createCheckpoint("ready", "retry-startup"),
        status: "found",
        updatedAt: new FixedWallClock().nowEpochMs(),
      };
    };
    const startup = createGameStartupService({
      createRules: () => new ChessJsRulesAdapter(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    });
    const service = createActiveGameRecoveryService({
      gameRepository: repository,
      startupService: startup,
    });
    expect((await startup.restoreActiveGame()).status).toBe("storage-unavailable");

    const result = await service.retryRestoration();

    expect(result.status).toBe("restored");
    expect(repository.calls).toEqual(["get-active", "get-active"]);
  });

  it("retrying a corrupted record never clears it", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      corruption: {
        category: "invalid-checkpoint",
        rawRecoveryMayBePossible: true,
        recordKey: "active",
        recordType: "active-game",
      },
      status: "corrupted",
    });
    const startupService = createGameStartupService({
      createRules: () => new ChessJsRulesAdapter(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    });

    const result = await createActiveGameRecoveryService({
      gameRepository: repository,
      startupService,
    }).retryRestoration();

    expect(result.status).toBe("recovery-required");
    expect(repository.calls).toEqual(["get-active"]);
  });
});

describe("recovery UX read model", () => {
  it("uses stable safe action and message identifiers", () => {
    const model = createRecoveryReadModel({
      category: "invalid-checkpoint",
      deletionAvailable: true,
      rawRecoveryMayBePossible: true,
      recordKey: "active",
      retryMeaningful: true,
    });

    expect(model).toEqual({
      actions: ["retry", "discard-active-game", "continue-without-restoring"],
      bodyMessageKey: "recovery.active-game.invalid-checkpoint.body",
      category: "invalid-checkpoint",
      localGameplayCanContinue: true,
      severity: "error",
      storedRecordRemainsUntouched: true,
      titleMessageKey: "recovery.active-game.invalid-checkpoint.title",
    });
    expect(Object.isFrozen(model.actions)).toBe(true);
  });

  it("contains neither a raw payload nor an exception object", () => {
    const model = createRecoveryReadModel({
      category: "terminal-session-in-active-slot",
      deletionAvailable: true,
      rawRecoveryMayBePossible: true,
      recordKey: "active",
      retryMeaningful: false,
    });

    expect(model.actions).not.toContain("retry");
    expect(model.severity).toBe("warning");
    expect(JSON.stringify(model)).not.toContain("recordKey");
    expect(JSON.stringify(model)).not.toContain("Error");
  });
});

function createRecovery(repository: MemoryGameRepository) {
  const startupService = createGameStartupService({
    createRules: () => new ChessJsRulesAdapter(),
    gameRepository: repository,
    wallClock: new FixedWallClock(),
  });
  return createActiveGameRecoveryService({ gameRepository: repository, startupService });
}
