import { render, screen } from "@testing-library/react";
import { parseFen, parseSquare } from "@caissa/chess-core";
import { describe, expect, it, vi } from "vitest";

import { ChessBoardAdapter } from "./ChessBoardAdapter";

const boardSpy = vi.hoisted(() => vi.fn());

vi.mock("react-chessboard", () => ({
  Chessboard: (props: unknown) => {
    boardSpy(props);
    return <div data-testid="library-board" />;
  },
}));

describe("ChessBoardAdapter", () => {
  it("passes application-owned position and orientation into the isolated renderer", () => {
    const fen = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    render(
      <ChessBoardAdapter
        ariaLabel="Read-only board"
        fen={fen}
        isInCheck={false}
        orientation="black"
        turn="white"
      />,
    );
    expect(screen.getByRole("img", { name: "Read-only board" })).toBeVisible();
    const options = (boardSpy.mock.lastCall?.[0] as { readonly options: Record<string, unknown> })
      .options;
    expect(options.position).toBe(fen);
    expect(options.boardOrientation).toBe("black");
  });

  it("is non-interactive and exposes no move or click callback", () => {
    render(
      <ChessBoardAdapter
        ariaLabel="Read-only board"
        fen={parseFen("8/8/8/8/8/8/4K3/7k w - - 0 1")}
        isInCheck={false}
        orientation="white"
        turn="white"
      />,
    );
    const options = (boardSpy.mock.lastCall?.[0] as { readonly options: Record<string, unknown> })
      .options;
    expect(options.allowDragging).toBe(false);
    expect(options.allowDrawingArrows).toBe(false);
    expect(options).not.toHaveProperty("onPieceDrop");
    expect(options).not.toHaveProperty("onSquareClick");
    expect(options).not.toHaveProperty("onPieceClick");
  });

  it("projects last-move and checked-king square styles without calculating legality", () => {
    render(
      <ChessBoardAdapter
        ariaLabel="Checked board"
        fen={parseFen("7k/8/8/8/8/8/4R3/4K3 b - - 0 1")}
        isInCheck
        lastMove={{ from: parseSquare("e1"), to: parseSquare("e2") }}
        orientation="white"
        turn="black"
      />,
    );
    const options = (boardSpy.mock.lastCall?.[0] as { readonly options: Record<string, unknown> })
      .options;
    expect(options.squareStyles).toMatchObject({ e1: {}, e2: {}, h8: {} });
  });
});
