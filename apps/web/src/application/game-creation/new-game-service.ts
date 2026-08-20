import {
  createGameController,
  parseClockDurationMs,
  parseClockIncrementMs,
  type ChessRulesPort,
  type Color,
  type GameController,
  type GameId,
  type GameSession,
  type TimeControl,
} from "@caissa/chess-core";

import {
  DEFAULT_OPPONENT_PROFILE_ID,
  findOpponentProfile,
  isOpponentProfileId,
  type OpponentProfileId,
} from "../opponent";
import {
  createGameSessionCoordinator,
  type CreateGameSessionCoordinatorOptions,
  type GameSessionCoordinator,
  type SessionPersistenceState,
} from "../game-session";
import type { GameRepository, PersistenceError, WallClock } from "../persistence";

export const REPLACE_ACTIVE_GAME_CONFIRMATION = "replace-active-game" as const;

export type ReplaceActiveGameConfirmation = typeof REPLACE_ACTIVE_GAME_CONFIRMATION;
export type NewGameMode = "engine" | "local-human-vs-human";
export type BoardOrientation = Color;
export type TimeControlOptionId = "untimed" | "3-plus-2" | "5-minutes" | "10-minutes";

export interface TimeControlOption {
  readonly description: string;
  readonly id: TimeControlOptionId;
  readonly label: string;
  readonly timeControl: TimeControl;
}

export const TIME_CONTROL_OPTIONS: readonly TimeControlOption[] = Object.freeze([
  timeControlOption("untimed", "Untimed", "Play without a running clock.", { kind: "untimed" }),
  timeControlOption(
    "3-plus-2",
    "3 minutes + 2 seconds",
    "Three minutes per side with two seconds added after each move.",
    {
      incrementMs: parseClockIncrementMs(2_000),
      initialMs: parseClockDurationMs(180_000),
      kind: "increment",
    },
  ),
  timeControlOption("5-minutes", "5 minutes", "Five minutes per side.", {
    initialMs: parseClockDurationMs(300_000),
    kind: "sudden-death",
  }),
  timeControlOption("10-minutes", "10 minutes", "Ten minutes per side.", {
    initialMs: parseClockDurationMs(600_000),
    kind: "sudden-death",
  }),
]);

export interface NewGameSetup {
  readonly allowUndo: boolean;
  readonly mode: NewGameMode;
  /** Only meaningful for engine games; ignored for local two-player games. */
  readonly opponentProfileId: OpponentProfileId;
  readonly orientation: BoardOrientation;
  readonly timeControlId: TimeControlOptionId;
}

export const DEFAULT_NEW_GAME_SETUP: NewGameSetup = Object.freeze({
  allowUndo: true,
  mode: "engine",
  opponentProfileId: DEFAULT_OPPONENT_PROFILE_ID,
  orientation: "white",
  timeControlId: "10-minutes",
});

export interface CreateNewGameCommand {
  readonly replaceActiveGame?: ReplaceActiveGameConfirmation;
  readonly setup: NewGameSetup;
}

export interface GameIdGenerator {
  create(): GameId;
}

export type ActiveGamePresenceResult =
  | { readonly status: "absent" }
  | { readonly status: "present" }
  | { readonly status: "recovery-required" }
  | { readonly status: "storage-unavailable" }
  | { readonly status: "failed" };

export interface CreatedGameRuntime {
  readonly coordinator: GameSessionCoordinator;
  readonly orientation: BoardOrientation;
  readonly persistence: SessionPersistenceState;
  readonly replacedActiveGame: boolean;
  readonly session: GameSession;
}

export type CreateNewGameResult =
  | ({ readonly status: "created" } & CreatedGameRuntime)
  | ({
      readonly durabilityWarning: "not-saved-for-refresh";
      readonly status: "created-unsaved";
    } & CreatedGameRuntime)
  | { readonly status: "active-game-exists" }
  | { readonly status: "active-game-recovery-required" }
  | { readonly fields: readonly NewGameSetupField[]; readonly status: "invalid-setup" }
  | { readonly status: "storage-unavailable" }
  | { readonly status: "failed" };

export type NewGameSetupField =
  "allowUndo" | "mode" | "opponentProfileId" | "orientation" | "timeControlId";

export interface NewGameService {
  inspectActiveGame(): Promise<ActiveGamePresenceResult>;
  createGame(command: CreateNewGameCommand): Promise<CreateNewGameResult>;
}

export interface CreateNewGameServiceOptions {
  readonly createController?: (options: {
    readonly configuration: unknown;
    readonly rules: ChessRulesPort;
  }) => GameController;
  readonly createCoordinator?: (
    options: CreateGameSessionCoordinatorOptions,
  ) => GameSessionCoordinator;
  readonly createRules: () => ChessRulesPort;
  readonly gameIdGenerator: GameIdGenerator;
  readonly gameRepository: GameRepository;
  readonly wallClock: WallClock;
}

export function createNewGameService(options: CreateNewGameServiceOptions): NewGameService {
  return new DefaultNewGameService(options);
}

class DefaultNewGameService implements NewGameService {
  private readonly createController: NonNullable<CreateNewGameServiceOptions["createController"]>;
  private readonly createCoordinator: NonNullable<CreateNewGameServiceOptions["createCoordinator"]>;

  constructor(private readonly options: CreateNewGameServiceOptions) {
    this.createController = options.createController ?? createGameController;
    this.createCoordinator = options.createCoordinator ?? createGameSessionCoordinator;
  }

  async inspectActiveGame(): Promise<ActiveGamePresenceResult> {
    const read = await this.readActiveGame();
    switch (read.status) {
      case "not-found":
        return Object.freeze({ status: "absent" });
      case "found":
        return Object.freeze({ status: "present" });
      case "corrupted":
        return Object.freeze({ status: "recovery-required" });
      case "failed":
        return Object.freeze({
          status: isStorageUnavailable(read.error) ? "storage-unavailable" : "failed",
        });
    }
  }

  async createGame(command: CreateNewGameCommand): Promise<CreateNewGameResult> {
    const validation = validateNewGameSetup(command.setup);
    if (validation.status === "invalid") {
      return Object.freeze({ fields: validation.fields, status: "invalid-setup" });
    }

    const active = await this.readActiveGame();
    if (active.status === "corrupted") {
      return Object.freeze({ status: "active-game-recovery-required" });
    }
    if (active.status === "failed") {
      return Object.freeze({
        status: isStorageUnavailable(active.error) ? "storage-unavailable" : "failed",
      });
    }
    const replacing = active.status === "found";
    if (replacing && command.replaceActiveGame !== REPLACE_ACTIVE_GAME_CONFIRMATION) {
      return Object.freeze({ status: "active-game-exists" });
    }

    let controller: GameController;
    try {
      const option = optionById(validation.setup.timeControlId);
      controller = this.createController({
        configuration: {
          allowUndo: validation.setup.allowUndo,
          gameId: this.options.gameIdGenerator.create(),
          initialPosition: { kind: "standard" },
          participants: buildParticipants(validation.setup),
          timeControl: option.timeControl,
        },
        rules: this.options.createRules(),
      });
    } catch {
      return Object.freeze({ status: "failed" });
    }

    const checkpoint = controller.exportCheckpoint();
    let save: Awaited<ReturnType<GameRepository["saveActiveGame"]>>;
    try {
      save = await this.options.gameRepository.saveActiveGame(checkpoint);
    } catch {
      save = { error: unknownStorageError(), status: "failed" };
    }

    if (save.status === "rejected") {
      return Object.freeze({ status: "failed" });
    }

    const coordinator = this.createCoordinator({
      controller,
      gameRepository: this.options.gameRepository,
      ...(save.status === "saved"
        ? { lastPersistedRevision: checkpoint.revision }
        : { initialActiveSaveFailure: freezeError(save.error) }),
      wallClock: this.options.wallClock,
    });
    const runtime = Object.freeze({
      coordinator,
      orientation: validation.setup.orientation,
      persistence: coordinator.getPersistenceState(),
      replacedActiveGame: replacing,
      session: coordinator.getSession(),
    });

    return save.status === "saved"
      ? Object.freeze({ ...runtime, status: "created" as const })
      : Object.freeze({
          ...runtime,
          durabilityWarning: "not-saved-for-refresh" as const,
          status: "created-unsaved" as const,
        });
  }

  private async readActiveGame(): Promise<Awaited<ReturnType<GameRepository["getActiveGame"]>>> {
    try {
      return await this.options.gameRepository.getActiveGame();
    } catch {
      return { error: unknownStorageError(), status: "failed" };
    }
  }
}

type SetupValidation =
  | { readonly setup: NewGameSetup; readonly status: "valid" }
  | { readonly fields: readonly NewGameSetupField[]; readonly status: "invalid" };

export function validateNewGameSetup(value: unknown): SetupValidation {
  if (!isRecord(value)) {
    return Object.freeze({
      fields: Object.freeze([
        "mode",
        "timeControlId",
        "allowUndo",
        "orientation",
      ] as const satisfies readonly NewGameSetupField[]),
      status: "invalid",
    });
  }
  const fields: NewGameSetupField[] = [];
  if (value.mode !== "local-human-vs-human" && value.mode !== "engine") fields.push("mode");
  if (!isTimeControlOptionId(value.timeControlId)) fields.push("timeControlId");
  if (typeof value.allowUndo !== "boolean") fields.push("allowUndo");
  if (value.orientation !== "white" && value.orientation !== "black") fields.push("orientation");
  if (!isOpponentProfileId(value.opponentProfileId)) fields.push("opponentProfileId");
  if (fields.length > 0) {
    return Object.freeze({ fields: Object.freeze(fields), status: "invalid" });
  }
  return Object.freeze({
    setup: Object.freeze({
      allowUndo: value.allowUndo as boolean,
      mode: value.mode as NewGameMode,
      opponentProfileId: value.opponentProfileId as OpponentProfileId,
      orientation: value.orientation as BoardOrientation,
      timeControlId: value.timeControlId as TimeControlOptionId,
    }),
    status: "valid",
  });
}

/**
 * The human always plays the chosen board orientation in an engine game, so the board a
 * player looks at and the side they control can never disagree.
 */
export function buildParticipants(setup: NewGameSetup): {
  readonly black: {
    readonly kind: "external-opponent" | "human";
    readonly label: string;
    readonly profile?: string;
  };
  readonly white: {
    readonly kind: "external-opponent" | "human";
    readonly label: string;
    readonly profile?: string;
  };
} {
  if (setup.mode === "local-human-vs-human") {
    return Object.freeze({
      black: Object.freeze({ kind: "human" as const, label: "Black" }),
      white: Object.freeze({ kind: "human" as const, label: "White" }),
    });
  }

  const profile = findOpponentProfile(setup.opponentProfileId);
  const engine = Object.freeze({
    kind: "external-opponent" as const,
    label: `Caissa ${profile.label}`,
    profile: profile.id,
  });
  const human = Object.freeze({ kind: "human" as const, label: "You" });

  return setup.orientation === "white"
    ? Object.freeze({ black: engine, white: human })
    : Object.freeze({ black: human, white: engine });
}

function timeControlOption(
  id: TimeControlOptionId,
  label: string,
  description: string,
  timeControl: TimeControl,
): TimeControlOption {
  return Object.freeze({ description, id, label, timeControl: Object.freeze(timeControl) });
}

function isTimeControlOptionId(value: unknown): value is TimeControlOptionId {
  return TIME_CONTROL_OPTIONS.some((option) => option.id === value);
}

function optionById(id: TimeControlOptionId): TimeControlOption {
  const option = TIME_CONTROL_OPTIONS.find((candidate) => candidate.id === id);
  if (!option) throw new Error("Validated time-control option is unavailable.");
  return option;
}

function isStorageUnavailable(error: PersistenceError): boolean {
  return error.code === "storage-unavailable" || error.code === "database-closed";
}

function unknownStorageError(): PersistenceError {
  return Object.freeze({
    code: "unknown-storage-error",
    operation: "active-game.create",
    retryable: true,
  });
}

function freezeError(error: PersistenceError): PersistenceError {
  return Object.freeze({
    code: error.code,
    operation: error.operation,
    retryable: error.retryable,
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
