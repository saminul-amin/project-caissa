import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  projectClockDisplay,
  type ClockDisplayProjectionResult,
  type GameSession,
  type LegalMove,
  type LegalMoveQuery,
  type UndoPlyCount,
} from "@caissa/chess-core";

import {
  DEFAULT_OPPONENT_PROFILE_ID,
  DISCARD_ACTIVE_GAME_CONFIRMATION,
  REPLACE_ACTIVE_GAME_CONFIRMATION,
  createRecoveryReadModel,
  isOpponentProfileId,
  type OpponentProfileId,
  type OpponentRuntimeStatus,
  type CreateNewGameCommand,
  type NewGameSetup,
  type NewGameSetupField,
  type RecoveryReadModel,
  type SessionPersistenceState,
  type UserPreferences,
  DEFAULT_USER_PREFERENCES,
  type GameSessionCoordinator,
  type GameOperationResult,
} from "../application";
import {
  createBrowserCaissaApplication,
  type CaissaApplication,
} from "../infrastructure/composition";
import {
  mapGameControlOperationResult,
  mapMoveOperationResult,
  mapStartOperationResult,
} from "./game-runtime-results";
import type {
  GameControlUiResult,
  MoveSubmissionUiResult,
  PendingGameControl,
  StartGameUiResult,
  SubmitCurrentHumanMoveCommand,
} from "./game-runtime-results";

export type AppStartupViewState =
  | { readonly status: "restoring" }
  | { readonly status: "no-active-game" }
  | { readonly status: "restored" }
  | { readonly recovery: RecoveryReadModel; readonly status: "recovery-required" }
  | { readonly status: "storage-unavailable" }
  | { readonly status: "failed" };

export interface ActiveGameRuntimeView {
  readonly hasExternalOpponent: boolean;
  readonly opponentProfileId: OpponentProfileId | undefined;
  readonly orientation: "black" | "white";
  readonly persistence: SessionPersistenceState;
  readonly session: GameSession;
  projectClock(): ClockDisplayProjectionResult;
}

export type CreateGameActionResult =
  | { readonly status: "created" | "created-unsaved" }
  | { readonly status: "active-game-exists" | "active-game-recovery-required" }
  | { readonly fields: readonly NewGameSetupField[]; readonly status: "invalid-setup" }
  | { readonly status: "storage-unavailable" | "failed" };

export interface CaissaAppActions {
  readonly abandonCurrentGame: () => Promise<GameControlUiResult>;
  readonly confirmActiveGameReplacement: (setup: NewGameSetup) => Promise<CreateGameActionResult>;
  readonly continueWithoutRestoring: () => void;
  readonly createNewGame: (command: CreateNewGameCommand) => Promise<CreateGameActionResult>;
  readonly discardActiveGame: () => Promise<"discarded" | "failed">;
  readonly exportCurrentGamePgn: () => string | undefined;
  readonly pauseCurrentGame: () => Promise<GameControlUiResult>;
  readonly readCurrentLegalMoves: (query?: LegalMoveQuery) => readonly LegalMove[];
  readonly restartCurrentGame: () => Promise<GameControlUiResult>;
  readonly resumeCurrentGame: () => Promise<GameControlUiResult>;
  readonly retryCurrentGamePersistence: () => Promise<"nothing-pending" | "succeeded" | "failed">;
  readonly resetPreferences: () => Promise<"failed" | "saved">;
  readonly retryOpponentTurn: () => Promise<void>;
  readonly savePreferences: (preferences: UserPreferences) => Promise<"failed" | "saved">;
  readonly retryStartup: () => Promise<void>;
  readonly startCurrentGame: () => Promise<StartGameUiResult>;
  readonly submitCurrentHumanMove: (
    command: SubmitCurrentHumanMoveCommand,
  ) => Promise<MoveSubmissionUiResult>;
  readonly undoCurrentGameMoves: (plies: UndoPlyCount) => Promise<GameControlUiResult>;
}

export interface CaissaAppContextValue {
  readonly actions: CaissaAppActions;
  readonly activeGame: ActiveGameRuntimeView | undefined;
  readonly application: CaissaApplication;
  readonly opponentStatus: OpponentRuntimeStatus;
  readonly preferences: UserPreferences;
  readonly startup: AppStartupViewState;
}

interface RuntimeOwner {
  readonly coordinator: GameSessionCoordinator;
  readonly orientation: "black" | "white";
}

interface CaissaAppProviderProps extends PropsWithChildren {
  readonly application?: CaissaApplication;
  readonly createApplication?: () => CaissaApplication;
}

const CaissaAppContext = createContext<CaissaAppContextValue | undefined>(undefined);

const pendingOwnedApplications = new WeakMap<() => CaissaApplication, CaissaApplication>();

function createOwnedApplicationOnce(factory: () => CaissaApplication): CaissaApplication {
  const pending = pendingOwnedApplications.get(factory);
  if (pending) return pending;

  const application = factory();
  pendingOwnedApplications.set(factory, application);
  queueMicrotask(() => pendingOwnedApplications.delete(factory));
  return application;
}

export function CaissaAppProvider({
  application: injectedApplication,
  children,
  createApplication = createBrowserCaissaApplication,
}: CaissaAppProviderProps) {
  const [application] = useState(
    () => injectedApplication ?? createOwnedApplicationOnce(createApplication),
  );
  const ownsApplication = injectedApplication === undefined;
  const [startup, setStartup] = useState<AppStartupViewState>({ status: "restoring" });
  const [opponentStatus, setOpponentStatus] = useState<OpponentRuntimeStatus>(() =>
    application.opponentRuntime.getStatus(),
  );
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [runtime, setRuntime] = useState<RuntimeOwner | undefined>();
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const mounted = useRef(false);
  const startupStarted = useRef(false);
  const startupRequest = useRef(0);
  const runtimeRef = useRef<RuntimeOwner | undefined>(runtime);
  const pendingMutation = useRef<GameSessionCoordinator | undefined>(undefined);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => application.opponentRuntime.subscribe(setOpponentStatus), [application]);

  useEffect(() => {
    let cancelled = false;
    void application.preferencesService.load().then((result) => {
      if (!cancelled) setPreferences(result.preferences);
    });
    return () => {
      cancelled = true;
    };
  }, [application]);

  const replaceRuntime = useCallback(
    (next: RuntimeOwner | undefined) => {
      application.opponentRuntime.cancel();
      runtimeRef.current = next;
      setRuntime(next);
    },
    [application],
  );

  const restore = useCallback(
    async (useRecoveryService = false): Promise<void> => {
      const request = startupRequest.current + 1;
      startupRequest.current = request;
      setStartup({ status: "restoring" });
      const result = useRecoveryService
        ? await application.recoveryService.retryRestoration()
        : await application.startupService.restoreActiveGame();
      if (!mounted.current || startupRequest.current !== request) return;

      if (result.status === "restored") {
        replaceRuntime({ coordinator: result.coordinator, orientation: "white" });
        setRuntimeVersion((value) => value + 1);
      }
      setStartup(toStartupView(result));
    },
    [application, replaceRuntime],
  );

  useEffect(() => {
    mounted.current = true;
    if (!startupStarted.current) {
      startupStarted.current = true;
      void restore();
    }

    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current && ownsApplication) application.close();
      });
    };
  }, [application, ownsApplication, restore]);

  const createGame = useCallback(
    async (command: CreateNewGameCommand): Promise<CreateGameActionResult> => {
      const result = await application.newGameService.createGame(command);
      if (result.status === "created" || result.status === "created-unsaved") {
        replaceRuntime({ coordinator: result.coordinator, orientation: result.orientation });
        setRuntimeVersion((value) => value + 1);
        return Object.freeze({ status: result.status });
      }
      if (result.status === "active-game-recovery-required") {
        await restore();
        return Object.freeze({ status: result.status });
      }
      if (result.status === "invalid-setup") {
        return Object.freeze({ fields: result.fields, status: result.status });
      }
      return Object.freeze({ status: result.status });
    },
    [application, replaceRuntime, restore],
  );

  const runGameControl = useCallback(
    async (
      control: PendingGameControl,
      invoke: (owner: RuntimeOwner) => Promise<GameOperationResult>,
    ): Promise<GameControlUiResult> => {
      const owner = runtimeRef.current;
      if (!owner) {
        return Object.freeze({
          control,
          messageKey: "no-active-game",
          status: "failed",
        });
      }
      if (pendingMutation.current === owner.coordinator) {
        return Object.freeze({
          control,
          messageKey: "operation-in-progress",
          status: "blocked",
        });
      }

      pendingMutation.current = owner.coordinator;
      try {
        const result = await invoke(owner);
        if (runtimeRef.current !== owner) {
          return Object.freeze({
            control,
            messageKey: "position-changed",
            status: "rejected",
          });
        }
        setRuntimeVersion((value) => value + 1);
        return mapGameControlOperationResult(control, result);
      } finally {
        if (pendingMutation.current === owner.coordinator) pendingMutation.current = undefined;
      }
    },
    [],
  );

  const runOpponentTurn = useCallback(async (): Promise<void> => {
    const owner = runtimeRef.current;
    if (!owner) return;
    if (pendingMutation.current === owner.coordinator) return;

    const session = owner.coordinator.getSession();
    if (session.lifecycle.phase !== "opponent-turn" && session.lifecycle.phase !== "degraded") {
      return;
    }

    pendingMutation.current = owner.coordinator;
    try {
      await application.opponentRuntime.runTurn({
        coordinator: owner.coordinator,
        profileId: readOpponentProfileId(session) ?? DEFAULT_OPPONENT_PROFILE_ID,
      });
    } finally {
      if (pendingMutation.current === owner.coordinator) pendingMutation.current = undefined;
      if (runtimeRef.current === owner && mounted.current) {
        setRuntimeVersion((value) => value + 1);
      }
    }
  }, [application]);

  const activeGame = useMemo<ActiveGameRuntimeView | undefined>(() => {
    void runtimeVersion;
    if (!runtime) return undefined;
    const session = runtime.coordinator.getSession();
    return Object.freeze({
      hasExternalOpponent: hasExternalOpponent(session),
      opponentProfileId: readOpponentProfileId(session),
      orientation: runtime.orientation,
      persistence: runtime.coordinator.getPersistenceState(),
      projectClock: () =>
        projectClockDisplay(
          runtime.coordinator.getSession().clock,
          application.monotonicClock.now(),
        ),
      session,
    });
  }, [application, runtime, runtimeVersion]);

  const opponentTurnPending =
    activeGame !== undefined &&
    activeGame.hasExternalOpponent &&
    activeGame.session.lifecycle.phase === "opponent-turn";

  useEffect(() => {
    if (!opponentTurnPending) return;
    void runOpponentTurn();
  }, [opponentTurnPending, runOpponentTurn, runtimeVersion]);

  useEffect(
    () => () => {
      application.opponentRuntime.cancel();
    },
    [application, runtime],
  );

  const actions = useMemo<CaissaAppActions>(
    () => ({
      abandonCurrentGame() {
        return runGameControl("abandon", (owner) =>
          owner.coordinator.abandon({ now: application.monotonicClock.now() }),
        );
      },
      confirmActiveGameReplacement(setup) {
        return createGame({
          replaceActiveGame: REPLACE_ACTIVE_GAME_CONFIRMATION,
          setup,
        });
      },
      continueWithoutRestoring() {
        application.recoveryService.continueWithoutRestoring();
        replaceRuntime(undefined);
        setStartup({ status: "no-active-game" });
      },
      createNewGame(command) {
        return createGame(command);
      },
      async discardActiveGame() {
        const result = await application.recoveryService.discardActiveGame({
          confirmation: DISCARD_ACTIVE_GAME_CONFIRMATION,
        });
        if (result.status !== "discarded") return "failed";
        replaceRuntime(undefined);
        setStartup({ status: "no-active-game" });
        return "discarded";
      },
      exportCurrentGamePgn() {
        const owner = runtimeRef.current;
        if (!owner) return undefined;
        try {
          return String(owner.coordinator.exportPgn());
        } catch {
          return undefined;
        }
      },
      async retryCurrentGamePersistence() {
        const owner = runtimeRef.current;
        if (!owner) return "nothing-pending";
        const result = await owner.coordinator.retryPersistence();
        if (runtimeRef.current !== owner) return result.status;
        setRuntimeVersion((value) => value + 1);
        return result.status;
      },
      pauseCurrentGame() {
        return runGameControl("pause", (owner) =>
          owner.coordinator.pause(application.monotonicClock.now()),
        );
      },
      readCurrentLegalMoves(query) {
        return runtimeRef.current?.coordinator.getLegalMoves(query) ?? Object.freeze([]);
      },
      restartCurrentGame() {
        return runGameControl("restart", (owner) =>
          owner.coordinator.restart({
            expectedRevision: owner.coordinator.getSession().revision,
          }),
        );
      },
      resumeCurrentGame() {
        return runGameControl("resume", (owner) =>
          owner.coordinator.resume(application.monotonicClock.now()),
        );
      },
      async resetPreferences() {
        const result = await application.preferencesService.reset();
        if (result.status !== "saved") return "failed";
        setPreferences(result.preferences);
        return "saved";
      },
      retryOpponentTurn() {
        return runOpponentTurn();
      },
      async savePreferences(next) {
        const result = await application.preferencesService.save(next);
        if (result.status !== "saved") return "failed";
        setPreferences(result.preferences);
        return "saved";
      },
      retryStartup() {
        return restore(true);
      },
      async startCurrentGame() {
        const owner = runtimeRef.current;
        if (!owner) return Object.freeze({ messageKey: "no-active-game", status: "failed" });
        if (pendingMutation.current === owner.coordinator) {
          return Object.freeze({
            messageKey: "operation-in-progress",
            status: "blocked",
          });
        }
        pendingMutation.current = owner.coordinator;
        try {
          const result = await owner.coordinator.start(application.monotonicClock.now());
          if (runtimeRef.current !== owner) {
            return Object.freeze({ messageKey: "position-changed", status: "rejected" });
          }
          setRuntimeVersion((value) => value + 1);
          return mapStartOperationResult(result);
        } finally {
          if (pendingMutation.current === owner.coordinator) pendingMutation.current = undefined;
        }
      },
      async submitCurrentHumanMove(command) {
        const owner = runtimeRef.current;
        if (!owner) return Object.freeze({ messageKey: "no-active-game", status: "failed" });
        if (pendingMutation.current === owner.coordinator) {
          return Object.freeze({
            messageKey: "operation-in-progress",
            status: "blocked",
          });
        }
        pendingMutation.current = owner.coordinator;
        try {
          const result = await owner.coordinator.submitHumanMove({
            expectedRevision: command.expectedRevision,
            move: command.move,
            now: application.monotonicClock.now(),
          });
          if (runtimeRef.current !== owner) {
            return Object.freeze({ messageKey: "position-changed", status: "rejected" });
          }
          setRuntimeVersion((value) => value + 1);
          return mapMoveOperationResult(result);
        } finally {
          if (pendingMutation.current === owner.coordinator) pendingMutation.current = undefined;
        }
      },
      undoCurrentGameMoves(plies) {
        return runGameControl(plies === 1 ? "undo-one" : "undo-two", (owner) =>
          owner.coordinator.undoMoves({
            expectedRevision: owner.coordinator.getSession().revision,
            now: application.monotonicClock.now(),
            plies,
          }),
        );
      },
    }),
    [application, createGame, replaceRuntime, restore, runGameControl, runOpponentTurn],
  );

  const value: CaissaAppContextValue = {
    actions,
    activeGame,
    application,
    opponentStatus,
    preferences,
    startup,
  };

  return <CaissaAppContext.Provider value={value}>{children}</CaissaAppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook is the provider's public facade.
export function useCaissaApp(): CaissaAppContextValue {
  const value = useContext(CaissaAppContext);
  if (!value) throw new Error("useCaissaApp must be used within CaissaAppProvider.");
  return value;
}

function hasExternalOpponent(session: GameSession): boolean {
  const { participants } = session.configuration;
  return (
    participants.white.kind === "external-opponent" ||
    participants.black.kind === "external-opponent"
  );
}

function readOpponentProfileId(session: GameSession): OpponentProfileId | undefined {
  const { participants } = session.configuration;
  const external =
    participants.white.kind === "external-opponent" ? participants.white : participants.black;
  return isOpponentProfileId(external.profile) ? external.profile : undefined;
}

function toStartupView(
  result: Awaited<ReturnType<CaissaApplication["startupService"]["restoreActiveGame"]>>,
): AppStartupViewState {
  switch (result.status) {
    case "no-active-game":
      return Object.freeze({ status: "no-active-game" });
    case "restored":
      return Object.freeze({ status: "restored" });
    case "recovery-required":
      return Object.freeze({
        recovery: createRecoveryReadModel(result.recovery),
        status: "recovery-required",
      });
    case "storage-unavailable":
      return Object.freeze({ status: "storage-unavailable" });
    case "failed":
      return Object.freeze({ status: "failed" });
  }
}
