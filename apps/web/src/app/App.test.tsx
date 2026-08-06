import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { CaissaApplication } from "../infrastructure/composition";
import type { GamePersistenceResult } from "../application";
import {
  at,
  createControllerFixture,
  createDeferred,
  MemoryGameRepository,
} from "../test/application-service-test-kit";
import { createTestApplication } from "../test/caissa-app-test-kit";

const appBoardSpy = vi.hoisted(() => vi.fn<(options: AppBoardOptions | undefined) => void>());

vi.mock("react-chessboard", () => ({
  Chessboard: ({ options }: { readonly options?: AppBoardOptions }) => {
    appBoardSpy(options);
    return <div data-position={options?.position} data-testid="external-board" />;
  },
}));

interface AppBoardOptions {
  readonly allowDragging?: boolean;
  readonly onPieceDrop?: (event: {
    readonly sourceSquare: string;
    readonly targetSquare: string | null;
  }) => boolean;
  readonly onSquareClick?: (event: { readonly square: string }) => void;
  readonly position?: string;
}

function renderApp(
  path = "/",
  repository = new MemoryGameRepository(),
  options: Parameters<typeof createTestApplication>[1] = {},
) {
  const context = createTestApplication(repository, options);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App application={context.application} />
    </MemoryRouter>,
  );
  return context;
}

function renderInjectedApp(path: string, application: CaissaApplication) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App application={application} />
    </MemoryRouter>,
  );
}

function currentBoardOptions(): AppBoardOptions {
  const options = appBoardSpy.mock.lastCall?.[0];
  if (!options) throw new Error("Expected the external board adapter to render.");
  return options;
}

describe("application startup and routes", () => {
  it("renders a restoring gate before ordinary routes", () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Restoring your board" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Play Chess Beyond the Best Move" }),
    ).not.toBeInTheDocument();
  });

  it("renders the polished home when no active game exists", async () => {
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "Play Chess Beyond the Best Move" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Play a Game" })).toHaveAttribute("href", "/play/new");
    expect(
      screen.getByText(/AI opponents are described below but are not playable yet/i),
    ).toBeVisible();
  });

  it("navigates from home to setup without creating a game", async () => {
    const user = userEvent.setup();
    const { gameRepository } = renderApp();
    await user.click(await screen.findByRole("link", { name: "Play a Game" }));
    expect(await screen.findByRole("heading", { name: "Create a game" })).toBeVisible();
    expect(gameRepository.activeSaves).toHaveLength(0);
  });

  it.each([
    ["/history", "History"],
    ["/settings", "Settings"],
  ])("keeps the %s placeholder reachable", async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
  });

  it("renders a safe not-found route without redirecting", async () => {
    renderApp("/not-a-route");
    expect(
      await screen.findByRole("heading", { name: "This square is outside the board" }),
    ).toBeVisible();
  });

  it("shows a safe empty state at /play without creating a game", async () => {
    const { gameRepository } = renderApp("/play");
    expect(
      await screen.findByRole("heading", { name: "Create a game to see the board" }),
    ).toBeVisible();
    expect(gameRepository.activeSaves).toHaveLength(0);
  });

  it("restores a ready coordinator into /play without starting it", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createControllerFixture({ id: "restored-ready" }).exportCheckpoint();
    renderApp("/play", repository);
    expect(await screen.findByRole("heading", { name: "Ready" })).toBeVisible();
    expect(
      screen.getByText(/this game remains ready and no clock has been started/i),
    ).toBeVisible();
    expect(repository.activeSaves).toHaveLength(0);
  });

  it.each([
    ["active human turn", "active"],
    ["paused game", "paused"],
  ] as const)("restores an %s without issuing another command", async (_label, state) => {
    const repository = new MemoryGameRepository();
    const controller = createControllerFixture({
      id: `restored-${state}`,
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
    controller.start(at(0));
    if (state === "paused") controller.pause(at(1_000));
    const checkpoint = controller.exportCheckpoint();
    repository.active = checkpoint;
    renderApp("/play", repository);
    expect(
      await screen.findByRole("heading", { name: state === "paused" ? "Paused" : "White to move" }),
    ).toBeVisible();
    expect(repository.activeSaves).toHaveLength(0);
    expect(repository.active).toBe(checkpoint);
  });

  it("shows zero without mutation, then lets the controller adjudicate timeout on command", async () => {
    const repository = new MemoryGameRepository();
    const controller = createControllerFixture({
      id: "restored-at-timeout",
      timeControl: { initialMs: 1_000, kind: "sudden-death" },
    });
    controller.start(at(0));
    repository.active = controller.exportCheckpoint();
    renderApp("/play", repository);

    await screen.findByRole("heading", { name: "White to move" });
    expect(screen.getByLabelText("White clock")).toHaveTextContent("0:00");
    expect(repository.finalizations).toHaveLength(0);
    expect(repository.active.lifecycle.phase).toBe("player-turn");

    const board = currentBoardOptions();
    act(() => {
      expect(board.onPieceDrop?.({ sourceSquare: "e2", targetSquare: "e4" })).toBe(false);
    });
    await screen.findByRole("heading", { name: "Black won by timeout" });
    expect(repository.finalizations).toHaveLength(1);
    expect(repository.finalizations[0]?.checkpoint.history).toHaveLength(0);
    expect(repository.active).toBeUndefined();
    expect(screen.getByText(/White's time expired\. Black wins by timeout\./i)).toBeInTheDocument();
  });
});

describe("setup flow", () => {
  it("renders accessible local setup and unavailable AI choices", async () => {
    renderApp("/play/new");
    expect(await screen.findByRole("heading", { name: "Create a game" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Local two-player/i })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /Human-like AI opponent/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Engine opponent/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create Game" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Start Game" })).not.toBeInTheDocument();
  });

  it("allows keyboard selection of time, undo, and orientation", async () => {
    const user = userEvent.setup();
    renderApp("/play/new");
    const tenMinutes = await screen.findByRole("radio", { name: /10 minutes/i });
    await user.click(tenMinutes);
    await user.click(screen.getByRole("checkbox", { name: /Allow undo/i }));
    await user.click(screen.getByRole("radio", { name: /Black/i }));
    expect(tenMinutes).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Allow undo/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Black/i })).toBeChecked();
  });

  it("moves focus to an accessible summary for invalid external form state", async () => {
    renderApp("/play/new");
    await screen.findByRole("heading", { name: "Create a game" });
    const localMode = screen.getByRole("radio", { name: /Local two-player/i });
    const timeControl = screen.getByRole("radio", { name: /^Untimed/i });
    fireEvent.change(localMode, { target: { checked: false } });
    fireEvent.change(timeControl, { target: { checked: false } });
    localMode.removeAttribute("checked");
    timeControl.removeAttribute("checked");
    const form = screen.getByRole("button", { name: "Create Game" }).closest("form");
    if (!form) throw new Error("Expected setup form.");
    for (const radio of within(form).getAllByRole("radio")) {
      if (!radio.hasAttribute("disabled")) fireEvent.change(radio, { target: { checked: false } });
    }
    fireEvent.submit(form);
    const summary = await screen.findByRole("alert");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByRole("group", { name: "Game mode" })).toHaveAttribute(
      "aria-describedby",
      "mode-error",
    );
    expect(screen.getByRole("group", { name: "Time control" })).toHaveAttribute(
      "aria-describedby",
      "time-control-error",
    );
  });

  it("creates a persisted ready game and navigates to the read-only shell", async () => {
    const user = userEvent.setup();
    const { gameRepository } = renderApp("/play/new");
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    expect(await screen.findByRole("heading", { name: "Ready" })).toBeVisible();
    expect(screen.getByTestId("external-board")).toHaveAttribute(
      "data-position",
      expect.stringContaining(" w "),
    );
    expect(gameRepository.activeSaves).toHaveLength(1);
    expect(gameRepository.activeSaves[0]?.lifecycle.phase).toBe("ready");
  });

  it("begins explicitly and submits e2e4 through the interactive shell", async () => {
    const user = userEvent.setup();
    const { gameRepository } = renderApp("/play/new");
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    await screen.findByRole("heading", { name: "Ready" });
    expect(currentBoardOptions().allowDragging).toBe(false);
    expect(currentBoardOptions()).not.toHaveProperty("onSquareClick");

    await user.click(screen.getByRole("button", { name: "Begin Game" }));
    await screen.findByRole("heading", { name: "White to move" });
    expect(currentBoardOptions().allowDragging).toBe(true);

    act(() => currentBoardOptions().onSquareClick?.({ square: "e2" }));
    await waitFor(() => expect(screen.getByText(/2 legal destinations/i)).toBeInTheDocument());
    act(() => currentBoardOptions().onSquareClick?.({ square: "e4" }));

    await screen.findByRole("heading", { name: "Black to move" });
    const history = screen.getByRole("heading", { name: "Move history" }).closest("section");
    if (!history) throw new Error("Expected move-history section.");
    expect(within(history).getByText("e4")).toBeVisible();
    expect(currentBoardOptions().position).toContain(" b ");
    expect(gameRepository.activeSaves).toHaveLength(3);
    expect(gameRepository.activeSaves.at(-1)?.history[0]?.san).toBe("e4");
    expect(screen.getByText(/White played e4\. Black to move\./i)).toBeInTheDocument();
  });

  it("locks duplicate Begin Game input while the authoritative start is saving", async () => {
    const user = userEvent.setup();
    const repository = new MemoryGameRepository();
    renderApp("/play/new", repository);
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    await screen.findByRole("heading", { name: "Ready" });
    const pending = createDeferred<GamePersistenceResult>();
    repository.saveActiveImplementation = () => pending.promise;

    await user.click(screen.getByRole("button", { name: "Begin Game" }));
    const busy = screen.getByRole("button", { name: "Beginning..." });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(repository.activeSaves).toHaveLength(2);
    pending.resolve({ status: "saved" });
    await screen.findByRole("heading", { name: "White to move" });
    expect(repository.activeSaves).toHaveLength(2);
  });

  it("prevents duplicate submission while creation is pending", async () => {
    const repository = new MemoryGameRepository();
    let resolveSave: (() => void) | undefined;
    repository.saveActiveImplementation = () =>
      new Promise((resolve) => {
        resolveSave = () => {
          resolve({ status: "saved" });
        };
      });
    const user = userEvent.setup();
    renderApp("/play/new", repository);
    const submit = await screen.findByRole("button", { name: "Create Game" });
    await user.click(submit);
    expect(screen.getByRole("button", { name: "Creating Game…" })).toBeDisabled();
    expect(repository.activeSaves).toHaveLength(1);
    resolveSave?.();
    await screen.findByRole("heading", { name: "Ready" });
  });

  it("requires explicit replacement confirmation and cancellation preserves the game", async () => {
    const repository = new MemoryGameRepository();
    const prior = createControllerFixture({ id: "keep-current" }).exportCheckpoint();
    repository.active = prior;
    const user = userEvent.setup();
    renderApp("/play/new", repository);
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    const dialog = await screen.findByRole("dialog", { name: "Replace the current active game?" });
    expect(within(dialog).getByText(/Completed history, reviews, preferences/i)).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Keep Current Game" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(repository.active).toBe(prior);
  });

  it("resubmits the explicit replacement and reaches the shell", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createControllerFixture({ id: "replace-current" }).exportCheckpoint();
    const user = userEvent.setup();
    renderApp("/play/new", repository);
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    await user.click(screen.getByRole("button", { name: "Replace and Create New Game" }));
    expect(await screen.findByRole("heading", { name: "Ready" })).toBeVisible();
    expect(repository.active.gameId).not.toBe("replace-current");
  });

  it("navigates created-unsaved games to the shell with an honest warning", async () => {
    const repository = new MemoryGameRepository();
    repository.saveActiveImplementation = () => ({
      error: { code: "quota-exceeded", operation: "active-game.save", retryable: true },
      status: "failed",
    });
    const user = userEvent.setup();
    renderApp("/play/new", repository);
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    expect(
      await screen.findByRole("heading", { name: "Recent progress is not saved" }),
    ).toBeVisible();
    expect(screen.getByText(/could be lost after refresh/i)).toBeVisible();
  });

  it("returns a newly discovered corrupted record to the recovery gate", async () => {
    const repository = new MemoryGameRepository();
    let reads = 0;
    repository.getActiveImplementation = () => {
      reads += 1;
      return reads === 1
        ? { status: "not-found" }
        : {
            corruption: {
              category: "invalid-checkpoint",
              rawRecoveryMayBePossible: true,
              recordKey: "active",
              recordType: "active-game",
            },
            status: "corrupted",
          };
    };
    const user = userEvent.setup();
    renderApp("/play/new", repository);
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    expect(
      await screen.findByRole("heading", { name: "Your saved game needs attention" }),
    ).toBeVisible();
  });

  it.each([
    ["storage-unavailable", "Local storage is unavailable. Caissa did not create the game."],
    ["transaction-failed", "Caissa could not create the game safely. Please try again."],
  ] as const)("presents a safe %s creation failure", async (code, message) => {
    const repository = new MemoryGameRepository();
    let reads = 0;
    repository.getActiveImplementation = () => {
      reads += 1;
      return reads === 1
        ? { status: "not-found" }
        : {
            error: { code, operation: "private.operation", retryable: true },
            status: "failed",
          };
    };
    const user = userEvent.setup();
    renderApp("/play/new", repository);
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent("private.operation");
  });

  it("renders service-level field validation with described controls", async () => {
    const base = createTestApplication().application;
    const application: CaissaApplication = {
      ...base,
      newGameService: {
        createGame: () =>
          Promise.resolve({ fields: ["allowUndo"], status: "invalid-setup" as const }),
        inspectActiveGame: () => Promise.resolve({ status: "absent" as const }),
      },
    };
    const user = userEvent.setup();
    renderInjectedApp("/play/new", application);
    await user.click(await screen.findByRole("button", { name: "Create Game" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose whether undo is allowed.");
    expect(screen.getByRole("group", { name: "Practice options" })).toHaveAttribute(
      "aria-describedby",
      "undo-error",
    );
  });
});

describe("recovery gate", () => {
  function corruptedRepository() {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      corruption: {
        category: "invalid-checkpoint",
        rawRecoveryMayBePossible: true,
        recordKey: "secret-raw-key",
        recordType: "active-game",
      },
      status: "corrupted",
    });
    return repository;
  }

  it("blocks ordinary routes with calm safe recovery copy and no raw payload", async () => {
    renderApp("/play/new", corruptedRepository());
    expect(
      await screen.findByRole("heading", { name: "Your saved game needs attention" }),
    ).toBeVisible();
    expect(screen.queryByText("secret-raw-key")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create a game" })).not.toBeInTheDocument();
  });

  it("retries recovery through the application service", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createControllerFixture({ id: "retry-restoration" }).exportCheckpoint();
    const user = userEvent.setup();
    renderApp("/", repository, {
      createRules: () => {
        throw new Error("simulated rules initialization failure");
      },
    });
    await user.click(await screen.findByRole("button", { name: "Try Again" }));
    await waitFor(() => {
      expect(repository.calls.filter((call) => call === "get-active")).toHaveLength(2);
    });
    expect(screen.getByRole("heading", { name: "Your saved game needs attention" })).toBeVisible();
  });

  it("continue-without-restoring leaves storage untouched and opens ordinary navigation", async () => {
    const repository = corruptedRepository();
    const user = userEvent.setup();
    renderApp("/", repository);
    await user.click(await screen.findByRole("button", { name: "Continue Without Restoring" }));
    expect(
      await screen.findByRole("heading", { name: "Play Chess Beyond the Best Move" }),
    ).toBeVisible();
    expect(repository.calls).not.toContain("clear-active");
  });

  it("requires an accessible confirmation before discarding only the active slot", async () => {
    const repository = corruptedRepository();
    repository.clearActiveImplementation = () => {
      repository.getActiveImplementation = () => ({ status: "not-found" });
      return { status: "cleared" };
    };
    const user = userEvent.setup();
    renderApp("/", repository);
    const trigger = await screen.findByRole("button", { name: "Discard Active Game" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Discard this active game?" });
    expect(
      within(dialog).getByText(/Completed history, reviews, and preferences will remain/i),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(
      within(screen.getByRole("dialog", { name: "Discard this active game?" })).getByRole(
        "button",
        { name: "Discard Active Game" },
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Play Chess Beyond the Best Move" }),
    ).toBeVisible();
    expect(repository.calls).toContain("clear-active");
    expect(repository.calls).not.toContain("clear-completed");
  });

  it("keeps the recovery gate when confirmed discard fails", async () => {
    const repository = corruptedRepository();
    repository.clearActiveImplementation = () => ({
      error: { code: "transaction-failed", operation: "private.discard", retryable: true },
      status: "failed",
    });
    const user = userEvent.setup();
    renderApp("/", repository);
    await user.click(await screen.findByRole("button", { name: "Discard Active Game" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Discard this active game?" })).getByRole(
        "button",
        { name: "Discard Active Game" },
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Caissa could not remove the active game",
    );
    expect(screen.queryByText("private.discard")).not.toBeInTheDocument();
  });

  it.each([
    ["unsupported-record-version", "This saved game cannot be restored here"],
    ["invalid-checkpoint", "Your saved game needs attention"],
  ] as const)("maps %s recovery to approved safe copy", async (category, title) => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      corruption: {
        category,
        rawRecoveryMayBePossible: true,
        recordKey: "active",
        recordType: "active-game",
      },
      status: "corrupted",
    });
    renderApp("/", repository);
    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
  });

  it("maps a terminal active-slot checkpoint to warning recovery copy", async () => {
    const repository = new MemoryGameRepository();
    repository.active = createControllerFixture({
      fen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1",
      id: "terminal-active",
    }).exportCheckpoint();
    renderApp("/", repository);
    expect(
      await screen.findByRole("heading", { name: "This saved game needs attention" }),
    ).toBeVisible();
    expect(screen.getByText(/finished game was found in the active-game slot/i)).toBeVisible();
  });

  it("distinguishes storage unavailable and supports continuation", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      error: { code: "storage-unavailable", operation: "test", retryable: true },
      status: "failed",
    });
    const user = userEvent.setup();
    renderApp("/", repository);
    expect(
      await screen.findByRole("heading", { name: "Local storage is unavailable" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue Without Restoring" }));
    expect(
      await screen.findByRole("heading", { name: "Play Chess Beyond the Best Move" }),
    ).toBeVisible();
  });

  it("retries storage-unavailable startup and enters ordinary routes after recovery", async () => {
    const repository = new MemoryGameRepository();
    let reads = 0;
    repository.getActiveImplementation = () => {
      reads += 1;
      return reads === 1
        ? {
            error: { code: "storage-unavailable", operation: "test", retryable: true },
            status: "failed",
          }
        : { status: "not-found" };
    };
    const user = userEvent.setup();
    renderApp("/", repository);
    await user.click(await screen.findByRole("button", { name: "Try Again" }));
    expect(
      await screen.findByRole("heading", { name: "Play Chess Beyond the Best Move" }),
    ).toBeVisible();
  });

  it("shows a safe unexpected startup failure", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      error: { code: "transaction-failed", operation: "private.detail", retryable: true },
      status: "failed",
    });
    renderApp("/", repository);
    expect(
      await screen.findByRole("heading", { name: "Caissa could not restore this session" }),
    ).toBeVisible();
    expect(screen.queryByText("private.detail")).not.toBeInTheDocument();
  });

  it("allows explicit continuation after an unexpected startup failure", async () => {
    const repository = new MemoryGameRepository();
    repository.getActiveImplementation = () => ({
      error: { code: "transaction-failed", operation: "private.detail", retryable: true },
      status: "failed",
    });
    const user = userEvent.setup();
    renderApp("/", repository);
    await user.click(await screen.findByRole("button", { name: "Continue Without Restoring" }));
    expect(
      await screen.findByRole("heading", { name: "Play Chess Beyond the Best Move" }),
    ).toBeVisible();
  });
});
