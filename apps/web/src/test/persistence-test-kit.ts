import {
  ChessJsRulesAdapter,
  createGameController,
  moveInputFromUci,
  parseGameId,
  parseMonotonicTimestampMs,
  parsePgn,
  parseRequestId,
  parseUciMove,
  type GameController,
  type GameSessionCheckpoint,
} from "@caissa/chess-core";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

import {
  ANALYSIS_CACHE_SCHEMA_VERSION,
  REVIEW_SCHEMA_VERSION,
  createAnalysisCacheKey,
  parseEpochTimestampMs,
  type AnalysisCacheEntry,
  type CompletedGameRecord,
  type EpochTimestampMs,
  type ReviewGenerationStatus,
  type StoredReviewRecord,
  type WallClock,
} from "../application/persistence";
import {
  createCaissaDatabase,
  createPersistenceRepositories,
  openCaissaDatabase,
  type CaissaDatabase,
  type PersistenceRepositorySet,
} from "../infrastructure/persistence";

let databaseSequence = 0;

export class FixedWallClock implements WallClock {
  constructor(private current: EpochTimestampMs = parseEpochTimestampMs(1_000)) {}

  nowEpochMs(): EpochTimestampMs {
    return this.current;
  }

  set(value: number): void {
    this.current = parseEpochTimestampMs(value);
  }
}

export interface PersistenceTestContext extends PersistenceRepositorySet {
  readonly wallClock: FixedWallClock;
}

export async function createPersistenceTestContext(): Promise<PersistenceTestContext> {
  databaseSequence += 1;
  const database = createCaissaDatabase({
    IDBKeyRange,
    indexedDB: new IDBFactory(),
    name: `caissa-test-${String(databaseSequence)}`,
  });
  const opened = await openCaissaDatabase(database);
  if (opened.status !== "opened") throw new Error(`Database failed to open: ${opened.error.code}`);

  const wallClock = new FixedWallClock();
  return Object.freeze({ ...createPersistenceRepositories({ database, wallClock }), wallClock });
}

export async function destroyPersistenceTestContext(database: CaissaDatabase): Promise<void> {
  await database.delete();
}

export function createCheckpoint(
  phase: "awaiting-opponent" | "human-turn" | "opponent-turn" | "paused" | "ready",
  id = `fixture-${phase}`,
): GameSessionCheckpoint {
  const isOpponentFirst = phase === "opponent-turn" || phase === "awaiting-opponent";
  const controller = createController(id, isOpponentFirst);
  if (phase === "ready") return controller.exportCheckpoint();

  requireApplied(controller.start(parseMonotonicTimestampMs(0)));
  if (phase === "awaiting-opponent") {
    requireApplied(controller.requestOpponentMove({ requestId: parseRequestId(`request-${id}`) }));
  }
  if (phase === "paused") {
    requireApplied(controller.pause(parseMonotonicTimestampMs(10)));
  }
  return controller.exportCheckpoint();
}

export function createAbandonedRecord(
  id: string,
  completedAt: number,
  revisionCycles = 0,
): CompletedGameRecord {
  const controller = createController(id, false);
  requireApplied(controller.start(parseMonotonicTimestampMs(0)));
  for (let cycle = 0; cycle < revisionCycles; cycle += 1) {
    requireApplied(controller.pause(parseMonotonicTimestampMs(cycle * 2 + 1)));
    requireApplied(controller.resume(parseMonotonicTimestampMs(cycle * 2 + 2)));
  }
  requireApplied(controller.abandon({ now: parseMonotonicTimestampMs(revisionCycles * 2 + 3) }));
  return completedRecord(controller.exportCheckpoint(), completedAt, '[Result "*"]\n\n*');
}

export function createCheckmateRecord(id: string, completedAt: number): CompletedGameRecord {
  const controller = createController(id, false);
  requireApplied(controller.start(parseMonotonicTimestampMs(0)));
  commitHumanMove(controller, "f2f3", 1);
  commitHumanMove(controller, "e7e5", 2);
  commitHumanMove(controller, "g2g4", 3);
  commitHumanMove(controller, "d8h4", 4);
  return completedRecord(
    controller.exportCheckpoint(),
    completedAt,
    '[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
  );
}

export function createReviewRecord(
  id: string,
  status: ReviewGenerationStatus = "not-started",
  updatedAt = 2_000,
): StoredReviewRecord {
  return Object.freeze({
    gameId: parseGameId(id),
    provenance: Object.freeze([
      Object.freeze({ identifier: "rules-v1", provider: "deterministic" as const, version: "1" }),
    ]),
    reviewVersion: REVIEW_SCHEMA_VERSION,
    status,
    updatedAt: parseEpochTimestampMs(updatedAt),
    ...(status === "not-started" ? {} : { generatedAt: parseEpochTimestampMs(updatedAt - 100) }),
  });
}

export function createCacheEntry(
  options: {
    readonly analysisProfile?: string;
    readonly engineVersion?: string;
    readonly expiresAt?: number;
    readonly payload?: AnalysisCacheEntry["payload"];
  } = {},
): AnalysisCacheEntry {
  const identity = Object.freeze({
    analysisProfile: options.analysisProfile ?? "quick-v1",
    configurationVersion: "configuration-v1",
    engineId: "test-engine",
    engineVersion: options.engineVersion ?? "1.0.0",
    fen: new ChessJsRulesAdapter().createInitialPosition().fen,
  });
  return Object.freeze({
    cacheVersion: ANALYSIS_CACHE_SCHEMA_VERSION,
    createdAt: parseEpochTimestampMs(1_000),
    identity,
    key: createAnalysisCacheKey(identity),
    payload:
      options.payload ?? Object.freeze({ candidates: Object.freeze(["e2e4"]), kind: "fixture" }),
    ...(options.expiresAt === undefined
      ? {}
      : { expiresAt: parseEpochTimestampMs(options.expiresAt) }),
  });
}

function createController(id: string, externalWhite: boolean): GameController {
  return createGameController({
    configuration: {
      allowUndo: true,
      gameId: id,
      initialPosition: { kind: "standard" },
      participants: {
        black: { kind: "human" },
        white: { kind: externalWhite ? "external-opponent" : "human" },
      },
      timeControl: { kind: "untimed" },
    },
    rules: new ChessJsRulesAdapter(),
  });
}

function completedRecord(
  checkpoint: GameSessionCheckpoint,
  completedAt: number,
  pgn: string,
): CompletedGameRecord {
  if (!checkpoint.result) throw new Error("Fixture checkpoint is not terminal.");
  return Object.freeze({
    checkpoint,
    completedAt: parseEpochTimestampMs(completedAt),
    gameId: checkpoint.gameId,
    pgn: parsePgn(pgn),
    result: checkpoint.result,
    startedAt: parseEpochTimestampMs(Math.max(0, completedAt - 500)),
  });
}

function commitHumanMove(controller: GameController, uci: string, now: number): void {
  requireApplied(
    controller.submitHumanMove({
      move: moveInputFromUci(parseUciMove(uci)),
      now: parseMonotonicTimestampMs(now),
    }),
  );
}

function requireApplied(result: { readonly status: string }): void {
  if (result.status !== "applied" && result.status !== "completed") {
    throw new Error(`Fixture transition failed: ${result.status}`);
  }
}
