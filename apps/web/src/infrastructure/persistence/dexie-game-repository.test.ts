import { afterEach, describe, expect, it, vi } from "vitest";

import type { CompletedGameRecord } from "../../application/persistence";
import { ACTIVE_GAME_KEY, closeCaissaDatabase, type CaissaDatabase } from "./index";
import {
  createAbandonedRecord,
  createCheckmateRecord,
  createCheckpoint,
  createPersistenceTestContext,
  destroyPersistenceTestContext,
  type PersistenceTestContext,
} from "../../test/persistence-test-kit";

describe("DexieGameRepository", () => {
  let context: PersistenceTestContext | undefined;

  afterEach(async () => {
    if (context) await destroyPersistenceTestContext(context.database);
    context = undefined;
  });

  async function setup(): Promise<PersistenceTestContext> {
    context = await createPersistenceTestContext();
    return context;
  }

  it("saves an active checkpoint in the singleton slot", async () => {
    const { database, gameRepository } = await setup();

    expect(await gameRepository.saveActiveGame(createCheckpoint("ready"))).toEqual({
      status: "saved",
    });
    expect(await database.activeGames.count()).toBe(1);
  });

  it("reads a semantically validated active checkpoint", async () => {
    const { gameRepository } = await setup();
    const checkpoint = createCheckpoint("human-turn");
    await gameRepository.saveActiveGame(checkpoint);

    const result = await gameRepository.getActiveGame();

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.checkpoint).toEqual(checkpoint);
      expect(result.updatedAt).toBe(1_000);
    }
  });

  it("atomically replaces the prior active checkpoint", async () => {
    const { gameRepository } = await setup();
    await gameRepository.saveActiveGame(createCheckpoint("ready", "first-active"));
    await gameRepository.saveActiveGame(createCheckpoint("paused", "second-active"));

    const result = await gameRepository.getActiveGame();

    expect(result.status).toBe("found");
    if (result.status === "found") expect(result.checkpoint.gameId).toBe("second-active");
  });

  it("clears the active checkpoint", async () => {
    const { gameRepository } = await setup();
    await gameRepository.saveActiveGame(createCheckpoint("ready"));

    expect(await gameRepository.clearActiveGame()).toEqual({ status: "cleared" });
    expect(await gameRepository.getActiveGame()).toEqual({ status: "not-found" });
  });

  it("returns not-found when the active slot is absent", async () => {
    const { gameRepository } = await setup();
    expect(await gameRepository.getActiveGame()).toEqual({ status: "not-found" });
  });

  it("reports an unsupported active record version as corruption", async () => {
    const { database, gameRepository } = await setup();
    await putUnknown(database, "activeGames", {
      checkpoint: createCheckpoint("ready"),
      gameId: "fixture-ready",
      key: ACTIVE_GAME_KEY,
      recordVersion: 99,
      updatedAt: 1_000,
    });

    const result = await gameRepository.getActiveGame();

    expect(result).toMatchObject({
      corruption: { category: "unsupported-record-version", recordType: "active-game" },
      status: "corrupted",
    });
  });

  it("reports an invalid active checkpoint without throwing", async () => {
    const { database, gameRepository } = await setup();
    await putUnknown(database, "activeGames", {
      checkpoint: { checkpointVersion: 1, revision: -1 },
      gameId: "corrupt-active",
      key: ACTIVE_GAME_KEY,
      recordVersion: 1,
      updatedAt: 1_000,
    });

    expect(await gameRepository.getActiveGame()).toMatchObject({
      corruption: { category: "invalid-revision" },
      status: "corrupted",
    });
  });

  it("retains a corrupted authoritative active record", async () => {
    const { database, gameRepository } = await setup();
    await putUnknown(database, "activeGames", {
      checkpoint: null,
      gameId: "corrupt-active",
      key: ACTIVE_GAME_KEY,
      recordVersion: 1,
      updatedAt: 1_000,
    });

    await gameRepository.getActiveGame();

    expect(await database.activeGames.count()).toBe(1);
  });

  it("isolates stored active data from caller mutation after save", async () => {
    const { gameRepository } = await setup();
    const mutable = structuredClone(createCheckpoint("ready"));
    await gameRepository.saveActiveGame(mutable);
    (mutable as unknown as { configuration: { allowUndo: boolean } }).configuration.allowUndo =
      false;

    const result = await gameRepository.getActiveGame();

    expect(result.status).toBe("found");
    if (result.status === "found") expect(result.checkpoint.configuration.allowUndo).toBe(true);
  });

  it("returns immutable checkpoints so mutation cannot affect future reads", async () => {
    const { gameRepository } = await setup();
    await gameRepository.saveActiveGame(createCheckpoint("ready"));
    const first = await gameRepository.getActiveGame();
    expect(first.status).toBe("found");
    if (first.status === "found") {
      expect(() => {
        (first.checkpoint as unknown as { revision: number }).revision = 99;
      }).toThrow();
    }

    const second = await gameRepository.getActiveGame();
    expect(second.status).toBe("found");
    if (second.status === "found") expect(second.checkpoint.revision).not.toBe(99);
  });

  it("saves a completed game with final result and PGN", async () => {
    const { database, gameRepository } = await setup();

    expect(await gameRepository.saveCompletedGame(createCheckmateRecord("mate", 5_000))).toEqual({
      status: "saved",
    });
    expect(await database.completedGames.count()).toBe(1);
  });

  it("reads a full completed game", async () => {
    const { gameRepository } = await setup();
    const record = createCheckmateRecord("mate-read", 5_000);
    await gameRepository.saveCompletedGame(record);

    const result = await gameRepository.getCompletedGame(record.gameId);

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.record.checkpoint).toEqual(record.checkpoint);
      expect(result.record.pgn).toContain("Qh4#");
    }
  });

  it("returns not-found for an absent completed game", async () => {
    const { gameRepository } = await setup();
    const id = createCheckpoint("ready", "missing-completed").gameId;
    expect(await gameRepository.getCompletedGame(id)).toEqual({ status: "not-found" });
  });

  it("rejects an active checkpoint as a completed record", async () => {
    const { gameRepository } = await setup();
    const checkpoint = createCheckpoint("human-turn");
    const forged = {
      checkpoint,
      completedAt: 5_000,
      gameId: checkpoint.gameId,
      pgn: "*",
      result: { status: "draw" },
    } as unknown as CompletedGameRecord;

    expect(await gameRepository.saveCompletedGame(forged)).toEqual({
      reason: "not-completed",
      status: "rejected",
    });
  });

  it("rejects a completed write with a missing result", async () => {
    const { gameRepository } = await setup();
    const record = createCheckmateRecord("missing-result", 5_000);
    const forged = { ...record, result: undefined } as unknown as CompletedGameRecord;

    expect(await gameRepository.saveCompletedGame(forged)).toEqual({
      reason: "missing-result",
      status: "rejected",
    });
  });

  it("rejects a completed write with missing PGN", async () => {
    const { gameRepository } = await setup();
    const record = createCheckmateRecord("missing-pgn", 5_000);
    const forged = { ...record, pgn: "" } as unknown as CompletedGameRecord;

    expect(await gameRepository.saveCompletedGame(forged)).toEqual({
      reason: "missing-pgn",
      status: "rejected",
    });
  });

  it("upserts an equal or newer completed-game revision", async () => {
    const { gameRepository } = await setup();
    const older = createAbandonedRecord("revision-upsert", 1_000);
    const newer = createAbandonedRecord("revision-upsert", 2_000, 2);
    await gameRepository.saveCompletedGame(older);

    expect(await gameRepository.saveCompletedGame(newer)).toEqual({ status: "saved" });
    const read = await gameRepository.getCompletedGame(newer.gameId);
    expect(read.status).toBe("found");
    if (read.status === "found")
      expect(read.record.checkpoint.revision).toBe(newer.checkpoint.revision);
  });

  it("rejects an older revision without overwriting the newest record", async () => {
    const { gameRepository } = await setup();
    const older = createAbandonedRecord("revision-reject", 1_000);
    const newer = createAbandonedRecord("revision-reject", 2_000, 2);
    await gameRepository.saveCompletedGame(newer);

    expect(await gameRepository.saveCompletedGame(older)).toEqual({
      reason: "stale-revision",
      status: "rejected",
    });
  });

  it("deletes one completed game", async () => {
    const { gameRepository } = await setup();
    const record = createAbandonedRecord("delete-completed", 1_000);
    await gameRepository.saveCompletedGame(record);

    expect(await gameRepository.deleteCompletedGame(record.gameId)).toEqual({ status: "deleted" });
    expect(await gameRepository.getCompletedGame(record.gameId)).toEqual({ status: "not-found" });
  });

  it("clears completed history without touching the active slot", async () => {
    const { gameRepository } = await setup();
    await gameRepository.saveCompletedGame(createAbandonedRecord("clear-history", 1_000));
    await gameRepository.saveActiveGame(createCheckpoint("ready", "preserved-active"));

    expect(await gameRepository.clearCompletedGames()).toEqual({ status: "cleared" });
    expect((await gameRepository.getActiveGame()).status).toBe("found");
  });

  it("lists completed history newest first by default", async () => {
    const { gameRepository } = await setup();
    await saveHistory(gameRepository, [
      createAbandonedRecord("oldest", 1_000),
      createAbandonedRecord("newest", 3_000),
      createAbandonedRecord("middle", 2_000),
    ]);

    const result = await gameRepository.listCompletedGames();

    expect(result.status).toBe("listed");
    if (result.status === "listed")
      expect(result.items.map((item) => item.gameId)).toEqual(["newest", "middle", "oldest"]);
  });

  it("lists completed history oldest first on request", async () => {
    const { gameRepository } = await setup();
    await saveHistory(gameRepository, [
      createAbandonedRecord("later", 2_000),
      createAbandonedRecord("earlier", 1_000),
    ]);

    const result = await gameRepository.listCompletedGames({ sort: "completed-asc" });

    expect(result.status).toBe("listed");
    if (result.status === "listed")
      expect(result.items.map((item) => item.gameId)).toEqual(["earlier", "later"]);
  });

  it("enforces the default page limit", async () => {
    const { gameRepository } = await setup();
    for (let index = 0; index < 27; index += 1) {
      await gameRepository.saveCompletedGame(
        createAbandonedRecord(`default-${String(index)}`, index + 1),
      );
    }

    const result = await gameRepository.listCompletedGames();

    expect(result.status).toBe("listed");
    if (result.status === "listed") {
      expect(result.items).toHaveLength(25);
      expect(result.nextCursor).toBeDefined();
    }
  });

  it("caps requested pages at the maximum size", async () => {
    const { gameRepository } = await setup();
    for (let index = 0; index < 102; index += 1) {
      await gameRepository.saveCompletedGame(
        createAbandonedRecord(`maximum-${String(index)}`, index + 1),
      );
    }

    const result = await gameRepository.listCompletedGames({ limit: 1_000 });

    expect(result.status).toBe("listed");
    if (result.status === "listed") expect(result.items).toHaveLength(100);
  });

  it("uses completedAt and gameId for stable cursor pagination", async () => {
    const { gameRepository } = await setup();
    await saveHistory(gameRepository, [
      createAbandonedRecord("same-a", 1_000),
      createAbandonedRecord("same-b", 1_000),
      createAbandonedRecord("same-c", 1_000),
    ]);
    const first = await gameRepository.listCompletedGames({ limit: 2 });
    expect(first.status).toBe("listed");
    if (first.status !== "listed" || !first.nextCursor) throw new Error("Missing cursor.");

    const second = await gameRepository.listCompletedGames({ cursor: first.nextCursor, limit: 2 });

    expect(second.status).toBe("listed");
    if (second.status === "listed") {
      expect(second.items).toHaveLength(1);
      expect(new Set([...first.items, ...second.items].map((item) => item.gameId)).size).toBe(3);
    }
  });

  it("returns lightweight history summaries without checkpoint or PGN payloads", async () => {
    const { gameRepository } = await setup();
    await gameRepository.saveCompletedGame(createCheckmateRecord("summary", 2_000));

    const result = await gameRepository.listCompletedGames();

    expect(result.status).toBe("listed");
    if (result.status === "listed") {
      expect(result.items[0]).not.toHaveProperty("checkpoint");
      expect(result.items[0]).not.toHaveProperty("pgn");
      expect(result.items[0]).toMatchObject({ gameId: "summary", moveCount: 4 });
    }
  });

  it("finalizes a game by saving completed data and clearing the matching active slot", async () => {
    const { gameRepository } = await setup();
    const record = createCheckmateRecord("finalize", 2_000);
    await gameRepository.saveActiveGame(record.checkpoint);

    expect(await gameRepository.finalizeGame(record)).toEqual({ status: "saved" });
    expect(await gameRepository.getActiveGame()).toEqual({ status: "not-found" });
    expect((await gameRepository.getCompletedGame(record.gameId)).status).toBe("found");
  });

  it("rolls back failed finalization and preserves the prior active record", async () => {
    const { database, gameRepository } = await setup();
    const record = createCheckmateRecord("finalize-failure", 2_000);
    await gameRepository.saveActiveGame(record.checkpoint);
    const deleteSpy = vi
      .spyOn(database.activeGames, "delete")
      .mockRejectedValueOnce(new Error("fault"));

    const result = await gameRepository.finalizeGame(record);
    deleteSpy.mockRestore();

    expect(result).toMatchObject({ error: { code: "transaction-failed" }, status: "failed" });
    expect((await gameRepository.getActiveGame()).status).toBe("found");
    expect(await gameRepository.getCompletedGame(record.gameId)).toEqual({ status: "not-found" });
  });

  it("maps a deliberately closed database to a typed failure", async () => {
    const { database, gameRepository } = await setup();
    closeCaissaDatabase(database);

    const result = await gameRepository.getActiveGame();

    expect(result).toMatchObject({ error: { code: "database-closed" }, status: "failed" });
  });

  it("reports mismatched completed storage IDs as corruption and retains the record", async () => {
    const { database, gameRepository } = await setup();
    const record = createAbandonedRecord("stored-id", 1_000);
    const other = createAbandonedRecord("checkpoint-other-id", 1_000);
    await gameRepository.saveCompletedGame(record);
    const stored = await database.completedGames.get(record.gameId);
    if (!stored) throw new Error("Missing stored fixture.");
    await putUnknown(database, "completedGames", { ...stored, checkpoint: other.checkpoint });

    const result = await gameRepository.getCompletedGame(record.gameId);

    expect(result).toMatchObject({
      corruption: { category: "mismatched-game-id" },
      status: "corrupted",
    });
    expect(await database.completedGames.count()).toBe(1);
  });
});

async function putUnknown(
  database: CaissaDatabase,
  tableName: string,
  value: unknown,
): Promise<void> {
  await database.table<unknown, string>(tableName).put(value);
}

async function saveHistory(
  repository: PersistenceTestContext["gameRepository"],
  records: readonly CompletedGameRecord[],
): Promise<void> {
  for (const record of records) await repository.saveCompletedGame(record);
}
