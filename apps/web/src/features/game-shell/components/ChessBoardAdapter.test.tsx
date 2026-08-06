import { fireEvent, render, screen } from "@testing-library/react";
import { parseFen, parseSquare } from "@caissa/chess-core";
import { describe, expect, it, vi } from "vitest";

import { ChessBoardAdapter } from "./ChessBoardAdapter";

const boardSpy = vi.hoisted(() => vi.fn());

interface CapturedBoardOptions {
  readonly allowDragging?: boolean;
  readonly boardOrientation?: string;
  readonly onPieceDrag?: (event: { readonly square: string | null }) => void;
  readonly onPieceDrop?: (event: {
    readonly sourceSquare: string;
    readonly targetSquare: string | null;
  }) => boolean;
  readonly onSquareClick?: (event: { readonly square: string }) => void;
  readonly position?: string;
  readonly squareStyles?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

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

  it("maps a valid drag into an application move intent and refuses speculative rendering", () => {
    const onMoveIntent = vi.fn();
    const onSquareActivate = vi.fn();
    render(
      <ChessBoardAdapter
        ariaLabel="Interactive board"
        fen={parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")}
        interactive
        isInCheck={false}
        onMoveIntent={onMoveIntent}
        onSquareActivate={onSquareActivate}
        orientation="white"
        turn="white"
      />,
    );
    const options = capturedOptions();
    options.onPieceDrag?.({ square: "e2" });
    expect(options.onPieceDrop?.({ sourceSquare: "e2", targetSquare: "e4" })).toBe(false);
    expect(onSquareActivate).toHaveBeenCalledWith(parseSquare("e2"), "drag");
    expect(onMoveIntent).toHaveBeenCalledWith({
      from: parseSquare("e2"),
      inputMethod: "drag",
      to: parseSquare("e4"),
    });
  });

  it("ignores malformed library squares without emitting an intent", () => {
    const onMoveIntent = vi.fn();
    const onSquareActivate = vi.fn();
    render(
      <ChessBoardAdapter
        ariaLabel="Interactive board"
        fen={parseFen("8/8/8/8/8/8/4K3/7k w - - 0 1")}
        interactive
        isInCheck={false}
        onMoveIntent={onMoveIntent}
        onSquareActivate={onSquareActivate}
        orientation="white"
        turn="white"
      />,
    );
    const options = capturedOptions();
    expect(options.onPieceDrop?.({ sourceSquare: "outside", targetSquare: "e4" })).toBe(false);
    options.onPieceDrag?.({ square: null });
    options.onSquareClick?.({ square: "z9" });
    expect(onMoveIntent).not.toHaveBeenCalled();
    expect(onSquareActivate).not.toHaveBeenCalled();
  });

  it("distinguishes click and touch activation while sharing the square-intent boundary", () => {
    const onSquareActivate = vi.fn();
    render(
      <ChessBoardAdapter
        ariaLabel="Interactive board"
        fen={parseFen("8/8/8/8/8/8/4K3/7k w - - 0 1")}
        interactive
        isInCheck={false}
        onSquareActivate={onSquareActivate}
        orientation="white"
        turn="white"
      />,
    );
    const board = screen.getByRole("img", { name: "Interactive board" });
    const options = capturedOptions();
    options.onSquareClick?.({ square: "e2" });
    fireEvent.pointerDown(board, { pointerType: "touch" });
    options.onSquareClick?.({ square: "e4" });
    expect(onSquareActivate).toHaveBeenNthCalledWith(1, parseSquare("e2"), "click");
    expect(onSquareActivate).toHaveBeenNthCalledWith(2, parseSquare("e4"), "touch");
  });

  it("projects selected, quiet, and capture targets with distinct non-color shapes", () => {
    render(
      <ChessBoardAdapter
        ariaLabel="Interactive board"
        captureTargets={[parseSquare("d3")]}
        fen={parseFen("8/8/8/8/8/3p4/4P3/4K2k w - - 0 1")}
        interactive
        isInCheck={false}
        legalTargets={[parseSquare("e3"), parseSquare("d3")]}
        orientation="white"
        selectedSource={parseSquare("e2")}
        turn="white"
      />,
    );
    const styles = capturedOptions().squareStyles;
    expect(styles?.e2?.boxShadow).toContain("var(--color-focus)");
    expect(styles?.e3?.backgroundImage).toContain("var(--color-border-strong)");
    expect(styles?.d3?.backgroundImage).toContain("transparent 54%");
    expect(styles?.d3?.backgroundImage).not.toBe(styles?.e3?.backgroundImage);
  });
});

function capturedOptions(): CapturedBoardOptions {
  return (boardSpy.mock.lastCall?.[0] as { readonly options: CapturedBoardOptions }).options;
}
