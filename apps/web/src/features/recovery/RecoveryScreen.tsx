import { useState } from "react";

import { useCaissaApp, type AppStartupViewState } from "../../app/CaissaAppProvider";
import { ConfirmationDialog } from "../../components/ConfirmationDialog";

interface RecoveryScreenProps {
  readonly state: Extract<AppStartupViewState, { readonly status: "recovery-required" }>;
}

export function RecoveryScreen({ state }: RecoveryScreenProps) {
  const { actions } = useCaissaApp();
  const [showDiscard, setShowDiscard] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const copy = recoveryCopy(state.recovery.titleMessageKey, state.recovery.bodyMessageKey);
  const availableActions = new Set(state.recovery.actions);

  async function discard() {
    setIsDiscarding(true);
    const result = await actions.discardActiveGame();
    setIsDiscarding(false);
    if (result === "failed") {
      setActionFailed(true);
      setShowDiscard(false);
    }
  }

  return (
    <main className="startup-gate" id="main-content" tabIndex={-1}>
      <section className="state-card" aria-labelledby="recovery-title">
        <p className="eyebrow">Game recovery</p>
        <h1 id="recovery-title">{copy.title}</h1>
        <p>{copy.body}</p>
        <p className="state-assurance">
          Your stored record remains untouched until you explicitly choose to discard it. Completed
          history and preferences are separate.
        </p>
        {actionFailed ? (
          <p className="inline-message inline-message-error" role="alert">
            Caissa could not remove the active game. Nothing else was deleted. Please try again.
          </p>
        ) : null}
        <div className="state-actions">
          {availableActions.has("retry") ? (
            <button className="button button-primary" onClick={() => void actions.retryStartup()}>
              Try Again
            </button>
          ) : null}
          {availableActions.has("discard-active-game") ? (
            <button
              className="button button-secondary"
              onClick={() => {
                setShowDiscard(true);
              }}
              type="button"
            >
              Discard Active Game
            </button>
          ) : null}
          {availableActions.has("continue-without-restoring") ? (
            <button
              className="button button-ghost"
              onClick={() => {
                actions.continueWithoutRestoring();
              }}
              type="button"
            >
              Continue Without Restoring
            </button>
          ) : null}
        </div>
      </section>
      {showDiscard ? (
        <ConfirmationDialog
          cancelLabel="Keep Stored Game"
          confirmLabel="Discard Active Game"
          destructive
          isBusy={isDiscarding}
          onCancel={() => {
            setShowDiscard(false);
          }}
          onConfirm={() => void discard()}
          title="Discard this active game?"
        >
          <p>Only the active game will be removed from this browser.</p>
          <p>Completed history, reviews, and preferences will remain.</p>
        </ConfirmationDialog>
      ) : null}
    </main>
  );
}

function recoveryCopy(
  titleKey: string,
  bodyKey: string,
): { readonly body: string; readonly title: string } {
  const unsupported = titleKey.includes("unsupported") || bodyKey.includes("unsupported");
  const terminal = titleKey.includes("terminal-session") || bodyKey.includes("terminal-session");
  if (terminal) {
    return {
      body: "A finished game was found in the active-game slot. Caissa will not reopen or alter it automatically.",
      title: "This saved game needs attention",
    };
  }
  if (unsupported) {
    return {
      body: "This saved game was created in a format this version cannot restore safely.",
      title: "This saved game cannot be restored here",
    };
  }
  return {
    body: "Caissa found an active game that could not be restored with confidence. The stored data has not been changed.",
    title: "Your saved game needs attention",
  };
}
