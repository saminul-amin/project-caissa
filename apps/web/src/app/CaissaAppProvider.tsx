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
} from "@caissa/chess-core";

import {
  DISCARD_ACTIVE_GAME_CONFIRMATION,
  REPLACE_ACTIVE_GAME_CONFIRMATION,
  createRecoveryReadModel,
  type CreateNewGameCommand,
  type NewGameSetup,
  type NewGameSetupField,
  type RecoveryReadModel,
  type SessionPersistenceState,
  type GameSessionCoordinator,
} from "../application";
import {
  createBrowserCaissaApplication,
  type CaissaApplication,
} from "../infrastructure/composition";

export type AppStartupViewState =
  | { readonly status: "restoring" }
  | { readonly status: "no-active-game" }
  | { readonly status: "restored" }
  | { readonly recovery: RecoveryReadModel; readonly status: "recovery-required" }
  | { readonly status: "storage-unavailable" }
  | { readonly status: "failed" };

export interface ActiveGameRuntimeView {
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
  confirmActiveGameReplacement(setup: NewGameSetup): Promise<CreateGameActionResult>;
  continueWithoutRestoring(): void;
  createNewGame(command: CreateNewGameCommand): Promise<CreateGameActionResult>;
  discardActiveGame(): Promise<"discarded" | "failed">;
  retryCurrentGamePersistence(): Promise<"nothing-pending" | "succeeded" | "failed">;
  retryStartup(): Promise<void>;
}

export interface CaissaAppContextValue {
  readonly actions: CaissaAppActions;
  readonly activeGame: ActiveGameRuntimeView | undefined;
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
  const [runtime, setRuntime] = useState<RuntimeOwner | undefined>();
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const mounted = useRef(false);
  const startupStarted = useRef(false);
  const startupRequest = useRef(0);

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
        setRuntime({ coordinator: result.coordinator, orientation: "white" });
        setRuntimeVersion((value) => value + 1);
      }
      setStartup(toStartupView(result));
    },
    [application],
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
        setRuntime({ coordinator: result.coordinator, orientation: result.orientation });
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
    [application, restore],
  );

  const actions = useMemo<CaissaAppActions>(
    () => ({
      confirmActiveGameReplacement(setup) {
        return createGame({
          replaceActiveGame: REPLACE_ACTIVE_GAME_CONFIRMATION,
          setup,
        });
      },
      continueWithoutRestoring() {
        application.recoveryService.continueWithoutRestoring();
        setRuntime(undefined);
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
        setRuntime(undefined);
        setStartup({ status: "no-active-game" });
        return "discarded";
      },
      async retryCurrentGamePersistence() {
        if (!runtime) return "nothing-pending";
        const result = await runtime.coordinator.retryPersistence();
        setRuntimeVersion((value) => value + 1);
        return result.status;
      },
      retryStartup() {
        return restore(true);
      },
    }),
    [application, createGame, restore, runtime],
  );

  const activeGame = useMemo<ActiveGameRuntimeView | undefined>(() => {
    void runtimeVersion;
    if (!runtime) return undefined;
    return Object.freeze({
      orientation: runtime.orientation,
      persistence: runtime.coordinator.getPersistenceState(),
      projectClock: () =>
        projectClockDisplay(
          runtime.coordinator.getSession().clock,
          application.monotonicClock.now(),
        ),
      session: runtime.coordinator.getSession(),
    });
  }, [application, runtime, runtimeVersion]);

  const value: CaissaAppContextValue = { actions, activeGame, startup };

  return <CaissaAppContext.Provider value={value}>{children}</CaissaAppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook is the provider's public facade.
export function useCaissaApp(): CaissaAppContextValue {
  const value = useContext(CaissaAppContext);
  if (!value) throw new Error("useCaissaApp must be used within CaissaAppProvider.");
  return value;
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
