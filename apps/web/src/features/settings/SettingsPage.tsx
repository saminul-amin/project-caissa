import { useState } from "react";

import {
  BOARD_THEME_PREFERENCES,
  REDUCED_MOTION_PREFERENCES,
  THEME_PREFERENCES,
  type BoardThemePreference,
  type ReducedMotionPreference,
  type ThemePreference,
  type UserPreferences,
} from "../../application/settings";
import { useCaissaApp } from "../../app/CaissaAppProvider";
import { ConfirmationDialog } from "../../components/ConfirmationDialog";
import { BUNDLED_ENGINE_SUMMARY, CAISSA_VERSION } from "./about-caissa";

const THEME_LABELS: Readonly<Record<ThemePreference, string>> = Object.freeze({
  dark: "Dark",
  light: "Light",
  system: "Match my system",
});

const BOARD_THEME_LABELS: Readonly<Record<BoardThemePreference, string>> = Object.freeze({
  "caissa-classic": "Caissa classic",
  linen: "Linen",
});

const MOTION_LABELS: Readonly<Record<ReducedMotionPreference, string>> = Object.freeze({
  "no-preference": "Full motion",
  reduce: "Reduced motion",
  system: "Match my system",
});

export function SettingsPage() {
  const { actions, application, preferences } = useCaissaApp();
  const [notice, setNotice] = useState<string | undefined>();
  const [confirmWipe, setConfirmWipe] = useState(false);

  async function update(changes: Partial<UserPreferences>) {
    const result = await actions.savePreferences({ ...preferences, ...changes });
    setNotice(
      result === "saved"
        ? "Settings saved."
        : "Caissa could not save that setting. It applies for this session only.",
    );
  }

  async function wipeEverything() {
    setConfirmWipe(false);
    const cleared = await application.historyService.clearHistory({
      confirmation: "clear-completed-game-history",
    });
    const reset = await actions.resetPreferences();
    setNotice(
      (cleared.status === "cleared" || cleared.status === "cleared-with-cleanup-warning") &&
        reset === "saved"
        ? "All Caissa data on this device was deleted."
        : "Caissa could not delete every item. Some data may remain.",
    );
  }

  return (
    <section aria-labelledby="settings-title" className="settings-page route-fade">
      <header className="page-heading">
        <p className="eyebrow">Preferences</p>
        <h1 id="settings-title">Settings</h1>
        <p>Settings are stored in this browser and apply to every game you play here.</p>
      </header>

      {notice ? (
        <p className="move-feedback" role="status">
          {notice}
        </p>
      ) : null}

      <fieldset className="settings-group">
        <legend>Appearance</legend>
        <label className="settings-field">
          <span>Interface theme</span>
          <select
            onChange={(event) => void update({ theme: event.target.value as ThemePreference })}
            value={preferences.theme}
          >
            {THEME_PREFERENCES.map((value) => (
              <option key={value} value={value}>
                {THEME_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Board theme</span>
          <select
            onChange={(event) =>
              void update({ boardTheme: event.target.value as BoardThemePreference })
            }
            value={preferences.boardTheme}
          >
            {BOARD_THEME_PREFERENCES.map((value) => (
              <option key={value} value={value}>
                {BOARD_THEME_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>Motion</span>
          <select
            onChange={(event) =>
              void update({ reducedMotion: event.target.value as ReducedMotionPreference })
            }
            value={preferences.reducedMotion}
          >
            {REDUCED_MOTION_PREFERENCES.map((value) => (
              <option key={value} value={value}>
                {MOTION_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="check-row">
          <input
            checked={preferences.coordinatesVisible}
            onChange={(event) => void update({ coordinatesVisible: event.target.checked })}
            type="checkbox"
          />
          <span>
            <strong>Show board coordinates</strong>
            <small>Display file letters and rank numbers around the board.</small>
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Sound</legend>
        <label className="check-row">
          <input
            checked={preferences.soundEnabled}
            onChange={(event) => void update({ soundEnabled: event.target.checked })}
            type="checkbox"
          />
          <span>
            <strong>Enable sound</strong>
            <small>Caissa generates its own short tones. No audio files are downloaded.</small>
          </span>
        </label>

        <label className="check-row">
          <input
            checked={preferences.moveSoundEnabled}
            disabled={!preferences.soundEnabled}
            onChange={(event) => void update({ moveSoundEnabled: event.target.checked })}
            type="checkbox"
          />
          <span>
            <strong>Move sounds</strong>
            <small>Play a tone when a move, capture, or check is committed.</small>
          </span>
        </label>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Your data</legend>
        <p className="field-note">
          Caissa has no accounts and no servers. Games, settings, and analysis stay in this browser
          until you delete them.
        </p>
        <button
          className="button button-secondary"
          onClick={() => {
            setConfirmWipe(true);
          }}
          type="button"
        >
          Delete All Caissa Data
        </button>
      </fieldset>

      <section aria-labelledby="about-title" className="settings-group">
        <h2 id="about-title">About</h2>
        <dl className="settings-about">
          <div>
            <dt>Version</dt>
            <dd>{CAISSA_VERSION}</dd>
          </div>
          <div>
            <dt>Engine</dt>
            <dd>{BUNDLED_ENGINE_SUMMARY.name}</dd>
          </div>
          <div>
            <dt>Engine licence</dt>
            <dd>
              <a href={BUNDLED_ENGINE_SUMMARY.upstream} rel="noreferrer noopener" target="_blank">
                {BUNDLED_ENGINE_SUMMARY.license}
              </a>
            </dd>
          </div>
        </dl>
        <p className="field-note">
          Caissa is distributed under the GNU General Public License version 3 or later because it
          bundles Stockfish. The complete source is available in the project repository.
        </p>
      </section>

      {confirmWipe ? (
        <ConfirmationDialog
          cancelLabel="Keep My Data"
          confirmLabel="Delete Everything"
          destructive
          onCancel={() => {
            setConfirmWipe(false);
          }}
          onConfirm={() => void wipeEverything()}
          title="Delete all Caissa data?"
        >
          <p>Saved games, reviews, and settings will be removed from this browser.</p>
          <p>This cannot be undone.</p>
        </ConfirmationDialog>
      ) : null}
    </section>
  );
}
