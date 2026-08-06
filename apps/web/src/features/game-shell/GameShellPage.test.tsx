import { projectClockDisplay, type ClockDisplayProjectionResult } from "@caissa/chess-core";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActiveGameRuntimeView } from "../../app/CaissaAppProvider";
import { at, createControllerFixture, humanMove } from "../../test/application-service-test-kit";
import { ActiveGameShell } from "./GameShellPage";

vi.mock("react-chessboard", () => ({ Chessboard: () => <div data-testid="board" /> }));

afterEach(() => vi.useRealTimers());

function runtime(
  controller = createControllerFixture(),
  persistence: ActiveGameRuntimeView["persistence"] = { retryAvailable: false, status: "clean" },
  orientation: ActiveGameRuntimeView["orientation"] = "white",
): ActiveGameRuntimeView {
  return {
    orientation,
    persistence,
    projectClock: () => projectClockDisplay(controller.getSession().clock, at(1_000)),
    session: controller.getSession(),
  };
}

describe("ActiveGameShell", () => {
  it("renders a ready board, players, clocks, configuration, and empty history", () => {
    const controller = createControllerFixture({
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
    render(
      <ActiveGameShell
        activeGame={runtime(controller)}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByRole("heading", { name: "Ready" })).toBeVisible();
    expect(screen.getByRole("img", { name: /White orientation/i })).toBeVisible();
    expect(screen.getByLabelText("White clock")).toHaveTextContent("5:00");
    expect(screen.getByLabelText("Black clock")).toHaveTextContent("5:00");
    expect(screen.getByText("No moves yet. The game is ready.")).toBeVisible();
    expect(screen.getAllByText("Human player")).toHaveLength(2);
  });

  it("renders untimed clocks and black orientation", () => {
    render(
      <ActiveGameShell
        activeGame={runtime(createControllerFixture(), undefined, "black")}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByRole("img", { name: /Black orientation/i })).toBeVisible();
    expect(screen.getAllByText("Untimed").length).toBeGreaterThanOrEqual(2);
  });

  it("renders SAN move history, move numbers, and the last move announcement", () => {
    const controller = createControllerFixture();
    controller.start(at(0));
    controller.submitHumanMove(humanMove("e2e4", 1));
    controller.submitHumanMove(humanMove("e7e5", 2));
    render(
      <ActiveGameShell
        activeGame={runtime(controller)}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByText("e4")).toBeVisible();
    expect(screen.getByText("e5")).toBeVisible();
    expect(screen.getByText(/Last move: e5/)).toBeVisible();
  });

  it("announces check and exposes FEN only inside position diagnostics", () => {
    const controller = createControllerFixture({ fen: "7k/8/8/8/8/8/7R/4K3 b - - 0 1" });
    render(
      <ActiveGameShell
        activeGame={runtime(controller)}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Black to move and in check");
    expect(screen.getByText(controller.getSession().position.fen)).toBeInTheDocument();
  });

  it("renders paused stored time without consuming it", () => {
    const controller = createControllerFixture({
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
    controller.start(at(0));
    controller.pause(at(1_000));
    render(
      <ActiveGameShell
        activeGame={runtime(controller)}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByRole("heading", { name: "Paused" })).toBeVisible();
    expect(screen.getByLabelText("White clock")).toHaveTextContent("4:59");
  });

  it("ticks a running display from read-only projections and cleans up", () => {
    vi.useFakeTimers();
    const controller = createControllerFixture({
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
    controller.start(at(0));
    let now = 1_000;
    const active = runtime(controller);
    active.projectClock = () => projectClockDisplay(controller.getSession().clock, at(now));
    const clear = vi.spyOn(window, "clearInterval");
    const view = render(
      <ActiveGameShell activeGame={active} onRetry={() => Promise.resolve("nothing-pending")} />,
    );
    expect(screen.getByLabelText("White clock")).toHaveTextContent("4:59");
    now = 2_000;
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByLabelText("White clock")).toHaveTextContent("4:58");
    view.unmount();
    expect(clear).toHaveBeenCalled();
  });

  it("falls back to stored remaining values when a restored monotonic timestamp regresses", () => {
    const controller = createControllerFixture({
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
    controller.start(at(5_000));
    const active = runtime(controller);
    active.projectClock = () =>
      ({
        reason: "timestamp-regression",
        state: controller.getSession().clock,
        status: "rejected",
      }) satisfies ClockDisplayProjectionResult;
    render(
      <ActiveGameShell activeGame={active} onRetry={() => Promise.resolve("nothing-pending")} />,
    );
    expect(screen.getByLabelText("White clock")).toHaveTextContent("5:00");
  });

  it("keeps the clean persistence state quiet", () => {
    render(
      <ActiveGameShell activeGame={runtime()} onRetry={() => Promise.resolve("nothing-pending")} />,
    );
    expect(screen.queryByText(/Recent progress is not saved/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry Save" })).not.toBeInTheDocument();
  });

  it("renders unsaved and finalization-pending warnings with one bounded retry action", async () => {
    const retry = vi.fn(() => Promise.resolve("succeeded" as const));
    const controller = createControllerFixture();
    const revision = controller.getSession().revision;
    const { rerender } = render(
      <ActiveGameShell
        activeGame={runtime(controller, {
          error: { code: "quota-exceeded", operation: "save", retryable: true },
          operation: "save-active-game",
          retryAvailable: true,
          status: "unsaved",
          targetRevision: revision,
        })}
        onRetry={retry}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry Save" }));
    expect(retry).toHaveBeenCalledTimes(1);
    rerender(
      <ActiveGameShell
        activeGame={runtime(controller, {
          error: { code: "transaction-failed", operation: "finalize", retryable: true },
          operation: "finalize-game",
          retryAvailable: true,
          status: "finalization-pending",
          targetRevision: revision,
        })}
        onRetry={retry}
      />,
    );
    expect(screen.getByRole("heading", { name: "History save is pending" })).toBeVisible();
    expect(screen.getByText(/chess result remains unchanged/i)).toBeVisible();
  });

  it("shows saving as a subtle status without gameplay controls", () => {
    const controller = createControllerFixture();
    render(
      <ActiveGameShell
        activeGame={runtime(controller, {
          operation: "save-active-game",
          retryAvailable: false,
          status: "saving",
          targetRevision: controller.getSession().revision,
        })}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByText("Saving this game locally…")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Undo|Pause|Restart|Abandon|Move/i }),
    ).not.toBeInTheDocument();
  });

  it("renders authoritative completed and abandoned results with no raw lifecycle enum", () => {
    const checkmate = createControllerFixture({ fen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1" });
    const { rerender } = render(
      <ActiveGameShell
        activeGame={runtime(checkmate)}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByRole("heading", { name: "White won by checkmate" })).toBeVisible();

    const abandoned = createControllerFixture();
    abandoned.abandon({ now: at(0) });
    rerender(
      <ActiveGameShell
        activeGame={runtime(abandoned)}
        onRetry={() => Promise.resolve("nothing-pending")}
      />,
    );
    expect(screen.getByRole("heading", { name: "Abandoned" })).toBeVisible();
    expect(screen.queryByText("completed")).not.toBeInTheDocument();
  });
});
