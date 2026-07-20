import {
  restoreGameController,
  type ChessRulesPort,
  type GameRestorationRejectionReason,
  type GameSession,
} from "@caissa/chess-core";

import {
  createGameSessionCoordinator,
  type CreateGameSessionCoordinatorOptions,
  type GameSessionCoordinator,
  type SessionPersistenceState,
} from "../game-session";
import type {
  CorruptedRecordMetadata,
  EpochTimestampMs,
  GameRepository,
  PersistenceError,
  WallClock,
} from "../persistence";

export type StartupRecoveryCategory =
  | CorruptedRecordMetadata["category"]
  | GameRestorationRejectionReason
  | "terminal-session-in-active-slot";

export interface StartupRecoveryMetadata {
  readonly category: StartupRecoveryCategory;
  readonly deletionAvailable: true;
  readonly rawRecoveryMayBePossible: boolean;
  readonly recordKey: string;
  readonly retryMeaningful: boolean;
}

export interface StartupRestorationMetadata {
  readonly recordUpdatedAt: EpochTimestampMs;
  readonly restoredRevision: GameSession["revision"];
}

export type GameStartupState =
  | { readonly status: "idle" }
  | { readonly status: "restoring" }
  | { readonly status: "no-active-game" }
  | {
      readonly coordinator: GameSessionCoordinator;
      readonly metadata: StartupRestorationMetadata;
      readonly persistence: SessionPersistenceState;
      readonly session: GameSession;
      readonly status: "restored";
    }
  | {
      readonly recovery: StartupRecoveryMetadata;
      readonly status: "recovery-required";
    }
  | {
      readonly error: PersistenceError;
      readonly status: "storage-unavailable";
    }
  | {
      readonly error: PersistenceError;
      readonly status: "failed";
    };

export type GameStartupResult = Exclude<
  GameStartupState,
  { readonly status: "idle" | "restoring" }
>;

export interface GameStartupService {
  getState(): GameStartupState;
  restoreActiveGame(): Promise<GameStartupResult>;
}

export interface CreateGameStartupServiceOptions {
  readonly createCoordinator?: (
    options: CreateGameSessionCoordinatorOptions,
  ) => GameSessionCoordinator;
  readonly createRules: () => ChessRulesPort;
  readonly gameRepository: GameRepository;
  readonly wallClock: WallClock;
}

const activeRecordKey = "active";

export function createGameStartupService(
  options: CreateGameStartupServiceOptions,
): GameStartupService {
  return new DefaultGameStartupService(options);
}

class DefaultGameStartupService implements GameStartupService {
  private readonly createCoordinator: NonNullable<
    CreateGameStartupServiceOptions["createCoordinator"]
  >;
  private readonly createRules: () => ChessRulesPort;
  private readonly gameRepository: GameRepository;
  private readonly wallClock: WallClock;
  private state: GameStartupState = Object.freeze({ status: "idle" });

  constructor(options: CreateGameStartupServiceOptions) {
    this.createCoordinator = options.createCoordinator ?? createGameSessionCoordinator;
    this.createRules = options.createRules;
    this.gameRepository = options.gameRepository;
    this.wallClock = options.wallClock;
  }

  getState(): GameStartupState {
    return this.state;
  }

  async restoreActiveGame(): Promise<GameStartupResult> {
    this.state = Object.freeze({ status: "restoring" });
    let read: Awaited<ReturnType<GameRepository["getActiveGame"]>>;
    try {
      read = await this.gameRepository.getActiveGame();
    } catch {
      return this.setResult({
        error: safePersistenceError("storage-unavailable", "active-game.startup-read", true),
        status: "storage-unavailable",
      });
    }

    if (read.status === "not-found") {
      return this.setResult({ status: "no-active-game" });
    }
    if (read.status === "corrupted") {
      return this.setResult({
        recovery: recoveryFromCorruption(read.corruption),
        status: "recovery-required",
      });
    }
    if (read.status === "failed") {
      const error = freezePersistenceError(read.error);
      return isStorageUnavailable(error)
        ? this.setResult({ error, status: "storage-unavailable" })
        : this.setResult({ error, status: "failed" });
    }

    const restored = restoreGameController({
      checkpoint: read.checkpoint,
      createRules: this.createRules,
    });
    if (restored.status === "rejected") {
      return this.setResult({
        recovery: restorationRecovery(restored.reason),
        status: "recovery-required",
      });
    }
    if (
      restored.session.lifecycle.phase === "completed" ||
      restored.session.lifecycle.phase === "abandoned"
    ) {
      return this.setResult({
        recovery: Object.freeze({
          category: "terminal-session-in-active-slot",
          deletionAvailable: true,
          rawRecoveryMayBePossible: true,
          recordKey: activeRecordKey,
          retryMeaningful: false,
        }),
        status: "recovery-required",
      });
    }

    const coordinator = this.createCoordinator({
      controller: restored.controller,
      gameRepository: this.gameRepository,
      lastPersistedRevision: restored.session.revision,
      wallClock: this.wallClock,
    });
    const session = coordinator.getSession();
    return this.setResult({
      coordinator,
      metadata: Object.freeze({
        recordUpdatedAt: read.updatedAt,
        restoredRevision: session.revision,
      }),
      persistence: coordinator.getPersistenceState(),
      session,
      status: "restored",
    });
  }

  private setResult(result: GameStartupResult): GameStartupResult {
    this.state = Object.freeze(result);
    return this.state;
  }
}

function recoveryFromCorruption(corruption: CorruptedRecordMetadata): StartupRecoveryMetadata {
  return Object.freeze({
    category: corruption.category,
    deletionAvailable: true,
    rawRecoveryMayBePossible: corruption.rawRecoveryMayBePossible,
    recordKey: safeRecordKey(corruption.recordKey),
    retryMeaningful: false,
  });
}

function restorationRecovery(reason: GameRestorationRejectionReason): StartupRecoveryMetadata {
  return Object.freeze({
    category: reason,
    deletionAvailable: true,
    rawRecoveryMayBePossible: true,
    recordKey: activeRecordKey,
    retryMeaningful: reason === "internal-restoration-failure",
  });
}

function safeRecordKey(value: string): string {
  return value === activeRecordKey ? activeRecordKey : "active-record";
}

function isStorageUnavailable(error: PersistenceError): boolean {
  return error.code === "storage-unavailable" || error.code === "database-closed";
}

function freezePersistenceError(error: PersistenceError): PersistenceError {
  return safePersistenceError(error.code, error.operation, error.retryable);
}

function safePersistenceError(
  code: PersistenceError["code"],
  operation: string,
  retryable: boolean,
): PersistenceError {
  return Object.freeze({ code, operation, retryable });
}
