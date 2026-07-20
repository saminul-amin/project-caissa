import {
  parseGameId,
  parsePgn,
  parseSessionRevision,
  type GameId,
  type GameSessionCheckpoint,
} from "@caissa/chess-core";

import {
  DEFAULT_COMPLETED_GAME_PAGE_SIZE,
  MAXIMUM_COMPLETED_GAME_PAGE_SIZE,
  parseEpochTimestampMs,
  type CompletedGameCursor,
  type CompletedGameListResult,
  type CompletedGameQuery,
  type CompletedGameReadResult,
  type CompletedGameRecord,
  type CompletedGameSort,
  type CompletedGameSummary,
  type GameCheckpointReadResult,
  type GamePersistenceResult,
  type GameRepository,
  type PersistenceClearResult,
  type PersistenceDeleteResult,
  type WallClock,
} from "../../application/persistence";
import type { CaissaDatabase } from "./database";
import { mapPersistenceError, mapTransactionError } from "./error-mapper";
import { corruptedRecord } from "./record-safety";
import {
  ACTIVE_GAME_KEY,
  ACTIVE_GAME_RECORD_VERSION,
  COMPLETED_GAME_RECORD_VERSION,
  type CompletedGameStorageRecord,
} from "./storage-records";
import {
  cloneForStorage,
  validateActiveStorageRecord,
  validateCheckpoint,
  validateCompletedStorageRecord,
} from "./validation";

type PreparedCompletedRecord =
  | { readonly status: "prepared"; readonly storage: CompletedGameStorageRecord }
  | {
      readonly reason:
        | "mismatched-game-id"
        | "missing-pgn"
        | "missing-result"
        | "not-completed"
        | "validation-failed";
      readonly status: "rejected";
    };

export class DexieGameRepository implements GameRepository {
  constructor(
    private readonly database: CaissaDatabase,
    private readonly wallClock: WallClock,
  ) {}

  async saveActiveGame(checkpoint: GameSessionCheckpoint): Promise<GamePersistenceResult> {
    const validation = validateCheckpoint(checkpoint);
    if (validation.status === "invalid") {
      return { reason: "validation-failed", status: "rejected" };
    }

    try {
      const record = cloneForStorage({
        checkpoint: validation.value,
        gameId: validation.value.gameId,
        key: ACTIVE_GAME_KEY,
        recordVersion: ACTIVE_GAME_RECORD_VERSION,
        updatedAt: this.wallClock.nowEpochMs(),
      });
      await this.database.transaction("rw", this.database.activeGames, async () => {
        await this.database.activeGames.put(record);
      });
      return { status: "saved" };
    } catch (error: unknown) {
      return { error: mapTransactionError(error, "active-game.save"), status: "failed" };
    }
  }

  async getActiveGame(): Promise<GameCheckpointReadResult> {
    try {
      const record: unknown = await this.database.activeGames.get(ACTIVE_GAME_KEY);
      if (record === undefined) return { status: "not-found" };

      const validation = validateActiveStorageRecord(record);
      if (validation.status === "invalid") {
        return {
          corruption: corruptedRecord("active-game", ACTIVE_GAME_KEY, validation.category, true),
          status: "corrupted",
        };
      }

      return {
        checkpoint: validation.value.checkpoint,
        status: "found",
        updatedAt: parseEpochTimestampMs(validation.value.storage.updatedAt),
      };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "active-game.read"), status: "failed" };
    }
  }

  async clearActiveGame(): Promise<PersistenceClearResult> {
    try {
      await this.database.transaction("rw", this.database.activeGames, async () => {
        await this.database.activeGames.delete(ACTIVE_GAME_KEY);
      });
      return { status: "cleared" };
    } catch (error: unknown) {
      return { error: mapTransactionError(error, "active-game.clear"), status: "failed" };
    }
  }

  async saveCompletedGame(record: CompletedGameRecord): Promise<GamePersistenceResult> {
    const prepared = this.prepareCompletedRecord(record);
    if (prepared.status === "rejected") return prepared;

    try {
      return await this.database.transaction("rw", this.database.completedGames, async () =>
        this.upsertCompletedStorageRecord(prepared.storage),
      );
    } catch (error: unknown) {
      return { error: mapTransactionError(error, "completed-game.save"), status: "failed" };
    }
  }

  async finalizeGame(record: CompletedGameRecord): Promise<GamePersistenceResult> {
    const prepared = this.prepareCompletedRecord(record);
    if (prepared.status === "rejected") return prepared;

    try {
      return await this.database.transaction(
        "rw",
        [this.database.activeGames, this.database.completedGames],
        async () => {
          const saved = await this.upsertCompletedStorageRecord(prepared.storage);
          if (saved.status !== "saved") return saved;

          const active = await this.database.activeGames.get(ACTIVE_GAME_KEY);
          if (active?.gameId === prepared.storage.gameId) {
            await this.database.activeGames.delete(ACTIVE_GAME_KEY);
          }
          return saved;
        },
      );
    } catch (error: unknown) {
      return { error: mapTransactionError(error, "completed-game.finalize"), status: "failed" };
    }
  }

  async getCompletedGame(gameId: GameId): Promise<CompletedGameReadResult> {
    try {
      const safeGameId = parseGameId(gameId);
      const record: unknown = await this.database.completedGames.get(safeGameId);
      if (record === undefined) return { status: "not-found" };

      const validation = validateCompletedStorageRecord(record);
      if (validation.status === "invalid") {
        return {
          corruption: corruptedRecord("completed-game", safeGameId, validation.category, true),
          status: "corrupted",
        };
      }
      return { record: validation.value.record, status: "found" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "completed-game.read"), status: "failed" };
    }
  }

  async listCompletedGames(query: CompletedGameQuery = {}): Promise<CompletedGameListResult> {
    const parsedQuery = parseCompletedGameQuery(query);
    if (parsedQuery.status === "rejected") return parsedQuery;

    try {
      const storedRecords: readonly unknown[] = await this.database.completedGames.toArray();
      const items: CompletedGameSummary[] = [];
      const corruptions = [];

      for (const storedRecord of storedRecords) {
        const validation = validateCompletedStorageRecord(storedRecord);
        if (validation.status === "invalid") {
          const key = isRecord(storedRecord) ? storedRecord.gameId : undefined;
          corruptions.push(corruptedRecord("completed-game", key, validation.category, true));
          continue;
        }
        items.push(toCompletedGameSummary(validation.value.record));
      }

      items.sort((left, right) => compareCompleted(left, right, parsedQuery.sort));
      const cursor = parsedQuery.cursor;
      const afterCursor = cursor
        ? items.filter((item) => compareCompleted(item, cursor, parsedQuery.sort) > 0)
        : items;
      const page = afterCursor.slice(0, parsedQuery.limit);
      const last = page.at(-1);
      const nextCursor =
        afterCursor.length > page.length && last
          ? Object.freeze({ completedAt: last.completedAt, gameId: last.gameId })
          : undefined;

      return {
        corruptions: Object.freeze(corruptions),
        items: Object.freeze(page),
        status: "listed",
        ...(nextCursor ? { nextCursor } : {}),
      };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "completed-game.list"), status: "failed" };
    }
  }

  async deleteCompletedGame(gameId: GameId): Promise<PersistenceDeleteResult> {
    try {
      await this.database.completedGames.delete(parseGameId(gameId));
      return { status: "deleted" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "completed-game.delete"), status: "failed" };
    }
  }

  async clearCompletedGames(): Promise<PersistenceClearResult> {
    try {
      await this.database.completedGames.clear();
      return { status: "cleared" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "completed-game.clear"), status: "failed" };
    }
  }

  private prepareCompletedRecord(record: unknown): PreparedCompletedRecord {
    if (!isRecord(record)) {
      return { reason: "validation-failed", status: "rejected" };
    }

    const checkpoint = validateCheckpoint(record.checkpoint);
    if (checkpoint.status === "invalid") {
      return { reason: "validation-failed", status: "rejected" };
    }
    if (
      checkpoint.value.lifecycle.phase !== "completed" &&
      checkpoint.value.lifecycle.phase !== "abandoned"
    ) {
      return { reason: "not-completed", status: "rejected" };
    }
    if (record.result === undefined || !checkpoint.value.result) {
      return { reason: "missing-result", status: "rejected" };
    }
    if (!sameJson(record.result, checkpoint.value.result)) {
      return { reason: "validation-failed", status: "rejected" };
    }

    try {
      if (typeof record.gameId !== "string") {
        return { reason: "mismatched-game-id", status: "rejected" };
      }
      const gameId = parseGameId(record.gameId);
      if (gameId !== checkpoint.value.gameId) {
        return { reason: "mismatched-game-id", status: "rejected" };
      }
      if (typeof record.pgn !== "string" || record.pgn.trim().length === 0) {
        return { reason: "missing-pgn", status: "rejected" };
      }

      const pgn = parsePgn(record.pgn);
      const completedAt = parseEpochTimestampMs(record.completedAt);
      const startedAt =
        record.startedAt === undefined ? undefined : parseEpochTimestampMs(record.startedAt);
      const revision = parseSessionRevision(checkpoint.value.revision);
      const storage: CompletedGameStorageRecord = cloneForStorage({
        blackParticipantKind: checkpoint.value.configuration.participants.black.kind,
        checkpoint: checkpoint.value,
        completedAt,
        gameId,
        lastUpdatedAt: this.wallClock.nowEpochMs(),
        pgn,
        recordVersion: COMPLETED_GAME_RECORD_VERSION,
        result: checkpoint.value.result,
        resultType: checkpoint.value.result.status,
        revision,
        whiteParticipantKind: checkpoint.value.configuration.participants.white.kind,
        ...(startedAt === undefined ? {} : { startedAt }),
      });
      return { status: "prepared", storage };
    } catch {
      return { reason: "validation-failed", status: "rejected" };
    }
  }

  private async upsertCompletedStorageRecord(
    incoming: CompletedGameStorageRecord,
  ): Promise<GamePersistenceResult> {
    const existing: unknown = await this.database.completedGames.get(incoming.gameId);
    if (existing !== undefined) {
      const validation = validateCompletedStorageRecord(existing);
      if (validation.status === "invalid") {
        return { reason: "validation-failed", status: "rejected" };
      }
      if (validation.value.storage.revision > incoming.revision) {
        return { reason: "stale-revision", status: "rejected" };
      }
    }

    await this.database.completedGames.put(incoming);
    return { status: "saved" };
  }
}

type ParsedCompletedGameQuery =
  | {
      readonly cursor: CompletedGameCursor | undefined;
      readonly limit: number;
      readonly sort: CompletedGameSort;
      readonly status: "parsed";
    }
  | { readonly reason: "invalid-query"; readonly status: "rejected" };

function parseCompletedGameQuery(query: unknown): ParsedCompletedGameQuery {
  try {
    if (!isRecord(query)) return { reason: "invalid-query", status: "rejected" };

    const limit = query.limit;
    if (
      limit !== undefined &&
      (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit <= 0)
    ) {
      return { reason: "invalid-query", status: "rejected" };
    }
    const sort = query.sort ?? "completed-desc";
    if (sort !== "completed-asc" && sort !== "completed-desc") {
      return { reason: "invalid-query", status: "rejected" };
    }

    const cursorValue = query.cursor;
    if (cursorValue !== undefined && !isRecord(cursorValue)) {
      return { reason: "invalid-query", status: "rejected" };
    }
    const cursorGameId = cursorValue?.gameId;
    if (cursorValue && typeof cursorGameId !== "string") {
      return { reason: "invalid-query", status: "rejected" };
    }
    let cursor: CompletedGameCursor | undefined;
    if (cursorValue && typeof cursorGameId === "string") {
      cursor = Object.freeze({
        completedAt: parseEpochTimestampMs(cursorValue.completedAt),
        gameId: parseGameId(cursorGameId),
      });
    }
    return {
      cursor,
      limit: Math.min(
        typeof limit === "number" ? limit : DEFAULT_COMPLETED_GAME_PAGE_SIZE,
        MAXIMUM_COMPLETED_GAME_PAGE_SIZE,
      ),
      sort,
      status: "parsed",
    };
  } catch {
    return { reason: "invalid-query", status: "rejected" };
  }
}

function toCompletedGameSummary(record: CompletedGameRecord): CompletedGameSummary {
  const { checkpoint } = record;
  return Object.freeze({
    completedAt: record.completedAt,
    gameId: record.gameId,
    moveCount: checkpoint.history.length,
    participants: Object.freeze({
      black: freezeParticipant(checkpoint.configuration.participants.black),
      white: freezeParticipant(checkpoint.configuration.participants.white),
    }),
    result: checkpoint.result ?? record.result,
    revision: checkpoint.revision,
    timeControl: checkpoint.configuration.timeControl,
  });
}

function freezeParticipant(participant: {
  readonly kind: "external-opponent" | "human";
  readonly label?: string;
}) {
  return Object.freeze({
    kind: participant.kind,
    ...(participant.label === undefined ? {} : { label: participant.label }),
  });
}

function compareCompleted(
  left: Pick<CompletedGameSummary, "completedAt" | "gameId">,
  right: Pick<CompletedGameSummary, "completedAt" | "gameId">,
  sort: CompletedGameSort,
): number {
  const timestampComparison = left.completedAt - right.completedAt;
  const gameIdComparison = left.gameId.localeCompare(right.gameId);
  return sort === "completed-asc"
    ? timestampComparison || gameIdComparison
    : -timestampComparison || -gameIdComparison;
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
