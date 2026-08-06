import { useEffect, useRef, type ReactNode } from "react";

interface ConfirmationDialogProps {
  readonly cancelLabel: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly isBusy?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
}

const focusableSelector =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmationDialog({
  cancelLabel,
  children,
  confirmLabel,
  destructive = false,
  isBusy = false,
  onCancel,
  onConfirm,
  title,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isBusy, onCancel]);

  const titleId = `dialog-title-${title.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`;
  return (
    <div className="dialog-backdrop">
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id={titleId}>{title}</h2>
        <div className="dialog-copy">{children}</div>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            disabled={isBusy}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={destructive ? "button button-destructive" : "button button-primary"}
            disabled={isBusy}
            onClick={onConfirm}
            type="button"
          >
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
