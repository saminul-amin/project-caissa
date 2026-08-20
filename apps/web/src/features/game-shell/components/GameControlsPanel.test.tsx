import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { GameControlUiResult, PendingGameControl } from "../../../app/game-runtime-results";
import type { ActiveGameControls } from "../use-active-game-controls";
import { GameControlsPanel } from "./GameControlsPanel";

describe("GameControlsPanel", () => {
  it("presents the bounded active-game controls and delegates each intent once", async () => {
    const user = userEvent.setup();
    const controls = controlFixture();
    render(<GameControlsPanel controls={controls} isPaused={false} />);

    expect(screen.getByRole("region", { name: "Manage this game" })).toBeVisible();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Pause",
      "Undo last move",
      "Undo last two plies",
      "Restart game",
      "End game",
    ]);
    expect(screen.getByRole("button", { name: "End game" })).toHaveClass("button-destructive");
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Undo last move" }));
    await user.click(screen.getByRole("button", { name: "Undo last two plies" }));
    await user.click(screen.getByRole("button", { name: "Restart game" }));
    await user.click(screen.getByRole("button", { name: "End game" }));

    expect(controls.pauseGame).toHaveBeenCalledTimes(1);
    expect(controls.requestUndoMoves).toHaveBeenNthCalledWith(1, 1);
    expect(controls.requestUndoMoves).toHaveBeenNthCalledWith(2, 2);
    expect(controls.requestRestart).toHaveBeenCalledTimes(1);
    expect(controls.requestAbandon).toHaveBeenCalledTimes(1);
  });

  it("shows resume in a paused game and exposes unavailable reasons", async () => {
    const user = userEvent.setup();
    const controls = controlFixture({
      availability: {
        ...allAvailable,
        undoOne: {
          available: false,
          message: "Resume the game before undoing.",
          reason: "resume-before-undo",
        },
      },
    });
    render(<GameControlsPanel controls={controls} isPaused />);

    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(controls.resumeGame).toHaveBeenCalledTimes(1);

    const undo = screen.getByRole("button", { name: "Undo last move" });
    expect(undo).toHaveAttribute("aria-disabled", "true");
    expect(undo).toHaveAccessibleDescription("Resume the game before undoing.");
    await user.click(undo);
    expect(controls.requestUndoMoves).not.toHaveBeenCalled();
  });

  it("locks every command and announces the exact pending control", () => {
    const controls = controlFixture({ pendingControl: "undo-two" });
    render(<GameControlsPanel controls={controls} isPaused={false} />);

    const region = screen.getByRole("region", { name: "Manage this game" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(within(region).getByRole("status")).toHaveTextContent("Undoing");
    for (const button of within(region).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it.each([
    ["restart", "Restart this game?", "Restart game"],
    ["abandon", "End this game?", "End game"],
  ] as const)("renders a safe %s confirmation", async (kind, title, confirmLabel) => {
    const user = userEvent.setup();
    const controls = controlFixture({ confirmation: { kind } });
    render(<GameControlsPanel controls={controls} isPaused={false} />);

    const dialog = screen.getByRole("dialog", { name: title });
    expect(dialog).toHaveAccessibleDescription();
    expect(within(dialog).getByRole("button", { name: "Keep current game" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: confirmLabel }));
    expect(controls.confirmControl).toHaveBeenCalledTimes(1);
  });

  it("explains that completed-game undo reopens the game", () => {
    const controls = controlFixture({
      confirmation: { kind: "undo-completed", plies: 2 },
    });
    render(<GameControlsPanel controls={controls} isPaused={false} />);
    expect(screen.getByRole("dialog", { name: "Reopen this completed game?" })).toHaveTextContent(
      "reopens the completed game",
    );
  });

  it("keeps a confirmed mutation modal and its underlying controls locked while busy", () => {
    const controls = controlFixture({
      confirmation: { kind: "abandon" },
      pendingControl: "abandon",
    });
    render(<GameControlsPanel controls={controls} isPaused={false} />);
    const dialog = screen.getByRole("dialog", { name: "End this game?" });
    expect(dialog).toHaveAttribute("aria-busy", "true");
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});

const allAvailable = Object.freeze({
  abandon: { available: true as const },
  pause: { available: true as const },
  restart: { available: true as const },
  resume: { available: true as const },
  undoOne: { available: true as const },
  undoTwo: { available: true as const },
});

function controlFixture(overrides: Partial<ActiveGameControls> = {}): ActiveGameControls {
  return {
    announcement: "",
    availability: allAvailable,
    confirmation: undefined,
    feedback: undefined,
    focusStatusRequest: 0,
    isLocked: overrides.pendingControl !== undefined || overrides.confirmation !== undefined,
    pendingControl: undefined,
    abandonGame: vi.fn(() => Promise.resolve(failedResult("abandon"))),
    cancelConfirmation: vi.fn(),
    confirmControl: vi.fn(() => Promise.resolve()),
    pauseGame: vi.fn(() => Promise.resolve(failedResult("pause"))),
    requestAbandon: vi.fn(),
    requestRestart: vi.fn(),
    requestUndoMoves: vi.fn(() => Promise.resolve()),
    restartGame: vi.fn(() => Promise.resolve(failedResult("restart"))),
    resumeGame: vi.fn(() => Promise.resolve(failedResult("resume"))),
    retryPersistence: vi.fn(() => Promise.resolve()),
    undoMoves: vi.fn(() => Promise.resolve(failedResult("undo-one"))),
    ...overrides,
  };
}

function failedResult(control: PendingGameControl): GameControlUiResult {
  return { control, messageKey: "temporarily-unavailable", status: "failed" };
}
