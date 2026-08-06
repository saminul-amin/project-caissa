import { useRef } from "react";
import { Link } from "react-router-dom";
import type { ClockDurationMs, MoveRecord, Square } from "@caissa/chess-core";

import { useCaissaApp } from "../../app/CaissaAppProvider";
import { moveFeedbackMessage, projectBoardSelection } from "./board-interaction";
import { ChessBoardAdapter } from "./components/ChessBoardAdapter";
import { KeyboardChessBoard } from "./components/KeyboardChessBoard";
import { PromotionDialog } from "./components/PromotionDialog";
import {
  createMoveHistoryRows,
  createPlayerPanelModel,
  gameStatusLabel,
  timeControlLabel,
} from "./game-shell-projections";
import { createPiecePositionSummary } from "./position-summary";
import {
  useActiveGameInteraction,
  type ActiveGameInteraction,
} from "./use-active-game-interaction";
import { useClockDisplay } from "./use-clock-display";

export function GameShellPage() {
  const { activeGame } = useCaissaApp();
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

  return <ActiveGameShellContainer activeGame={activeGame} />;
}

function ActiveGameShellContainer({
  activeGame,
}: {
  readonly activeGame: NonNullable<ReturnType<typeof useCaissaApp>["activeGame"]>;
}) {
  const interaction = useActiveGameInteraction(activeGame);
  return (
    <ActiveGameShell
      activeGame={activeGame}
      interaction={interaction}
      onRetry={() => interaction.retryPersistence()}
    />
  );
}

interface ActiveGameShellProps {
  readonly activeGame: NonNullable<ReturnType<typeof useCaissaApp>["activeGame"]>;
  readonly interaction?: ActiveGameInteraction;
  readonly onRetry: () => Promise<unknown>;
}

export function ActiveGameShell({ activeGame, interaction, onRetry }: ActiveGameShellProps) {
  const { session } = activeGame;
  const statusRef = useRef<HTMLHeadingElement>(null);
  const clock = useClockDisplay(activeGame);
  const lastMove = session.history.at(-1);
  const status = gameStatusLabel(session);
  const white = createPlayerPanelModel("white", session.configuration.participants.white, session);
  const black = createPlayerPanelModel("black", session.configuration.participants.black, session);
  const boardSelection = projectBoardSelection(interaction?.interaction ?? { status: "idle" });
  const isSubmitting = interaction?.interaction.status === "submitting";

  const beginGame = async () => {
    if (!interaction) return;
    const result = await interaction.startGame();
    if (result.status === "applied") statusRef.current?.focus();
  };

  return (
    <section className="game-shell route-fade" aria-labelledby="game-status-title">
      <header className="game-shell-heading">
        <div>
          <p className="eyebrow">Local human game</p>
          <h1 id="game-status-title" ref={statusRef} tabIndex={-1}>
            {status}
          </h1>
        </div>
        <p className="game-id">Game {String(session.gameId)}</p>
      </header>

      <PersistenceStatus persistence={activeGame.persistence} onRetry={onRetry} />

      {session.lifecycle.phase === "ready" && interaction ? (
        <section className="begin-game-panel" aria-labelledby="begin-game-title">
          <div>
            <h2 id="begin-game-title">Ready when you are</h2>
            <p>
              This game remains ready and no clock has been started. The board is a preview until
              you begin.
            </p>
          </div>
          <button
            className="button button-primary"
            disabled={interaction.isStarting}
            onClick={() => void beginGame()}
            type="button"
          >
            {interaction.isStarting ? "Beginning..." : "Begin Game"}
          </button>
        </section>
      ) : null}

      {interaction?.feedback ? (
        <p className="move-feedback" role="status">
          {moveFeedbackMessage(interaction.feedback)}
        </p>
      ) : null}

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
          <div className="interactive-board-stack">
            <ChessBoardAdapter
              ariaLabel={`${interaction?.isInteractive ? "Interactive" : "Read-only"} chessboard, ${capitalize(activeGame.orientation)} orientation`}
              captureTargets={boardSelection.captureTargets}
              fen={session.position.fen}
              interactive={interaction?.isInteractive ?? false}
              isInCheck={session.position.inCheck}
              {...(lastMove ? { lastMove: moveSquares(lastMove) } : {})}
              legalTargets={boardSelection.legalTargets}
              onMoveIntent={(intent) => void interaction?.attemptMove(intent)}
              onSquareActivate={(square, inputMethod) =>
                void interaction?.selectSquare(square, inputMethod)
              }
              orientation={activeGame.orientation}
              {...(boardSelection.selectedSource
                ? { selectedSource: boardSelection.selectedSource }
                : {})}
              turn={session.position.turn}
            />
            {interaction ? (
              <KeyboardChessBoard
                disabled={!interaction.isInteractive}
                fen={session.position.fen}
                legalTargets={boardSelection.legalTargets}
                onActivate={(square) => void interaction.selectSquare(square, "keyboard")}
                onClearSelection={interaction.clearSelection}
                orientation={activeGame.orientation}
                selectedSource={boardSelection.selectedSource}
              />
            ) : null}
          </div>
          <p className="board-guidance" role="note">
            {isSubmitting
              ? "Committing your move..."
              : interaction?.isInteractive
                ? "Move by drag, click or tap a source and destination, or use the keyboard board."
                : (interaction?.disabledReason ?? "This position is read-only.")}
          </p>
        </div>

        <aside className="game-side game-history" aria-label="Position and move history">
          <MoveHistory history={session.history} />
          <PositionCompanion activeGame={activeGame} />
        </aside>
      </div>

      {interaction?.interaction.status === "promotion-required" ? (
        <PromotionDialog
          choices={interaction.interaction.choices}
          color={interaction.interaction.color}
          onCancel={interaction.cancelPromotion}
          onChoose={(piece) => void interaction.choosePromotion(piece)}
        />
      ) : null}

      {interaction ? (
        <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
          {interaction.announcement}
        </p>
      ) : null}
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
                {row.white?.san ?? "-"}
              </span>
              <span className={row.black === history.at(-1) ? "is-current" : undefined}>
                {row.black?.san ?? "-"}
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
        {"Saving this game locally\u2026"}
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
