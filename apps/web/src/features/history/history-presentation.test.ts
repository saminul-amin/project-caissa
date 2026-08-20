import { describe, expect, it } from "vitest";

import type { GameHistoryListItem } from "../../application/history";
import { createHistoryRowModel, describeResult, describeTimeControl } from "./history-presentation";

function listItem(overrides: Partial<GameHistoryListItem> = {}): GameHistoryListItem {
  return {
    completedAt: 1_700_000_000_000 as never,
    gameId: "game-1" as never,
    moveCount: 41,
    participants: {
      black: { kind: "external-opponent", label: "Caissa Club" },
      white: { kind: "human", label: "You" },
    },
    result: { isDraw: false, reason: "checkmate", status: "decisive", winner: "white" } as never,
    review: { status: "not-available" },
    revision: 42 as never,
    timeControl: { initialMs: 300_000, kind: "sudden-death" } as never,
    ...overrides,
  };
}

const formatDate = (epochMs: number) => `date:${String(epochMs)}`;

describe("createHistoryRowModel", () => {
  it("labels a win for the human side", () => {
    const row = createHistoryRowModel(listItem(), { formatDate });
    expect(row.outcome).toBe("win");
    expect(row.resultLabel).toBe("White won · checkmate");
    expect(row.whiteLabel).toBe("You");
    expect(row.blackLabel).toBe("Caissa Club");
  });

  it("labels a loss for the human side", () => {
    const row = createHistoryRowModel(
      listItem({
        result: {
          isDraw: false,
          reason: "checkmate",
          status: "decisive",
          winner: "black",
        } as never,
      }),
      { formatDate },
    );
    expect(row.outcome).toBe("loss");
  });

  it("stays neutral when both sides were human", () => {
    const row = createHistoryRowModel(
      listItem({
        participants: {
          black: { kind: "human", label: "Black" },
          white: { kind: "human", label: "White" },
        },
      }),
      { formatDate },
    );
    expect(row.outcome).toBe("unfinished");
  });

  it("labels a draw and an abandoned game", () => {
    expect(
      createHistoryRowModel(
        listItem({ result: { isDraw: true, reason: "stalemate", status: "draw" } as never }),
        { formatDate },
      ).outcome,
    ).toBe("draw");
    expect(
      createHistoryRowModel(
        listItem({ result: { isDraw: false, reason: "abandoned", status: "abandoned" } as never }),
        { formatDate },
      ).resultLabel,
    ).toBe("Ended early");
  });

  it("counts plies as whole moves", () => {
    expect(createHistoryRowModel(listItem({ moveCount: 41 }), { formatDate }).moveLabel).toBe(
      "21 moves",
    );
    expect(createHistoryRowModel(listItem({ moveCount: 1 }), { formatDate }).moveLabel).toBe(
      "1 move",
    );
  });

  it("falls back to colour names when a participant has no label", () => {
    const row = createHistoryRowModel(
      listItem({
        participants: { black: { kind: "human" }, white: { kind: "human" } },
      }),
      { formatDate },
    );
    expect(row.whiteLabel).toBe("White");
    expect(row.blackLabel).toBe("Black");
  });

  it.each([
    [{ status: "not-available" }, "Not reviewed"],
    [{ reviewStatus: "completed", status: "available" }, "Reviewed"],
    [{ reviewStatus: "in-progress", status: "available" }, "Review running"],
    [{ reviewStatus: "partial", status: "available" }, "Partial review"],
    [{ reviewStatus: "failed", status: "available" }, "Review failed"],
    [{ reviewStatus: "not-started", status: "available" }, "Not reviewed"],
    [{ status: "unavailable" }, "Review status unknown"],
  ])("describes review state %#", (review, expected) => {
    expect(
      createHistoryRowModel(listItem({ review: review as never }), { formatDate }).reviewLabel,
    ).toBe(expected);
  });

  it("uses a locale date formatter by default", () => {
    expect(createHistoryRowModel(listItem()).completedLabel.length).toBeGreaterThan(0);
  });
});

describe("describeTimeControl", () => {
  it("formats every supported time control", () => {
    expect(describeTimeControl({ kind: "untimed" } as never)).toBe("Untimed");
    expect(describeTimeControl({ initialMs: 300_000, kind: "sudden-death" } as never)).toBe(
      "5 min",
    );
    expect(
      describeTimeControl({ incrementMs: 2_000, initialMs: 180_000, kind: "increment" } as never),
    ).toBe("3+2");
  });
});

describe("describeResult", () => {
  it("humanizes hyphenated draw reasons", () => {
    expect(
      describeResult({ isDraw: true, reason: "threefold-repetition", status: "draw" } as never),
    ).toBe("Draw · threefold repetition");
  });
});
