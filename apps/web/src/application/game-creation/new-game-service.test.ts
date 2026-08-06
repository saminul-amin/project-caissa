import { ChessJsRulesAdapter, parseGameId, parseSessionRevision } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import {
  MemoryGameRepository,
  createControllerFixture,
} from "../../test/application-service-test-kit";
import { FixedWallClock } from "../../test/persistence-test-kit";
import {
  DEFAULT_NEW_GAME_SETUP,
  REPLACE_ACTIVE_GAME_CONFIRMATION,
  TIME_CONTROL_OPTIONS,
  createNewGameService,
  validateNewGameSetup,
  type GameIdGenerator,
  type NewGameSetup,
} from "./new-game-service";

class FixedGameIdGenerator implements GameIdGenerator {
  constructor(private readonly value = "new-local-game") {}
  create() {
    return parseGameId(this.value);
  }
}

function createSubject(repository = new MemoryGameRepository()) {
  return {
    repository,
    service: createNewGameService({
      createRules: () => new ChessJsRulesAdapter(),
      gameIdGenerator: new FixedGameIdGenerator(),
      gameRepository: repository,
      wallClock: new FixedWallClock(),
    }),
  };
}

describe("NewGameService", () => {
  it("reports an absent active game", async () => {
    const { service } = createSubject();
    await expect(service.inspectActiveGame()).resolves.toEqual({ status: "absent" });
  });

  it("reports a valid active game", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createControllerFixture().exportCheckpoint();
    await expect(createSubject(repository).service.inspectActiveGame()).resolves.toEqual({
      status: "present",
    });
  });

  it("reports corrupted active data without exposing its payload", async () => {
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
    await expect(createSubject(repository).service.inspectActiveGame()).resolves.toEqual({
      status: "recovery-required",
    });
  });

  it("distinguishes unavailable storage from another read failure", async () => {
    const unavailable = new MemoryGameRepository();
    unavailable.getActiveImplementation = () => ({
      error: { code: "storage-unavailable", operation: "test", retryable: true },
      status: "failed",
    });
    const failed = new MemoryGameRepository();
    failed.getActiveImplementation = () => ({
      error: { code: "transaction-failed", operation: "test", retryable: true },
      status: "failed",
    });
    await expect(createSubject(unavailable).service.inspectActiveGame()).resolves.toEqual({
      status: "storage-unavailable",
    });
    await expect(createSubject(failed).service.inspectActiveGame()).resolves.toEqual({
      status: "failed",
    });
  });

  it("maps a thrown active read to a safe failure", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => {
      throw new Error("private storage detail");
    };
    await expect(createSubject(repository).service.inspectActiveGame()).resolves.toEqual({
      status: "failed",
    });
  });

  it("creates a ready local human-versus-human game with a validated ID", async () => {
    const { repository, service } = createSubject();
    const result = await service.createGame({ setup: DEFAULT_NEW_GAME_SETUP });
    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    expect(result.session.gameId).toBe(parseGameId("new-local-game"));
    expect(result.session.lifecycle.phase).toBe("ready");
    expect(result.session.revision).toBe(parseSessionRevision(0));
    expect(result.session.configuration.initialPosition).toEqual({ kind: "standard" });
    expect(result.session.configuration.participants).toEqual({
      black: { kind: "human", label: "Black" },
      white: { kind: "human", label: "White" },
    });
    expect(result.session.clock.status).toBe("untimed");
    expect(repository.activeSaves).toHaveLength(1);
    expect(repository.activeSaves[0]).toMatchObject(result.coordinator.getSession());
  });

  it.each(TIME_CONTROL_OPTIONS)("preserves the $label time control", async (option) => {
    const { service } = createSubject();
    const result = await service.createGame({
      setup: { ...DEFAULT_NEW_GAME_SETUP, timeControlId: option.id },
    });
    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.session.configuration.timeControl).toEqual(option.timeControl);
    }
  });

  it("preserves undo and orientation choices without changing participant colors", async () => {
    const { service } = createSubject();
    const result = await service.createGame({
      setup: { ...DEFAULT_NEW_GAME_SETUP, allowUndo: false, orientation: "black" },
    });
    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    expect(result.orientation).toBe("black");
    expect(result.session.configuration.allowUndo).toBe(false);
    expect(result.session.configuration.participants.white.kind).toBe("human");
  });

  it("does not start the controller or clock during creation", async () => {
    const { service } = createSubject();
    const result = await service.createGame({
      setup: { ...DEFAULT_NEW_GAME_SETUP, timeControlId: "5-minutes" },
    });
    expect(result.status).toBe("created");
    if (result.status === "created") {
      expect(result.session.lifecycle.phase).toBe("ready");
      expect(result.session.clock.status).toBe("idle");
    }
  });

  it("blocks silent replacement of an existing active game", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createControllerFixture({ id: "existing-game" }).exportCheckpoint();
    const result = await createSubject(repository).service.createGame({
      setup: DEFAULT_NEW_GAME_SETUP,
    });
    expect(result).toEqual({ status: "active-game-exists" });
    expect(repository.activeSaves).toHaveLength(0);
    expect(repository.active.gameId).toBe(parseGameId("existing-game"));
  });

  it("replaces only the active slot after explicit literal confirmation", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createControllerFixture({ id: "existing-game" }).exportCheckpoint();
    const result = await createSubject(repository).service.createGame({
      replaceActiveGame: REPLACE_ACTIVE_GAME_CONFIRMATION,
      setup: DEFAULT_NEW_GAME_SETUP,
    });
    expect(result.status).toBe("created");
    if (result.status === "created") expect(result.replacedActiveGame).toBe(true);
    expect(repository.active.gameId).toBe(parseGameId("new-local-game"));
    expect(repository.calls).not.toContain("clear-completed");
  });

  it("routes a corrupted active record through recovery even with replacement confirmation", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      corruption: {
        category: "invalid-record",
        rawRecoveryMayBePossible: true,
        recordKey: "active",
        recordType: "active-game",
      },
      status: "corrupted",
    });
    await expect(
      createSubject(repository).service.createGame({
        replaceActiveGame: REPLACE_ACTIVE_GAME_CONFIRMATION,
        setup: DEFAULT_NEW_GAME_SETUP,
      }),
    ).resolves.toEqual({ status: "active-game-recovery-required" });
    expect(repository.activeSaves).toHaveLength(0);
  });

  it("rejects invalid setup with stable field identifiers", async () => {
    const { service } = createSubject();
    const result = await service.createGame({ setup: {} as NewGameSetup });
    expect(result).toEqual({
      fields: ["mode", "timeControlId", "allowUndo", "orientation"],
      status: "invalid-setup",
    });
  });

  it("returns created-unsaved with an in-memory coordinator and retry state", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      error: { code: "quota-exceeded", operation: "active-game.save", retryable: true },
      status: "failed",
    });
    const result = await createSubject(repository).service.createGame({
      setup: DEFAULT_NEW_GAME_SETUP,
    });
    expect(result.status).toBe("created-unsaved");
    if (result.status !== "created-unsaved") return;
    expect(result.durabilityWarning).toBe("not-saved-for-refresh");
    expect(result.session.lifecycle.phase).toBe("ready");
    expect(result.coordinator.getPersistenceState()).toMatchObject({
      retryAvailable: true,
      status: "unsaved",
    });
  });

  it("preserves the prior active record when a replacement save fails", async () => {
    const repository = new MemoryGameRepository();
    const prior = createControllerFixture({ id: "existing-game" }).exportCheckpoint();
    repository.active = prior;
    repository.saveActiveImplementation = () => ({
      error: { code: "transaction-failed", operation: "active-game.save", retryable: true },
      status: "failed",
    });
    const result = await createSubject(repository).service.createGame({
      replaceActiveGame: REPLACE_ACTIVE_GAME_CONFIRMATION,
      setup: DEFAULT_NEW_GAME_SETUP,
    });
    expect(result.status).toBe("created-unsaved");
    expect(repository.active).toBe(prior);
  });

  it("maps rejected writes and construction failures to safe failed results", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      reason: "validation-failed",
      status: "rejected",
    });
    const rejected = await createSubject(repository).service.createGame({
      setup: DEFAULT_NEW_GAME_SETUP,
    });
    expect(rejected).toEqual({ status: "failed" });

    const throwing = createNewGameService({
      createController: () => {
        throw new Error("internal detail");
      },
      createRules: () => new ChessJsRulesAdapter(),
      gameIdGenerator: new FixedGameIdGenerator(),
      gameRepository: new MemoryGameRepository(),
      wallClock: new FixedWallClock(),
    });
    await expect(throwing.createGame({ setup: DEFAULT_NEW_GAME_SETUP })).resolves.toEqual({
      status: "failed",
    });
  });
});

describe("new-game setup validation", () => {
  it("accepts the default setup and rejects each invalid external field", () => {
    expect(validateNewGameSetup(DEFAULT_NEW_GAME_SETUP).status).toBe("valid");
    expect(validateNewGameSetup(null)).toMatchObject({ status: "invalid" });
    expect(validateNewGameSetup({ ...DEFAULT_NEW_GAME_SETUP, mode: "maia" })).toEqual({
      fields: ["mode"],
      status: "invalid",
    });
    expect(validateNewGameSetup({ ...DEFAULT_NEW_GAME_SETUP, timeControlId: "custom" })).toEqual({
      fields: ["timeControlId"],
      status: "invalid",
    });
  });
});
