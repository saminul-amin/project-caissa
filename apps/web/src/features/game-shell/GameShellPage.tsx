import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ClockDurationMs, MoveRecord, Square } from "@caissa/chess-core";

import type { OpponentRuntimeStatus } from "../../application/opponent";

import { useCaissaApp } from "../../app/CaissaAppProvider";
import { useReducedMotion } from "../../app/use-preference-effects";
import { revealRowInList } from "../../components/list-scroll";
import { moveFeedbackMessage, projectBoardSelection } from "./board-interaction";
import { ChessBoardAdapter } from "./components/ChessBoardAdapter";
import { GameControlsPanel } from "./components/GameControlsPanel";
import { GameResultPanel } from "./components/GameResultPanel";
import { OpponentStatusPanel } from "./components/OpponentStatusPanel";
import { KeyboardChessBoard } from "./components/KeyboardChessBoard";
import { PromotionDialog } from "./components/PromotionDialog";
import {
  boardPlayerOrder,
  clockUrgency,
  createMoveHistoryRows,
  createPlayerPanelModel,
  gameStatusLabel,
  timeControlLabel,
} from "./game-shell-projections";
import {
  gameModeLabel,
  localPlayerColor,
  opponentLabel,
  projectGameResult,
  projectOpponentPanel,
} from "./opponent-presentation";
import { createPiecePositionSummary } from "./position-summary";
import {
  useActiveGameInteraction,
  type ActiveGameInteraction,
} from "./use-active-game-interaction";
import { useActiveGameControls, type ActiveGameControls } from "./use-active-game-controls";
import { useClockDisplay } from "./use-clock-display";

/** Piece travel time when motion is allowed; zero under a reduced-motion preference. */
const PIECE_ANIMATION_MS = 180;

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
  const { actions, opponentStatus, preferences } = useCaissaApp();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion(preferences);
  const interaction = useActiveGameInteraction(activeGame);
  const controls = useActiveGameControls(activeGame, {
    interactionStatus:
      interaction.interaction.status === "promotion-required"
        ? "promotion-pending"
        : interaction.interaction.status === "submitting" || interaction.isStarting
          ? "move-pending"
          : "idle",
    onReconcileInteraction: interaction.clearSelection,
  });
  return (
    <ActiveGameShell
      activeGame={activeGame}
      controls={controls}
      interaction={interaction}
      onExportPgn={actions.exportCurrentGamePgn}
      onNewGame={() => void navigate("/play/new")}
      onRetry={() => controls.retryPersistence()}
      onRetryOpponent={() => void actions.retryOpponentTurn()}
      onReview={(gameId) => void navigate(`/review/${gameId}`)}
      opponentStatus={opponentStatus}
      pieceAnimationMs={reduceMotion ? 0 : PIECE_ANIMATION_MS}
      reduceMotion={reduceMotion}
    />
  );
}

interface ActiveGameShellProps {
  readonly activeGame: NonNullable<ReturnType<typeof useCaissaApp>["activeGame"]>;
  readonly controls?: ActiveGameControls;
  readonly interaction?: ActiveGameInteraction;
  readonly onExportPgn?: () => string | undefined;
  readonly onNewGame?: () => void;
  readonly onRetry: () => Promise<unknown>;
  readonly onRetryOpponent?: () => void;
  readonly onReview?: (gameId: string) => void;
  readonly opponentStatus?: OpponentRuntimeStatus;
  readonly pieceAnimationMs?: number;
  readonly reduceMotion?: boolean;
}

export function ActiveGameShell({
  activeGame,
  controls,
  interaction,
  onExportPgn,
  onNewGame,
  onRetry,
  onRetryOpponent,
  onReview,
  opponentStatus = { kind: "idle" },
  pieceAnimationMs = 0,
  reduceMotion = true,
}: ActiveGameShellProps) {
  const { session } = activeGame;
  const statusRef = useRef<HTMLHeadingElement>(null);
  const clock = useClockDisplay(activeGame);
  const lastMove = session.history.at(-1);
  const status = gameStatusLabel(session);
  const panels = {
    black: createPlayerPanelModel("black", session.configuration.participants.black, session),
    white: createPlayerPanelModel("white", session.configuration.participants.white, session),
  } as const;
  const remaining = { black: clock.blackRemainingMs, white: clock.whiteRemainingMs } as const;
  const [topColor, bottomColor] = boardPlayerOrder(activeGame.orientation);
  const boardSelection = projectBoardSelection(interaction?.interaction ?? { status: "idle" });
  const isSubmitting = interaction?.interaction.status === "submitting";
  const controlsLocked = controls?.isLocked ?? false;
  const [pgnNotice, setPgnNotice] = useState<string | undefined>();
  const opponentPanel = projectOpponentPanel({
    hasExternalOpponent: activeGame.hasExternalOpponent,
    opponentLabel: activeGame.hasExternalOpponent ? opponentLabel(session) : "Caissa",
    session,
    status: opponentStatus,
  });
  const completedResult = session.result;

  useEffect(() => {
    if (controls?.focusStatusRequest) statusRef.current?.focus();
  }, [controls?.focusStatusRequest]);

  const beginGame = async () => {
    if (!interaction) return;
    const result = await interaction.startGame();
    if (result.status === "applied") statusRef.current?.focus();
  };

  return (
    <section className="game-shell route-fade" aria-labelledby="game-status-title">
      <header className="game-shell-heading">
        <div>
          <p className="eyebrow">{gameModeLabel(session)}</p>
          <h1 id="game-status-title" ref={statusRef} tabIndex={-1}>
            {status}
          </h1>
        </div>
        <p className="game-id">Game {String(session.gameId)}</p>
      </header>

      <PersistenceStatus persistence={activeGame.persistence} onRetry={onRetry} />

      <OpponentStatusPanel onRetry={() => onRetryOpponent?.()} state={opponentPanel} />

      {completedResult ? (
        <GameResultPanel
          {...projectGameResult({
            playerColor: localPlayerColor(session),
            result: completedResult,
          })}
          isSaved={activeGame.persistence.status !== "finalization-pending"}
          onExportPgn={() => {
            const pgn = onExportPgn?.();
            if (!pgn) {
              setPgnNotice("Caissa could not read the moves for this game.");
              return;
            }
            void copyPgnToClipboard(pgn).then((copied) => {
              setPgnNotice(
                copied
                  ? "PGN copied to your clipboard."
                  : "Copying is unavailable here. You can export this game from History instead.",
              );
            });
          }}
          onNewGame={() => onNewGame?.()}
          onReview={() => onReview?.(String(session.gameId))}
        />
      ) : null}

      {pgnNotice ? (
        <p className="move-feedback" role="status">
          {pgnNotice}
        </p>
      ) : null}

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
        <div className="board-column">
          <PlayerPanel
            clockStatus={clock.status}
            model={panels[topColor]}
            remainingMs={remaining[topColor]}
          />
          <div className="interactive-board-stack">
            <ChessBoardAdapter
              animationDurationMs={pieceAnimationMs}
              ariaLabel={`${interaction?.isInteractive ? "Interactive" : "Read-only"} chessboard, ${capitalize(activeGame.orientation)} orientation`}
              captureTargets={boardSelection.captureTargets}
              fen={session.position.fen}
              interactive={(interaction?.isInteractive ?? false) && !controlsLocked}
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
                disabled={!interaction.isInteractive || controlsLocked}
                fen={session.position.fen}
                legalTargets={boardSelection.legalTargets}
                onActivate={(square) => void interaction.selectSquare(square, "keyboard")}
                onClearSelection={interaction.clearSelection}
                orientation={activeGame.orientation}
                selectedSource={boardSelection.selectedSource}
              />
            ) : null}
          </div>
          <PlayerPanel
            clockStatus={clock.status}
            model={panels[bottomColor]}
            remainingMs={remaining[bottomColor]}
          />
          <p className="board-guidance" role="note">
            {controlsLocked
              ? "A game control is in progress. Board input is temporarily unavailable."
              : isSubmitting
                ? "Committing your move..."
                : interaction?.isInteractive
                  ? "Move by drag, click or tap a source and destination, or use the keyboard board."
                  : (interaction?.disabledReason ?? "This position is read-only.")}
          </p>
          {controls ? (
            <GameControlsPanel
              controls={controls}
              isPaused={session.lifecycle.phase === "paused"}
            />
          ) : null}
        </div>

        <aside className="game-rail" aria-label="Move history and game status">
          <MoveHistory history={session.history} reduceMotion={reduceMotion} />
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
          <PositionCompanion activeGame={activeGame} />
        </aside>
      </div>

      {interaction?.interaction.status === "promotion-required" ? (
        <PromotionDialog
          choices={interaction.interaction.choices}
          color={interaction.interaction.color}
          disabled={controlsLocked}
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
  clockStatus,
  model,
  remainingMs,
}: {
  readonly clockStatus: ReturnType<typeof useClockDisplay>["status"];
  readonly model: ReturnType<typeof createPlayerPanelModel>;
  readonly remainingMs: ClockDurationMs | undefined;
}) {
  const urgency = clockUrgency(remainingMs, clockStatus === "running" && model.isActive);
  return (
    <section
      className={model.isActive ? "player-panel is-active" : "player-panel"}
      data-color={model.color}
    >
      <span aria-hidden="true" className="player-swatch" />
      <div className="player-identity">
        <p className="player-color">{capitalize(model.color)}</p>
        <h2>{model.label}</h2>
        <p>{model.kindLabel}</p>
      </div>
      <p
        aria-label={`${capitalize(model.color)} clock`}
        className="clock-value"
        data-urgency={urgency}
      >
        {formatClock(remainingMs)}
      </p>
      {model.isActive ? <span className="active-turn-label">Active turn</span> : null}
    </section>
  );
}

function MoveHistory({
  history,
  reduceMotion,
}: {
  readonly history: readonly MoveRecord[];
  readonly reduceMotion: boolean;
}) {
  const rows = createMoveHistoryRows(history);
  const listRef = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);
  const lastPly = history.length;

  useEffect(() => {
    const list = listRef.current;
    const row = currentRef.current;
    if (!list || !row) return;
    revealRowInList(list, row, { reduceMotion });
  }, [lastPly, reduceMotion]);

  return (
    <section aria-labelledby="move-history-title" className="move-history" ref={listRef}>
      <h2 id="move-history-title">Move history</h2>
      {rows.length === 0 ? (
        <p className="empty-copy">No moves yet. The game is ready.</p>
      ) : (
        <ol className="move-list">
          {rows.map((row, index) => (
            <li key={row.moveNumber} ref={index === rows.length - 1 ? currentRef : undefined}>
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

async function copyPgnToClipboard(pgn: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || typeof navigator.clipboard !== "object") return false;
    await navigator.clipboard.writeText(pgn);
    return true;
  } catch {
    return false;
  }
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
