import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "./ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("starts on the safe action, traps focus, closes with Escape, and restores focus", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open confirmation" });
    await user.click(trigger);

    const cancel = screen.getByRole("button", { name: "Keep game" });
    const confirm = screen.getByRole("button", { name: "Confirm action" });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("names and describes the dialog with component-unique identifiers", () => {
    const onCancel = vi.fn();
    const view = render(
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onCancel={onCancel}
        onConfirm={vi.fn()}
        title="Confirm change"
      >
        <p>This action has a bounded consequence.</p>
      </ConfirmationDialog>,
    );
    const first = screen.getByRole("dialog");
    expect(first).toHaveAccessibleName("Confirm change");
    expect(first).toHaveAccessibleDescription("This action has a bounded consequence.");
    const firstLabel = first.getAttribute("aria-labelledby");
    view.unmount();

    render(
      <ConfirmationDialog
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onCancel={onCancel}
        onConfirm={vi.fn()}
        title="Confirm change"
      >
        <p>A separate dialog instance.</p>
      </ConfirmationDialog>,
    );
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).not.toBe(firstLabel);
  });

  it("prevents dismissal and confirmation while a mutation is busy", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        cancelLabel="Keep game"
        confirmLabel="Confirm action"
        isBusy
        onCancel={onCancel}
        onConfirm={onConfirm}
        title="Busy confirmation"
      >
        <p>Saving locally.</p>
      </ConfirmationDialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        Open confirmation
      </button>
      {open ? (
        <ConfirmationDialog
          cancelLabel="Keep game"
          confirmLabel="Confirm action"
          onCancel={() => {
            setOpen(false);
          }}
          onConfirm={() => {
            setOpen(false);
          }}
          title="Confirm action?"
        >
          <p>Review this consequence before continuing.</p>
        </ConfirmationDialog>
      ) : null}
    </>
  );
}
