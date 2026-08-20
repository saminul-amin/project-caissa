import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import { CaissaAppProvider, useCaissaApp } from "./CaissaAppProvider";
import { AppShell } from "./AppShell";
import { useMoveSounds } from "./use-move-sounds";
import { usePreferenceEffects } from "./use-preference-effects";
import { GameSetupPage } from "../features/game-setup";
import { HistoryPage } from "../features/history";
import { HomePage } from "../features/home";
import { RecoveryScreen } from "../features/recovery";
import { SettingsPage } from "../features/settings";
import type { CaissaApplication } from "../infrastructure/composition";
import { NotFoundPage } from "../routes/NotFoundPage";

interface AppProps {
  readonly application?: CaissaApplication;
}

const GameShellPage = lazy(async () => {
  const feature = await import("../features/game-shell");
  return { default: feature.GameShellPage };
});

const ReviewPage = lazy(async () => {
  const feature = await import("../features/review");
  return { default: feature.ReviewPage };
});

export function App({ application }: AppProps) {
  return (
    <CaissaAppProvider {...(application ? { application } : {})}>
      <ApplicationGate />
    </CaissaAppProvider>
  );
}

function ApplicationGate() {
  const { actions, activeGame, preferences, startup } = useCaissaApp();
  usePreferenceEffects(preferences);
  useMoveSounds({ preferences, session: activeGame?.session });
  switch (startup.status) {
    case "restoring":
      return (
        <main className="startup-gate" id="main-content" tabIndex={-1}>
          <section className="state-card" aria-busy="true" aria-labelledby="restoring-title">
            <p className="eyebrow">Local-first startup</p>
            <h1 id="restoring-title">Restoring your board</h1>
            <p>Caissa is checking this browser for an active game.</p>
          </section>
        </main>
      );
    case "recovery-required":
      return <RecoveryScreen state={startup} />;
    case "storage-unavailable":
      return (
        <StartupFailure
          body="Caissa cannot access local storage right now. You may retry or continue without restoring; persistence will not be presented as available."
          onContinue={() => {
            actions.continueWithoutRestoring();
          }}
          onRetry={() => void actions.retryStartup()}
          title="Local storage is unavailable"
        />
      );
    case "failed":
      return (
        <StartupFailure
          body="Caissa could not finish its local startup check. No stored game was changed."
          onContinue={() => {
            actions.continueWithoutRestoring();
          }}
          onRetry={() => void actions.retryStartup()}
          title="Caissa could not restore this session"
        />
      );
    case "no-active-game":
    case "restored":
      return (
        <AppShell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/play/new" element={<GameSetupPage />} />
            <Route
              path="/play"
              element={
                <Suspense fallback={<PlayRouteLoading />}>
                  <GameShellPage />
                </Suspense>
              }
            />
            <Route path="/history" element={<HistoryPage />} />
            <Route
              path="/review/:gameId"
              element={
                <Suspense fallback={<ReviewRouteLoading />}>
                  <ReviewPage />
                </Suspense>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell>
      );
  }
}

function ReviewRouteLoading() {
  return (
    <section aria-busy="true" className="state-card route-fade">
      <p className="eyebrow">Game review</p>
      <h1>Opening the review</h1>
    </section>
  );
}

function PlayRouteLoading() {
  return (
    <section aria-busy="true" className="state-card route-fade">
      <p className="eyebrow">Local game</p>
      <h1>Loading the board</h1>
    </section>
  );
}

function StartupFailure({
  body,
  onContinue,
  onRetry,
  title,
}: {
  readonly body: string;
  readonly onContinue: () => void;
  readonly onRetry: () => void;
  readonly title: string;
}) {
  return (
    <main className="startup-gate" id="main-content" tabIndex={-1}>
      <section className="state-card" aria-labelledby="startup-failure-title">
        <p className="eyebrow">Startup needs attention</p>
        <h1 id="startup-failure-title">{title}</h1>
        <p>{body}</p>
        <div className="state-actions">
          <button className="button button-primary" onClick={onRetry} type="button">
            Try Again
          </button>
          <button className="button button-secondary" onClick={onContinue} type="button">
            Continue Without Restoring
          </button>
        </div>
      </section>
    </main>
  );
}
