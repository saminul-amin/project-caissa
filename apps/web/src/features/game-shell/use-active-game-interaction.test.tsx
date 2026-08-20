import { act, renderHook, waitFor } from "@testing-library/react";
import {
  parseSquare,
  projectClockDisplay,
  type GameLifecycleState,
  type GameSession,
} from "@caissa/chess-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCaissaApp,
  type ActiveGameRuntimeView,
  type CaissaAppActions,
} from "../../app/CaissaAppProvider";
import {
  at,
  createControllerFixture,
  createDeferred,
  humanMove,
} from "../../test/application-service-test-kit";
import {
  getGameInteractionEligibility,
  useActiveGameInteraction,
} from "./use-active-game-interaction";

vi.mock("../../app/CaissaAppProvider", () => ({ useCaissaApp: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("useActiveGameInteraction", () => {
  it("reads the authoritative session and legal moves into an immutable source selection", async () => {
    const controller = activeController();
    const actions = createActions(controller);
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() => result.current.selectSquare(parseSquare("e2")));

    expect(actions.readCurrentLegalMoves).toHaveBeenCalledWith({ from: parseSquare("e2") });
    expect(result.current.session).toBe(activeGame.session);
    expect(result.current.interaction).toMatchObject({
      legalTargets: [parseSquare("e3"), parseSquare("e4")],
      source: parseSquare("e2"),
      status: "source-selected",
    });
    expect(result.current.announcement).toMatch(
      /White pawn on e2 selected\. 2 legal destinations\./,
    );
    expect(Object.isFrozen(result.current.interaction)).toBe(true);
  });

  it("handles empty sources, source replacement, re-selection, and illegal destinations", async () => {
    const controller = activeController();
    const actions = createActions(controller);
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() => result.current.selectSquare(parseSquare("e5")));
    expect(result.current.interaction).toEqual({
      messageKey: "no-legal-moves",
      status: "rejected",
    });

    await act(() => result.current.selectSquare(parseSquare("e2")));
    await act(() => result.current.selectSquare(parseSquare("d2"), "touch"));
    expect(result.current.interaction).toMatchObject({ source: parseSquare("d2") });
    await act(() => result.current.selectSquare(parseSquare("d2")));
    expect(result.current.interaction.status).toBe("idle");

    await act(() => result.current.selectSquare(parseSquare("e2")));
    await act(() => result.current.selectSquare(parseSquare("e5")));
    expect(result.current.interaction).toEqual({
      messageKey: "illegal-destination",
      status: "rejected",
    });
    expect(actions.submitCurrentHumanMove).not.toHaveBeenCalled();
  });

  it("submits one legal click move with the captured authoritative revision", async () => {
    const controller = activeController();
    const move = authoritativeMove();
    const actions = createActions(controller, {
      submitResult: { move, persistence: "saved", status: "applied" },
    });
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() => result.current.selectSquare(parseSquare("e2"), "click"));
    await act(() => result.current.selectSquare(parseSquare("e4"), "click"));

    expect(actions.submitCurrentHumanMove).toHaveBeenCalledOnce();
    expect(actions.submitCurrentHumanMove).toHaveBeenCalledWith({
      expectedRevision: activeGame.session.revision,
      move: { from: parseSquare("e2"), to: parseSquare("e4") },
    });
    expect(result.current.interaction.status).toBe("idle");
    expect(result.current.announcement).toBe("White played e4. Black to move.");
  });

  it("uses the same move path for drag and keyboard intents", async () => {
    const controller = activeController();
    const actions = createActions(controller, {
      submitResult: { move: authoritativeMove(), persistence: "saved", status: "applied" },
    });
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() =>
      result.current.attemptMove({
        from: parseSquare("e2"),
        inputMethod: "drag",
        to: parseSquare("e4"),
      }),
    );
    await act(() =>
      result.current.attemptMove({
        from: parseSquare("e2"),
        inputMethod: "keyboard",
        to: parseSquare("e4"),
      }),
    );
    expect(actions.submitCurrentHumanMove).toHaveBeenCalledTimes(2);
  });

  it("opens promotion from authoritative candidates and submits only the chosen piece", async () => {
    const controller = activeController("7k/P7/8/8/8/8/8/7K w - - 0 1");
    const actions = createActions(controller, {
      submitResult: { move: authoritativeMove(), persistence: "saved", status: "applied" },
    });
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() =>
      result.current.attemptMove({
        from: parseSquare("a7"),
        inputMethod: "touch",
        to: parseSquare("a8"),
      }),
    );
    expect(result.current.interaction).toMatchObject({
      choices: ["queen", "rook", "bishop", "knight"],
      color: "white",
      status: "promotion-required",
    });
    expect(result.current.isInteractive).toBe(false);
    expect(actions.submitCurrentHumanMove).not.toHaveBeenCalled();

    await act(() =>
      result.current.attemptMove({
        from: parseSquare("a7"),
        inputMethod: "drag",
        to: parseSquare("a8"),
      }),
    );
    expect(result.current.interaction.status).toBe("promotion-required");
    expect(result.current.feedback).toBe("operation-in-progress");
    expect(actions.submitCurrentHumanMove).not.toHaveBeenCalled();

    await act(() => result.current.choosePromotion("knight"));
    expect(actions.submitCurrentHumanMove).toHaveBeenCalledWith({
      expectedRevision: activeGame.session.revision,
      move: {
        from: parseSquare("a7"),
        promotion: "knight",
        to: parseSquare("a8"),
      },
    });
  });

  it("cancels promotion without a command or revision change", async () => {
    const controller = activeController("7k/P7/8/8/8/8/8/7K w - - 0 1");
    const actions = createActions(controller);
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));
    const revision = result.current.session.revision;

    await act(() =>
      result.current.attemptMove({
        from: parseSquare("a7"),
        inputMethod: "click",
        to: parseSquare("a8"),
      }),
    );
    act(() => {
      result.current.cancelPromotion();
    });
    expect(result.current.interaction.status).toBe("idle");
    expect(result.current.session.revision).toBe(revision);
    expect(actions.submitCurrentHumanMove).not.toHaveBeenCalled();
  });

  it("maps rejected, failed, and completed submissions without replacing the session", async () => {
    const controller = activeController();
    const activeGame = runtime(controller.getSession());
    const actions = createActions(controller, {
      submitResult: { messageKey: "position-changed", status: "rejected" },
    });
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() =>
      result.current.attemptMove({
        from: parseSquare("e2"),
        inputMethod: "click",
        to: parseSquare("e4"),
      }),
    );
    expect(result.current.interaction).toEqual({
      messageKey: "position-changed",
      status: "rejected",
    });
    expect(result.current.session).toBe(activeGame.session);

    vi.mocked(actions.submitCurrentHumanMove).mockResolvedValueOnce({
      messageKey: "temporarily-unavailable",
      status: "failed",
    });
    await act(() =>
      result.current.attemptMove({
        from: parseSquare("e2"),
        inputMethod: "click",
        to: parseSquare("e4"),
      }),
    );
    expect(result.current.feedback).toBe("temporarily-unavailable");

    vi.mocked(actions.submitCurrentHumanMove).mockResolvedValueOnce({
      expiredColor: undefined,
      move: authoritativeMove(),
      persistence: "finalized",
      result: {
        isDraw: true,
        pgnResult: "1/2-1/2",
        reason: "stalemate",
        status: "draw",
      },
      status: "completed",
    });
    await act(() =>
      result.current.attemptMove({
        from: parseSquare("e2"),
        inputMethod: "click",
        to: parseSquare("e4"),
      }),
    );
    expect(result.current.interaction.status).toBe("idle");
    expect(result.current.announcement).toContain("Game drawn by stalemate.");
  });

  it("prevents duplicate start and move submission while an operation is pending", async () => {
    const controller = activeController();
    const startDeferred =
      createDeferred<Awaited<ReturnType<CaissaAppActions["startCurrentGame"]>>>();
    const moveDeferred =
      createDeferred<Awaited<ReturnType<CaissaAppActions["submitCurrentHumanMove"]>>>();
    const actions = createActions(controller);
    vi.mocked(actions.startCurrentGame).mockReturnValue(startDeferred.promise);
    vi.mocked(actions.submitCurrentHumanMove).mockReturnValue(moveDeferred.promise);
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    let firstStart: Promise<unknown> | undefined;
    act(() => {
      firstStart = result.current.startGame();
    });
    await expect(result.current.startGame()).resolves.toMatchObject({ status: "blocked" });
    expect(actions.startCurrentGame).toHaveBeenCalledOnce();
    startDeferred.resolve({ activeColor: "white", persistence: "saved", status: "applied" });
    await act(async () => {
      await firstStart;
    });

    let firstMove: Promise<unknown> | undefined;
    act(() => {
      firstMove = result.current.attemptMove({
        from: parseSquare("e2"),
        inputMethod: "click",
        to: parseSquare("e4"),
      });
    });
    await act(() =>
      result.current.attemptMove({
        from: parseSquare("e2"),
        inputMethod: "click",
        to: parseSquare("e4"),
      }),
    );
    expect(actions.submitCurrentHumanMove).toHaveBeenCalledOnce();
    moveDeferred.resolve({
      move: authoritativeMove(),
      persistence: "saved",
      status: "applied",
    });
    await act(async () => {
      await firstMove;
    });
  });

  it("clears selection after revision, lifecycle, game, or orientation reconciliation", async () => {
    const first = activeController();
    const actions = createActions(first);
    let activeGame = runtime(first.getSession());
    installContext(actions, activeGame);
    const { result, rerender } = renderHook(({ current }) => useActiveGameInteraction(current), {
      initialProps: { current: activeGame },
    });
    await act(() => result.current.selectSquare(parseSquare("e2")));

    first.submitHumanMove(humanMove("e2e4", 1_100, 1));
    activeGame = runtime(first.getSession());
    installContext(actions, activeGame);
    rerender({ current: activeGame });
    await waitFor(() => {
      expect(result.current.interaction.status).toBe("idle");
    });

    const paused = activeController();
    let pausedRuntime = runtime(paused.getSession());
    installContext(actions, pausedRuntime);
    rerender({ current: pausedRuntime });
    await act(() => result.current.selectSquare(parseSquare("e2")));
    paused.pause(at(1_100));
    pausedRuntime = runtime(paused.getSession());
    installContext(actions, pausedRuntime);
    rerender({ current: pausedRuntime });
    await waitFor(() => {
      expect(result.current.isInteractive).toBe(false);
    });
    expect(result.current.disabledReason).toBe("The game is paused.");
  });

  it("keeps ready, external, terminal, and finalization-pending sessions noninteractive", () => {
    const ready = createControllerFixture();
    const readyRuntime = runtime(ready.getSession());
    const actions = createActions(ready);
    installContext(actions, readyRuntime);
    const { result, rerender } = renderHook(({ current }) => useActiveGameInteraction(current), {
      initialProps: { current: readyRuntime },
    });
    expect(result.current.isInteractive).toBe(false);
    expect(result.current.disabledReason).toMatch(/Begin the game/i);

    const terminal = createControllerFixture({ fen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1" });
    const terminalRuntime = runtime(terminal.getSession());
    installContext(actions, terminalRuntime);
    rerender({ current: terminalRuntime });
    expect(result.current.isInteractive).toBe(false);
    expect(result.current.disabledReason).toBe("This game is complete.");

    const active = activeController();
    const pending = runtime(active.getSession(), {
      error: { code: "transaction-failed", operation: "finalize", retryable: true },
      operation: "finalize-game",
      retryAvailable: true,
      status: "finalization-pending",
      targetRevision: active.getSession().revision,
    });
    installContext(actions, pending);
    rerender({ current: pending });
    expect(result.current.isInteractive).toBe(false);
    expect(result.current.disabledReason).toMatch(/waiting to be saved/i);
  });

  it.each([
    [{ phase: "creating" }, "prepared"],
    [{ phase: "ready" }, "Begin the game"],
    [{ phase: "opponent-turn" }, "other participant"],
    [{ phase: "awaiting-opponent" }, "other participant"],
    [{ phase: "committing" }, "being committed"],
    [{ phase: "paused", resumePhase: "player-turn" }, "paused"],
    [{ phase: "degraded" }, "unavailable"],
    [{ phase: "completed" }, "complete"],
    [{ phase: "abandoned" }, "abandoned"],
    [{ failure: { code: "unexpected-failure" }, phase: "recovery" }, "needs recovery"],
    [{ failure: { code: "unexpected-failure" }, phase: "failed" }, "needs recovery"],
  ] satisfies readonly (readonly [GameLifecycleState, string])[])(
    "explains the noninteractive $phase lifecycle without exposing enum copy",
    (lifecycle, expected) => {
      const session = activeController().getSession();
      const eligibility = getGameInteractionEligibility(
        { ...session, lifecycle },
        {
          retryAvailable: false,
          status: "clean",
        },
      );
      expect(eligibility.enabled).toBe(false);
      expect(eligibility.reason).toContain(expected);
    },
  );

  it("allows only a human player-turn and rejects a non-human side defensively", () => {
    const human = activeController().getSession();
    expect(
      getGameInteractionEligibility(human, { retryAvailable: false, status: "clean" }),
    ).toEqual({ enabled: true });

    const external = createControllerFixture({ white: "external-opponent" }).getSession();
    expect(
      getGameInteractionEligibility(
        { ...external, lifecycle: { phase: "player-turn" } },
        { retryAvailable: false, status: "clean" },
      ),
    ).toEqual({ enabled: false, reason: "Waiting for the other participant." });
  });

  it("starts through the bounded action and keeps persistence retry available", async () => {
    const controller = createControllerFixture();
    const actions = createActions(controller, {
      startResult: { activeColor: "white", persistence: "unsaved", status: "applied" },
    });
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() => result.current.startGame());
    await act(() => result.current.retryPersistence());
    expect(actions.startCurrentGame).toHaveBeenCalledOnce();
    expect(actions.retryCurrentGamePersistence).toHaveBeenCalledOnce();
    expect(result.current.announcement).toBe("White to move.");
  });

  it("announces completed and rejected start outcomes with safe copy", async () => {
    const controller = createControllerFixture();
    const actions = createActions(controller, {
      startResult: {
        persistence: "finalized",
        result: {
          isDraw: true,
          pgnResult: "1/2-1/2",
          reason: "stalemate",
          status: "draw",
        },
        status: "completed",
      },
    });
    const activeGame = runtime(controller.getSession());
    installContext(actions, activeGame);
    const { result } = renderHook(() => useActiveGameInteraction(activeGame));

    await act(() => result.current.startGame());
    expect(result.current.announcement).toBe("Game drawn by stalemate.");

    vi.mocked(actions.startCurrentGame).mockResolvedValueOnce({
      persistence: "finalized",
      result: { isDraw: false, reason: "abandoned", status: "abandoned" },
      status: "completed",
    });
    await act(() => result.current.startGame());
    expect(result.current.announcement).toBe("Game abandoned.");

    vi.mocked(actions.startCurrentGame).mockResolvedValueOnce({
      messageKey: "game-not-started",
      status: "rejected",
    });
    await act(() => result.current.startGame());
    expect(result.current.feedback).toBe("game-not-started");
    expect(result.current.announcement).toContain("Begin the game");
  });
});

type Controller = ReturnType<typeof createControllerFixture>;

function activeController(fen?: string): Controller {
  const controller = createControllerFixture(fen ? { fen } : {});
  controller.start(at(1_000));
  return controller;
}

function runtime(
  session: GameSession,
  persistence: ActiveGameRuntimeView["persistence"] = {
    retryAvailable: false,
    status: "clean",
  },
): ActiveGameRuntimeView {
  return {
    hasExternalOpponent: false,
    opponentProfileId: undefined,
    orientation: "white",
    persistence,
    projectClock: () => projectClockDisplay(session.clock, at(1_000)),
    session,
  };
}

function authoritativeMove() {
  const controller = activeController();
  controller.submitHumanMove(humanMove("e2e4", 1_100, 1));
  const move = controller.getSession().history[0];
  if (!move) throw new Error("Expected committed fixture move.");
  return move;
}

function createActions(
  controller: Controller,
  results: {
    readonly startResult?: Awaited<ReturnType<CaissaAppActions["startCurrentGame"]>>;
    readonly submitResult?: Awaited<ReturnType<CaissaAppActions["submitCurrentHumanMove"]>>;
  } = {},
): CaissaAppActions {
  return {
    abandonCurrentGame: vi.fn<CaissaAppActions["abandonCurrentGame"]>(() =>
      Promise.resolve({ control: "abandon", messageKey: "invalid-state", status: "rejected" }),
    ),
    confirmActiveGameReplacement: vi.fn<CaissaAppActions["confirmActiveGameReplacement"]>(() =>
      Promise.resolve({ status: "created" }),
    ),
    continueWithoutRestoring: vi.fn(),
    createNewGame: vi.fn<CaissaAppActions["createNewGame"]>(() =>
      Promise.resolve({ status: "created" }),
    ),
    discardActiveGame: vi.fn<CaissaAppActions["discardActiveGame"]>(() =>
      Promise.resolve("discarded"),
    ),
    pauseCurrentGame: vi.fn<CaissaAppActions["pauseCurrentGame"]>(() =>
      Promise.resolve({ control: "pause", messageKey: "invalid-state", status: "rejected" }),
    ),
    readCurrentLegalMoves: vi.fn<CaissaAppActions["readCurrentLegalMoves"]>((query) =>
      controller.getLegalMoves(query),
    ),
    restartCurrentGame: vi.fn<CaissaAppActions["restartCurrentGame"]>(() =>
      Promise.resolve({ control: "restart", messageKey: "invalid-state", status: "rejected" }),
    ),
    resumeCurrentGame: vi.fn<CaissaAppActions["resumeCurrentGame"]>(() =>
      Promise.resolve({ control: "resume", messageKey: "invalid-state", status: "rejected" }),
    ),
    retryCurrentGamePersistence: vi.fn<CaissaAppActions["retryCurrentGamePersistence"]>(() =>
      Promise.resolve("succeeded"),
    ),
    exportCurrentGamePgn: vi.fn(() => '[Event "Caissa"]'),
    retryOpponentTurn: vi.fn(() => Promise.resolve()),
    retryStartup: vi.fn(() => Promise.resolve()),
    startCurrentGame: vi.fn<CaissaAppActions["startCurrentGame"]>(() =>
      Promise.resolve(
        results.startResult ??
          ({
            activeColor: "white",
            persistence: "saved",
            status: "applied",
          } as const),
      ),
    ),
    submitCurrentHumanMove: vi.fn<CaissaAppActions["submitCurrentHumanMove"]>(() =>
      Promise.resolve(
        results.submitResult ??
          ({
            messageKey: "temporarily-unavailable",
            status: "failed",
          } as const),
      ),
    ),
    undoCurrentGameMoves: vi.fn<CaissaAppActions["undoCurrentGameMoves"]>(() =>
      Promise.resolve({ control: "undo-one", messageKey: "invalid-state", status: "rejected" }),
    ),
  };
}

function installContext(actions: CaissaAppActions, activeGame: ActiveGameRuntimeView): void {
  vi.mocked(useCaissaApp).mockReturnValue({
    actions,
    activeGame,
    application: {} as never,
    opponentStatus: { kind: "idle" },
    startup: { status: "restored" },
  });
}
