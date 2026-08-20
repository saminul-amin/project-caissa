import { useRef, useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";

import { OPPONENT_PROFILES, OPPONENT_STRENGTH_DISCLOSURE } from "../../application/opponent";
import {
  DEFAULT_NEW_GAME_SETUP,
  TIME_CONTROL_OPTIONS,
  validateNewGameSetup,
  type NewGameMode,
  type NewGameSetup,
  type NewGameSetupField,
} from "../../application/game-creation";
import { useCaissaApp, type CreateGameActionResult } from "../../app/CaissaAppProvider";
import { ConfirmationDialog } from "../../components/ConfirmationDialog";

type FieldErrors = Readonly<Partial<Record<NewGameSetupField | "form", string>>>;

const MODE_OPTIONS: readonly {
  readonly description: string;
  readonly id: NewGameMode;
  readonly title: string;
}[] = Object.freeze([
  {
    description: "Play against Caissa at a strength you choose.",
    id: "engine",
    title: "Play the engine",
  },
  {
    description: "Two people share this device and take turns.",
    id: "local-human-vs-human",
    title: "Local two-player",
  },
]);

export function GameSetupPage() {
  const { actions, opponentStatus } = useCaissaApp();
  const navigate = useNavigate();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [mode, setMode] = useState<NewGameMode>(DEFAULT_NEW_GAME_SETUP.mode);
  const [replacementSetup, setReplacementSetup] = useState<NewGameSetup | undefined>();
  const engineUnavailable = opponentStatus.kind === "unavailable";

  async function submitSetup(setup: NewGameSetup, replacing = false) {
    setIsSubmitting(true);
    const result = replacing
      ? await actions.confirmActiveGameReplacement(setup)
      : await actions.createNewGame({ setup });
    setIsSubmitting(false);
    handleResult(result, setup);
  }

  function handleResult(result: CreateGameActionResult, setup: NewGameSetup) {
    if (result.status === "created" || result.status === "created-unsaved") {
      setReplacementSetup(undefined);
      void navigate("/play");
      return;
    }
    if (result.status === "active-game-exists") {
      setReplacementSetup(setup);
      return;
    }
    if (result.status === "active-game-recovery-required") {
      void navigate("/");
      return;
    }
    const nextErrors =
      result.status === "invalid-setup"
        ? errorsFromFields(result.fields)
        : {
            form:
              result.status === "storage-unavailable"
                ? "Local storage is unavailable. Caissa did not create the game."
                : "Caissa could not create the game safely. Please try again.",
          };
    setErrors(nextErrors);
    queueMicrotask(() => errorSummaryRef.current?.focus());
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const form = new FormData(event.currentTarget);
    const candidate = {
      allowUndo: form.get("allowUndo") === "on",
      mode: form.get("mode"),
      opponentProfileId: form.get("opponentProfileId"),
      orientation: form.get("orientation"),
      timeControlId: form.get("timeControlId"),
    };
    const validation = validateNewGameSetup(candidate);
    if (validation.status === "invalid") {
      setErrors(errorsFromFields(validation.fields));
      queueMicrotask(() => errorSummaryRef.current?.focus());
      return;
    }
    setErrors({});
    void submitSetup(validation.setup);
  }

  return (
    <section className="setup-page route-fade" aria-labelledby="setup-title">
      <header className="page-heading">
        <p className="eyebrow">New game</p>
        <h1 id="setup-title">Set up your game</h1>
        <p>
          Everything below stays on this device. Your game is created in a ready state and its clock
          does not begin until you start playing.
        </p>
      </header>

      {Object.keys(errors).length > 0 ? (
        <div
          aria-labelledby="setup-error-title"
          className="error-summary"
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <h2 id="setup-error-title">Check your game setup</h2>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {engineUnavailable ? (
        <p className="inline-notice" role="status">
          {opponentStatus.detail} You can still play a local two-player game.
        </p>
      ) : null}

      <form className="setup-form" noValidate onSubmit={handleSubmit}>
        <fieldset aria-describedby={errors.mode ? "mode-error" : undefined}>
          <legend>Opponent</legend>
          <div className="selection-grid selection-grid-modes">
            {MODE_OPTIONS.map((option) => (
              <label
                className={
                  option.id === "engine" && engineUnavailable
                    ? "selection-card is-disabled"
                    : "selection-card"
                }
                key={option.id}
              >
                <input
                  checked={mode === option.id}
                  disabled={option.id === "engine" && engineUnavailable}
                  name="mode"
                  onChange={() => {
                    setMode(option.id);
                  }}
                  type="radio"
                  value={option.id}
                />
                <span className="selection-title">{option.title}</span>
                <span className="selection-description">{option.description}</span>
              </label>
            ))}
          </div>
          {errors.mode ? (
            <p className="field-error" id="mode-error">
              {errors.mode}
            </p>
          ) : null}
        </fieldset>

        {mode === "engine" ? (
          <fieldset aria-describedby="strength-disclosure">
            <legend>Strength</legend>
            <div className="selection-grid selection-grid-strength">
              {OPPONENT_PROFILES.map((profile) => (
                <label className="selection-card" key={profile.id}>
                  <input
                    defaultChecked={profile.id === DEFAULT_NEW_GAME_SETUP.opponentProfileId}
                    name="opponentProfileId"
                    type="radio"
                    value={profile.id}
                  />
                  <span className="selection-title">{profile.label}</span>
                  <span className="selection-description">{profile.description}</span>
                </label>
              ))}
            </div>
            <p className="field-note" id="strength-disclosure">
              {OPPONENT_STRENGTH_DISCLOSURE}
            </p>
            {errors.opponentProfileId ? (
              <p className="field-error">{errors.opponentProfileId}</p>
            ) : null}
          </fieldset>
        ) : (
          <input
            name="opponentProfileId"
            type="hidden"
            value={DEFAULT_NEW_GAME_SETUP.opponentProfileId}
          />
        )}

        <fieldset aria-describedby={errors.timeControlId ? "time-control-error" : undefined}>
          <legend>Time control</legend>
          <div className="selection-grid selection-grid-time">
            {TIME_CONTROL_OPTIONS.map((option) => (
              <label className="selection-card" key={option.id}>
                <input
                  defaultChecked={option.id === DEFAULT_NEW_GAME_SETUP.timeControlId}
                  name="timeControlId"
                  type="radio"
                  value={option.id}
                />
                <span className="selection-title">{option.label}</span>
                <span className="selection-description">{option.description}</span>
              </label>
            ))}
          </div>
          {errors.timeControlId ? (
            <p className="field-error" id="time-control-error">
              {errors.timeControlId}
            </p>
          ) : null}
        </fieldset>

        <fieldset aria-describedby={errors.orientation ? "orientation-error" : undefined}>
          <legend>{mode === "engine" ? "Play as" : "Board orientation"}</legend>
          <div className="selection-grid selection-grid-orientation">
            {(["white", "black"] as const).map((orientation) => (
              <label className="selection-card selection-card-compact" key={orientation}>
                <input
                  defaultChecked={orientation === DEFAULT_NEW_GAME_SETUP.orientation}
                  name="orientation"
                  type="radio"
                  value={orientation}
                />
                <span className="selection-title">{capitalize(orientation)}</span>
              </label>
            ))}
          </div>
          {errors.orientation ? (
            <p className="field-error" id="orientation-error">
              {errors.orientation}
            </p>
          ) : null}
        </fieldset>

        <fieldset aria-describedby={errors.allowUndo ? "undo-error" : undefined}>
          <legend>Practice options</legend>
          <label className="check-row">
            <input
              defaultChecked={DEFAULT_NEW_GAME_SETUP.allowUndo}
              name="allowUndo"
              type="checkbox"
            />
            <span>
              <strong>Allow takebacks</strong>
              <small>
                {mode === "engine"
                  ? "Take back your move and the reply while you practise."
                  : "Keep takebacks available for local practice."}
              </small>
            </span>
          </label>
          {errors.allowUndo ? (
            <p className="field-error" id="undo-error">
              {errors.allowUndo}
            </p>
          ) : null}
        </fieldset>

        <button
          className="button button-primary setup-submit"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating Game…" : "Create Game"}
        </button>
      </form>

      {replacementSetup ? (
        <ConfirmationDialog
          cancelLabel="Keep Current Game"
          confirmLabel="Replace and Create New Game"
          destructive
          isBusy={isSubmitting}
          onCancel={() => {
            setReplacementSetup(undefined);
          }}
          onConfirm={() => void submitSetup(replacementSetup, true)}
          title="Replace the current active game?"
        >
          <p>The current active game will be replaced by this new ready game.</p>
          <p>Completed history, reviews, preferences, and analysis cache will remain.</p>
        </ConfirmationDialog>
      ) : null}
    </section>
  );
}

function errorsFromFields(fields: readonly NewGameSetupField[]): FieldErrors {
  const messages: Partial<Record<NewGameSetupField, string>> = {};
  for (const field of fields) {
    messages[field] = fieldError(field);
  }
  return Object.freeze(messages);
}

function fieldError(field: NewGameSetupField): string {
  switch (field) {
    case "mode":
      return "Choose how you want to play.";
    case "timeControlId":
      return "Choose one of the available time controls.";
    case "allowUndo":
      return "Choose whether takebacks are allowed.";
    case "orientation":
      return "Choose White or Black.";
    case "opponentProfileId":
      return "Choose one of the available opponent strengths.";
  }
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
