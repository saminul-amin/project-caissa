import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseFen, parseSquare } from "@caissa/chess-core";
import { describe, expect, it, vi } from "vitest";

import { KeyboardChessBoard } from "./KeyboardChessBoard";

const initialFen = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

function renderBoard(
  options: Partial<{
    readonly disabled: boolean;
    readonly orientation: "black" | "white";
  }> = {},
) {
  const onActivate = vi.fn();
  const onClearSelection = vi.fn();
  render(
    <KeyboardChessBoard
      disabled={options.disabled ?? false}
      fen={initialFen}
      legalTargets={[parseSquare("e3"), parseSquare("e4")]}
      onActivate={onActivate}
      onClearSelection={onClearSelection}
      orientation={options.orientation ?? "white"}
      selectedSource={parseSquare("e2")}
    />,
  );
  return { onActivate, onClearSelection };
}

describe("KeyboardChessBoard", () => {
  it("represents all squares in a named semantic grid with one roving tab stop", () => {
    renderBoard();
    expect(
      screen.getByRole("grid", { name: /keyboard chessboard, white orientation/i }),
    ).toBeVisible();
    const squares = screen.getAllByRole("gridcell");
    expect(squares).toHaveLength(64);
    expect(squares.filter((square) => square.tabIndex === 0)).toHaveLength(1);
    expect(screen.getByRole("gridcell", { name: "White pawn on e2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("gridcell", { name: "Empty square e4" })).toBeInTheDocument();
  });

  it("moves focus in visual directions for White orientation", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.tab();
    expect(screen.getByRole("gridcell", { name: "Black rook on a8" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("gridcell", { name: "Black knight on b8" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowDown}");
    expect(screen.getByRole("gridcell", { name: "Black pawn on a7" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("gridcell", { name: "Black rook on a8" })).toHaveFocus();
  });

  it("reverses visual navigation for Black orientation", async () => {
    const user = userEvent.setup();
    renderBoard({ orientation: "black" });
    await user.tab();
    expect(screen.getByRole("gridcell", { name: "White rook on h1" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("gridcell", { name: "White knight on g1" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("gridcell", { name: "White pawn on g2" })).toHaveFocus();
  });

  it("uses Enter and Space for the shared activation path and Escape to clear", async () => {
    const user = userEvent.setup();
    const { onActivate, onClearSelection } = renderBoard();
    await user.tab();
    await user.keyboard("{Enter} {Escape}");
    expect(onActivate).toHaveBeenCalledTimes(2);
    expect(onActivate).toHaveBeenCalledWith(parseSquare("a8"));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("remains discoverable but suppresses activation when interaction is disabled", async () => {
    const user = userEvent.setup();
    const { onActivate } = renderBoard({ disabled: true });
    const first = screen.getAllByRole("gridcell")[0];
    expect(first).toHaveAttribute("aria-disabled", "true");
    await user.tab();
    await user.keyboard("{Enter}{ArrowRight}");
    expect(onActivate).not.toHaveBeenCalled();
    expect(screen.getByRole("gridcell", { name: "Black rook on a8" })).toHaveFocus();
  });
});
