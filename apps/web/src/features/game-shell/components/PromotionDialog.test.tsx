import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PromotionPiece } from "@caissa/chess-core";
import { describe, expect, it, vi } from "vitest";

import { PromotionDialog } from "./PromotionDialog";

const allChoices = ["queen", "rook", "bishop", "knight"] as const;

describe("PromotionDialog", () => {
  it("offers every authoritative choice without submitting automatically", () => {
    const onChoose = vi.fn();
    render(
      <PromotionDialog choices={allChoices} color="white" onCancel={vi.fn()} onChoose={onChoose} />,
    );
    expect(
      screen.getByRole("dialog", { name: "Choose a promotion piece" }),
    ).toHaveAccessibleDescription();
    for (const piece of allChoices) {
      expect(screen.getByRole("button", { name: `Promote to ${piece}` })).toBeVisible();
    }
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("places initial focus on Queen and submits the explicitly chosen underpromotion", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(
      <PromotionDialog choices={allChoices} color="white" onCancel={vi.fn()} onChoose={onChoose} />,
    );
    expect(screen.getByRole("button", { name: "Promote to queen" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Promote to knight" }));
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith("knight");
  });

  it("presents Black promotion pieces for a Black pawn", () => {
    render(
      <PromotionDialog choices={["queen"]} color="black" onCancel={vi.fn()} onChoose={vi.fn()} />,
    );
    expect(screen.getByText("\u265b")).toBeVisible();
    expect(screen.getByText(/select the black piece/i)).toBeVisible();
  });

  it("traps forward and reverse focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(
      <PromotionDialog choices={allChoices} color="white" onCancel={vi.fn()} onChoose={vi.fn()} />,
    );
    const queen = screen.getByRole("button", { name: "Promote to queen" });
    const cancel = screen.getByRole("button", { name: "Cancel promotion" });
    expect(queen).toHaveFocus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(queen).toHaveFocus();
  });

  it("cancels with Escape and restores focus without choosing a piece", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<PromotionHarness onChoose={onChoose} />);
    const opener = screen.getByRole("button", { name: "Open promotion" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(onChoose).not.toHaveBeenCalled();
  });
});

function PromotionHarness({ onChoose }: { readonly onChoose: (piece: PromotionPiece) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        Open promotion
      </button>
      {open ? (
        <PromotionDialog
          choices={["knight"]}
          color="white"
          onCancel={() => {
            setOpen(false);
          }}
          onChoose={onChoose}
        />
      ) : null}
    </>
  );
}
