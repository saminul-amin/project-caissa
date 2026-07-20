import {
  ChessJsRulesAdapter,
  parseRequestId,
  type GameSessionCheckpoint,
} from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import {
  MemoryGameRepository,
  at,
  createDeferred,
  createOpponentProposal,
  humanMove,
  retryableStorageError,
} from "../../test/application-service-test-kit";
import {
  FixedWallClock,
  createAbandonedRecord,
  createCheckpoint,
} from "../../test/persistence-test-kit";
import { createGameStartupService } from "./game-startup-service";

describe("GameStartupService", () => {
  it("starts idle and exposes restoring while the repository read is pending", async () => {
    const repository = new MemoryGameRepository();
    const read = createDeferred<{ readonly status: "not-found" }>();
    repository.getActiveImplementation = () => read.promise;
    const service = createService(repository);
    expect(service.getState().status).toBe("idle");

    const restoration = service.restoreActiveGame();

    expect(service.getState().status).toBe("restoring");
    read.resolve({ status: "not-found" });
    await restoration;
  });

  it("returns no-active-game without writing when the slot is empty", async () => {
    const repository = new MemoryGameRepository();
    const service = createService(repository);

    const result = await service.restoreActiveGame();

    expect(result.status).toBe("no-active-game");
    expect(repository.calls).toEqual(["get-active"]);
  });

  it.each([
    ["ready", "ready"],
    ["human-turn", "player-turn"],
    ["opponent-turn", "opponent-turn"],
    ["awaiting-opponent", "awaiting-opponent"],
    ["paused", "paused"],
  ] as const)(
    "restores a valid %s checkpoint without changing its phase",
    async (fixture, phase) => {
      const repository = withActive(createCheckpoint(fixture, `startup-${fixture}`));
      const service = createService(repository);

      const result = await service.restoreActiveGame();

      expect(result.status).toBe("restored");
      if (result.status !== "restored") return;
      expect(result.session.lifecycle.phase).toBe(phase);
      expect(result.metadata.restoredRevision).toBe(repository.active?.revision);
      expect(result.persistence).toMatchObject({
        lastSuccessfulRevision: repository.active?.revision,
        status: "clean",
      });
    },
  );

  it("preserves an awaiting-opponent request exactly", async () => {
    const checkpoint = createCheckpoint("awaiting-opponent", "startup-request");
    const repository = withActive(checkpoint);

    const result = await createService(repository).restoreActiveGame();

    expect(result.status).toBe("restored");
    if (result.status !== "restored") return;
    expect(result.session.activeOpponentRequest).toEqual(checkpoint.activeOpponentRequest);
  });

  it("keeps a paused clock and exact resume phase paused", async () => {
    const checkpoint = createCheckpoint("paused", "startup-paused");

    const result = await createService(withActive(checkpoint)).restoreActiveGame();

    expect(result.status).toBe("restored");
    if (result.status !== "restored") return;
    expect(result.session.lifecycle).toEqual(checkpoint.lifecycle);
    expect(result.session.clock).toEqual(checkpoint.clock);
  });

  it("does not increment the restored revision or emit gameplay events", async () => {
    const checkpoint = createCheckpoint("human-turn", "startup-revision");

    const result = await createService(withActive(checkpoint)).restoreActiveGame();

    expect(result.status).toBe("restored");
    if (result.status !== "restored") return;
    expect(result.session.revision).toBe(checkpoint.revision);
    expect(Object.keys(result)).not.toContain("events");
  });

  it("does not rewrite or clear storage during successful restoration", async () => {
    const repository = withActive(createCheckpoint("ready", "startup-no-write"));

    await createService(repository).restoreActiveGame();

    expect(repository.calls).toEqual(["get-active"]);
    expect(repository.activeSaves).toEqual([]);
  });

  it("maps repository corruption to safe recovery-required metadata", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      corruption: {
        category: "invalid-checkpoint",
        rawRecoveryMayBePossible: true,
        recordKey: "<script>private</script>",
        recordType: "active-game",
      },
      status: "corrupted",
    });

    const result = await createService(repository).restoreActiveGame();

    expect(result).toEqual({
      recovery: {
        category: "invalid-checkpoint",
        deletionAvailable: true,
        rawRecoveryMayBePossible: true,
        recordKey: "active-record",
        retryMeaningful: false,
      },
      status: "recovery-required",
    });
    expect(JSON.stringify(result)).not.toContain("script");
    expect(repository.calls).toEqual(["get-active"]);
  });

  it("maps replay restoration rejection to recovery-required", async () => {
    const checkpoint = cloneCheckpoint(createCheckpoint("human-turn", "startup-rejected"));
    checkpoint.position = { ...checkpoint.position, fen: "invalid-fen" } as never;

    const result = await createService(withActive(checkpoint)).restoreActiveGame();

    expect(result).toMatchObject({
      recovery: { category: "position-mismatch" },
      status: "recovery-required",
    });
  });

  it("maps an unsupported checkpoint version to recovery-required", async () => {
    const checkpoint = cloneCheckpoint(createCheckpoint("ready", "startup-version"));
    checkpoint.checkpointVersion = 99 as never;

    const result = await createService(withActive(checkpoint)).restoreActiveGame();

    expect(result).toMatchObject({
      recovery: { category: "unsupported-checkpoint-version" },
      status: "recovery-required",
    });
  });

  it("distinguishes storage unavailability from corrupted data", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });

    const result = await createService(repository).restoreActiveGame();

    expect(result).toMatchObject({
      error: { code: "storage-unavailable" },
      status: "storage-unavailable",
    });
  });

  it("maps a non-availability repository failure to failed", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      error: { code: "transaction-failed", operation: "read", retryable: true },
      status: "failed",
    });

    const result = await createService(repository).restoreActiveGame();

    expect(result.status).toBe("failed");
  });

  it("maps a thrown repository read without leaking the exception", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => Promise.reject(new Error("raw private payload"));

    const result = await createService(repository).restoreActiveGame();

    expect(result).toMatchObject({ status: "storage-unavailable" });
    expect(JSON.stringify(result)).not.toContain("raw private payload");
  });

  it("retains a corrupted active record and never clears it automatically", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      corruption: {
        category: "invalid-record",
        rawRecoveryMayBePossible: false,
        recordKey: "active",
        recordType: "active-game",
      },
      status: "corrupted",
    });

    await createService(repository).restoreActiveGame();

    expect(repository.calls).toEqual(["get-active"]);
  });

  it("requires recovery when a terminal session occupies the active slot", async () => {
    const terminal = createAbandonedRecord("terminal-active", 5_000).checkpoint;

    const result = await createService(withActive(terminal)).restoreActiveGame();

    expect(result).toMatchObject({
      recovery: { category: "terminal-session-in-active-slot", retryMeaningful: false },
      status: "recovery-required",
    });
  });

  it("returns a restored coordinator that can continue and autosave", async () => {
    const repository = withActive(createCheckpoint("human-turn", "startup-continue"));
    const result = await createService(repository).restoreActiveGame();
    expect(result.status).toBe("restored");
    if (result.status !== "restored") return;

    const move = await result.coordinator.submitHumanMove(humanMove("e2e4", 1));

    expect(move).toMatchObject({ persistence: { status: "saved" }, status: "applied" });
    expect(repository.activeSaves).toHaveLength(1);
  });

  it("preserves stale proposal protection after awaiting-opponent restoration", async () => {
    const repository = withActive(createCheckpoint("awaiting-opponent", "startup-stale"));
    const result = await createService(repository).restoreActiveGame();
    expect(result.status).toBe("restored");
    if (result.status !== "restored") return;
    const proposal = createOpponentProposal(result.coordinator, "e2e4");
    const stale = { ...proposal, requestId: parseRequestId("stale-request") };
    const writesBefore = repository.activeSaves.length;

    const rejected = await result.coordinator.commitOpponentMove(stale, at(1));

    expect(rejected.status).toBe("rejected");
    expect(repository.activeSaves).toHaveLength(writesBefore);
  });
});

function createService(repository: MemoryGameRepository) {
  return createGameStartupService({
    createRules: () => new ChessJsRulesAdapter(),
    gameRepository: repository,
    wallClock: new FixedWallClock(),
  });
}

function withActive(checkpoint: GameSessionCheckpoint): MemoryGameRepository {
  const repository = new MemoryGameRepository();
  repository.active = checkpoint;
  return repository;
}

function cloneCheckpoint(checkpoint: GameSessionCheckpoint): MutableCheckpoint {
  return structuredClone(checkpoint);
}

type MutableCheckpoint = {
  -readonly [Key in keyof GameSessionCheckpoint]: GameSessionCheckpoint[Key];
};
