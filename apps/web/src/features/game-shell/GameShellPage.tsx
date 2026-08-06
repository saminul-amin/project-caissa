import { Link } from "react-router-dom";
import type { ClockDurationMs, MoveRecord, Square } from "@caissa/chess-core";

import { useCaissaApp } from "../../app/CaissaAppProvider";
import { ChessBoardAdapter } from "./components/ChessBoardAdapter";
import {
  createMoveHistoryRows,
  createPlayerPanelModel,
  gameStatusLabel,
  timeControlLabel,
} from "./game-shell-projections";
import { createPiecePositionSummary } from "./position-summary";
import { useClockDisplay } from "./use-clock-display";

export function GameShellPage() {
  const { actions, activeGame } = useCaissaApp();
  if (!activeGame) {
    return (
      <section className="state-card route-fade" aria-labelledby="empty-game-title">
        <p className="eyebrow">No active game</p>
        <h1 id="empty-game-title">Create a game to see the board</h1>
        <p>Caissa does not create or start a game automatically.</p>
        <Link className="button button-primary" to="/play/new">
          Open Game Setup
        </Link>
      </section>
    );
  }

  return (
    <ActiveGameShell
      activeGame={activeGame}
      onRetry={() => actions.retryCurrentGamePersistence()}
    />
  );
}

interface ActiveGameShellProps {
  readonly activeGame: NonNullable<ReturnType<typeof useCaissaApp>["activeGame"]>;
  readonly onRetry: () => Promise<"failed" | "nothing-pending" | "succeeded">;
}

export function ActiveGameShell({ activeGame, onRetry }: ActiveGameShellProps) {
  const { session } = activeGame;
  const clock = useClockDisplay(activeGame);
  const lastMove = session.history.at(-1);
  const status = gameStatusLabel(session);
  const white = createPlayerPanelModel("white", session.configuration.participants.white, session);
  const black = createPlayerPanelModel("black", session.configuration.participants.black, session);

  return (
    <section className="game-shell route-fade" aria-labelledby="game-status-title">
      <header className="game-shell-heading">
        <div>
          <p className="eyebrow">Local game · Read-only preview</p>
          <h1 id="game-status-title">{status}</h1>
        </div>
        <p className="game-id">Game {String(session.gameId)}</p>
      </header>

      <PersistenceStatus persistence={activeGame.persistence} onRetry={onRetry} />

      <div className="game-layout">
        <aside className="game-side game-players" aria-label="Players and game status">
          <PlayerPanel model={black} remainingMs={clock.blackRemainingMs} />
          <section className="game-info-panel" aria-labelledby="game-information-title">
            <h2 id="game-information-title">Game information</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{status}</dd>
              </div>
              <div>
                <dt>Time control</dt>
                <dd>{timeControlLabel(session.configuration.timeControl)}</dd>
              </div>
              <div>
                <dt>Undo policy</dt>
                <dd>{session.configuration.allowUndo ? "Allowed" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Orientation</dt>
                <dd>{capitalize(activeGame.orientation)}</dd>
              </div>
            </dl>
          </section>
          <PlayerPanel model={white} remainingMs={clock.whiteRemainingMs} />
        </aside>

        <div className="board-column">
          <ChessBoardAdapter
            ariaLabel={`Read-only chessboard, ${capitalize(activeGame.orientation)} orientation`}
            fen={session.position.fen}
            isInCheck={session.position.inCheck}
            {...(lastMove ? { lastMove: moveSquares(lastMove) } : {})}
            orientation={activeGame.orientation}
            turn={session.position.turn}
          />
          <p className="read-only-notice" role="note">
            This position is read-only. Move interaction and game controls arrive in the next play
            milestone; this game remains ready and no clock has been started.
          </p>
        </div>

        <aside className="game-side game-history" aria-label="Position and move history">
          <MoveHistory history={session.history} />
          <PositionCompanion activeGame={activeGame} />
        </aside>
      </div>
    </section>
  );
}

function PlayerPanel({
  model,
  remainingMs,
}: {
  readonly model: ReturnType<typeof createPlayerPanelModel>;
  readonly remainingMs: ClockDurationMs | undefined;
}) {
  return (
    <section className={model.isActive ? "player-panel is-active" : "player-panel"}>
      <div>
        <p className="player-color">{capitalize(model.color)}</p>
        <h2>{model.label}</h2>
        <p>{model.kindLabel}</p>
      </div>
      <p aria-label={`${capitalize(model.color)} clock`} className="clock-value">
        {formatClock(remainingMs)}
      </p>
      {model.isActive ? <span className="active-turn-label">Active turn</span> : null}
    </section>
  );
}

function MoveHistory({ history }: { readonly history: readonly MoveRecord[] }) {
  const rows = createMoveHistoryRows(history);
  return (
    <section aria-labelledby="move-history-title">
      <h2 id="move-history-title">Move history</h2>
      {rows.length === 0 ? (
        <p className="empty-copy">No moves yet. The game is ready.</p>
      ) : (
        <ol className="move-list">
          {rows.map((row) => (
            <li key={row.moveNumber}>
              <span>{row.moveNumber}.</span>
              <span className={row.white === history.at(-1) ? "is-current" : undefined}>
                {row.white?.san ?? "—"}
              </span>
              <span className={row.black === history.at(-1) ? "is-current" : undefined}>
                {row.black?.san ?? "—"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function PositionCompanion({
  activeGame,
}: {
  readonly activeGame: ActiveGameShellProps["activeGame"];
}) {
  const { session } = activeGame;
  const pieces = createPiecePositionSummary(session.position.fen);
  const lastMove = session.history.at(-1);
  return (
    <section className="position-companion" aria-labelledby="position-context-title">
      <h2 id="position-context-title">Position context</h2>
      <p role="status">
        {capitalize(session.position.turn)} to move{session.position.inCheck ? " and in check" : ""}
        .{lastMove ? ` Last move: ${lastMove.san}.` : " No move has been played."}
      </p>
      <p>Board orientation: {capitalize(activeGame.orientation)}.</p>
      <details>
        <summary>Position diagnostics</summary>
        <p>
          <strong>FEN:</strong> <code>{session.position.fen}</code>
        </p>
        <ul className="sr-piece-list">
          {pieces.map((piece) => (
            <li key={`${piece.color}-${piece.name}-${piece.square}`}>
              {capitalize(piece.color)} {piece.name} on {piece.square}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function PersistenceStatus({
  persistence,
  onRetry,
}: {
  readonly onRetry: ActiveGameShellProps["onRetry"];
  readonly persistence: ActiveGameShellProps["activeGame"]["persistence"];
}) {
  if (persistence.status === "clean") return null;
  if (persistence.status === "saving" || persistence.status === "retrying") {
    return (
      <p className="persistence-status" role="status">
        Saving this game locally…
      </p>
    );
  }
  const finalization = persistence.status === "finalization-pending";
  return (
    <section className="persistence-warning" aria-labelledby="persistence-warning-title">
      <div>
        <h2 id="persistence-warning-title">
          {finalization ? "History save is pending" : "Recent progress is not saved"}
        </h2>
        <p>
          {finalization
            ? "The completed game has not yet been saved to history. The chess result remains unchanged."
            : "The game is available in this session, but recent progress could be lost after refresh."}
        </p>
      </div>
      {persistence.retryAvailable ? (
        <button className="button button-secondary" onClick={() => void onRetry()} type="button">
          Retry Save
        </button>
      ) : null}
    </section>
  );
}

function moveSquares(move: MoveRecord) {
  const value = String(move.uci);
  return Object.freeze({
    from: value.slice(0, 2) as Square,
    to: value.slice(2, 4) as Square,
  });
}

function formatClock(value: ClockDurationMs | undefined): string {
  if (value === undefined) return "Untimed";
  const totalSeconds = Math.ceil(value / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
