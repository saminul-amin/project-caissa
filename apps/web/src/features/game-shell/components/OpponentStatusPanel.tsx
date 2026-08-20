export type OpponentPanelState =
  | { readonly kind: "hidden" }
  | { readonly kind: "loading"; readonly percent: number | undefined }
  | { readonly kind: "thinking"; readonly label: string }
  | { readonly detail: string; readonly kind: "unavailable"; readonly retryable: boolean };

interface OpponentStatusPanelProps {
  readonly onRetry: () => void;
  readonly state: OpponentPanelState;
}

/**
 * The engine is a multi-megabyte optional asset that can fail. A player waiting on it
 * must always be told what is happening and what they can do next.
 */
export function OpponentStatusPanel({ onRetry, state }: OpponentStatusPanelProps) {
  if (state.kind === "hidden") return null;

  if (state.kind === "loading") {
    return (
      <section aria-live="polite" className="opponent-status is-loading" role="status">
        <div className="opponent-status-body">
          <p className="opponent-status-title">Preparing your opponent</p>
          <p className="opponent-status-detail">
            {state.percent === undefined
              ? "Loading the chess engine. This happens once per visit."
              : `Loading the chess engine — ${String(state.percent)}%.`}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="opponent-progress"
          data-indeterminate={state.percent === undefined ? "true" : "false"}
        >
          <span style={{ width: `${String(state.percent ?? 15)}%` }} />
        </div>
      </section>
    );
  }

  if (state.kind === "thinking") {
    return (
      <section aria-live="polite" className="opponent-status is-thinking" role="status">
        <div className="opponent-status-body">
          <p className="opponent-status-title">
            {state.label} is thinking
            <span aria-hidden="true" className="thinking-dots">
              <i />
              <i />
              <i />
            </span>
          </p>
          <p className="opponent-status-detail">Your board stays locked until the reply lands.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="opponent-unavailable-title"
      className="opponent-status is-unavailable"
    >
      <div className="opponent-status-body">
        <p className="opponent-status-title" id="opponent-unavailable-title">
          The opponent could not move
        </p>
        <p className="opponent-status-detail">{state.detail}</p>
      </div>
      {state.retryable ? (
        <button className="button button-secondary" onClick={onRetry} type="button">
          Try Again
        </button>
      ) : null}
    </section>
  );
}
