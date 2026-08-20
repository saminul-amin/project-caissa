import { useEffect, useId, useRef, type ReactNode } from "react";

interface ConfirmationDialogProps {
  readonly cancelLabel: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly isBusy?: boolean;
  readonly initialFocus?: "cancel" | "confirm";
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
  initialFocus = "cancel",
  onCancel,
  onConfirm,
  title,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const isBusyRef = useRef(isBusy);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    isBusyRef.current = isBusy;
    onCancelRef.current = onCancel;
  }, [isBusy, onCancel]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocus === "confirm" ? confirmRef.current : cancelRef.current)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusyRef.current) {
        event.preventDefault();
        onCancelRef.current();
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
  }, [initialFocus]);

  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  return (
    <div className="dialog-backdrop" data-dialog-backdrop="true">
      <div
        aria-busy={isBusy}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <h2 id={titleId}>{title}</h2>
        <div className="dialog-copy" id={descriptionId}>
          {children}
        </div>
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
            ref={confirmRef}
            type="button"
          >
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
