import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { GameId } from "@caissa/chess-core";

import {
  CLEAR_HISTORY_CONFIRMATION,
  DELETE_COMPLETED_GAME_CONFIRMATION,
  type GameHistoryListItem,
} from "../../application/history";
import { useCaissaApp } from "../../app/CaissaAppProvider";
import { ConfirmationDialog } from "../../components/ConfirmationDialog";
import { createHistoryRowModel } from "./history-presentation";

type LoadState =
  | { readonly kind: "loading" }
  | { readonly items: readonly GameHistoryListItem[]; readonly kind: "loaded" }
  | { readonly detail: string; readonly kind: "unavailable" };

export function HistoryPage() {
  const { application } = useCaissaApp();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [notice, setNotice] = useState<string | undefined>();
  const [pendingDelete, setPendingDelete] = useState<GameHistoryListItem | undefined>();
  const [confirmClear, setConfirmClear] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // The effect only subscribes; it never sets state before the first await, which keeps the
  // initial render free of cascading updates.
  useEffect(() => {
    const signal = { cancelled: false };
    void (async () => {
      const result = await application.historyService.listGames();
      if (signal.cancelled) return;
      setState(
        result.status === "listed"
          ? { items: result.items, kind: "loaded" }
          : {
              detail:
                result.status === "storage-unavailable"
                  ? "Local storage is unavailable, so saved games cannot be listed right now."
                  : "Caissa could not read your saved games.",
              kind: "unavailable",
            },
      );
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [application, reloadToken]);

  const load = useCallback(() => {
    setState({ kind: "loading" });
    setReloadToken((value) => value + 1);
  }, []);

  async function exportGame(gameId: GameId) {
    const result = await application.historyService.createPgnExport(gameId);
    if (result.status !== "ready") {
      setNotice("Caissa could not export that game.");
      return;
    }
    const downloaded = downloadTextFile(
      result.descriptor.filename,
      String(result.descriptor.content),
      result.descriptor.mimeType,
    );
    setNotice(
      downloaded ? `Exported ${result.descriptor.filename}.` : "Downloads are unavailable here.",
    );
  }

  async function deleteGame(item: GameHistoryListItem) {
    const result = await application.historyService.deleteGame({
      confirmation: DELETE_COMPLETED_GAME_CONFIRMATION,
      gameId: item.gameId,
    });
    setPendingDelete(undefined);
    setNotice(
      result.status === "deleted" || result.status === "deleted-with-cleanup-warning"
        ? "Game deleted."
        : "Caissa could not delete that game.",
    );
    load();
  }

  async function clearHistory() {
    const result = await application.historyService.clearHistory({
      confirmation: CLEAR_HISTORY_CONFIRMATION,
    });
    setConfirmClear(false);
    setNotice(
      result.status === "cleared" || result.status === "cleared-with-cleanup-warning"
        ? "All saved games were deleted."
        : "Caissa could not clear your history.",
    );
    load();
  }

  return (
    <section aria-labelledby="history-title" className="history-page route-fade">
      <header className="page-heading">
        <p className="eyebrow">On this device</p>
        <h1 id="history-title">Game history</h1>
        <p>
          Every finished game is stored in this browser only. Nothing is uploaded, and clearing your
          browser data removes it.
        </p>
      </header>

      {notice ? (
        <p className="move-feedback" role="status">
          {notice}
        </p>
      ) : null}

      {state.kind === "loading" ? (
        <p aria-busy="true" className="empty-copy">
          Reading your saved games…
        </p>
      ) : null}

      {state.kind === "unavailable" ? (
        <section aria-labelledby="history-unavailable-title" className="state-card">
          <h2 id="history-unavailable-title">History is unavailable</h2>
          <p>{state.detail}</p>
          <button className="button button-secondary" onClick={load} type="button">
            Try Again
          </button>
        </section>
      ) : null}

      {state.kind === "loaded" && state.items.length === 0 ? (
        <section aria-labelledby="history-empty-title" className="state-card">
          <h2 id="history-empty-title">No finished games yet</h2>
          <p>Play a game to the end and it will appear here with its moves and result.</p>
          <Link className="button button-primary" to="/play/new">
            Start a Game
          </Link>
        </section>
      ) : null}

      {state.kind === "loaded" && state.items.length > 0 ? (
        <>
          <ul className="history-list">
            {state.items.map((item) => {
              const row = createHistoryRowModel(item);
              return (
                <li className="history-row" data-outcome={row.outcome} key={row.gameId}>
                  <div className="history-row-main">
                    <p className="history-result">{row.resultLabel}</p>
                    <p className="history-players">
                      {row.whiteLabel} vs {row.blackLabel}
                    </p>
                    <p className="history-meta">
                      {row.completedLabel} · {row.moveLabel} · {row.timeControlLabel} ·{" "}
                      {row.reviewLabel}
                    </p>
                  </div>
                  <div className="history-row-actions">
                    <button
                      className="button button-secondary"
                      onClick={() => void navigate(`/review/${row.gameId}`)}
                      type="button"
                    >
                      Review
                    </button>
                    <button
                      className="button button-ghost"
                      onClick={() => void exportGame(item.gameId)}
                      type="button"
                    >
                      Export PGN
                    </button>
                    <button
                      className="button button-ghost"
                      onClick={() => {
                        setPendingDelete(item);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            className="button button-ghost history-clear"
            onClick={() => {
              setConfirmClear(true);
            }}
            type="button"
          >
            Delete All Saved Games
          </button>
        </>
      ) : null}

      {pendingDelete ? (
        <ConfirmationDialog
          cancelLabel="Keep Game"
          confirmLabel="Delete Game"
          destructive
          onCancel={() => {
            setPendingDelete(undefined);
          }}
          onConfirm={() => void deleteGame(pendingDelete)}
          title="Delete this game?"
        >
          <p>The moves, result, and any review for this game will be removed from this browser.</p>
          <p>This cannot be undone.</p>
        </ConfirmationDialog>
      ) : null}

      {confirmClear ? (
        <ConfirmationDialog
          cancelLabel="Keep My Games"
          confirmLabel="Delete Everything"
          destructive
          onCancel={() => {
            setConfirmClear(false);
          }}
          onConfirm={() => void clearHistory()}
          title="Delete every saved game?"
        >
          <p>All finished games and their reviews will be removed from this browser.</p>
          <p>This cannot be undone.</p>
        </ConfirmationDialog>
      ) : null}
    </section>
  );
}

function downloadTextFile(filename: string, content: string, mimeType: string): boolean {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.download = filename;
    anchor.href = url;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
