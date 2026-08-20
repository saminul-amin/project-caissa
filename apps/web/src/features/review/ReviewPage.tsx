import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { parseGameId } from "@caissa/chess-core";

import type { GameReviewReport, ReviewProgress } from "../../application/review";
import { useCaissaApp } from "../../app/CaissaAppProvider";
import {
  createAccuracyCard,
  createEvaluationCurve,
  createMoveRow,
  summaryHeadline,
  toSvgPolyline,
} from "./review-presentation";

type ReviewState =
  | { readonly kind: "idle" }
  | { readonly kind: "running"; readonly progress: ReviewProgress | undefined }
  | { readonly kind: "ready"; readonly report: GameReviewReport }
  | { readonly detail: string; readonly kind: "unavailable" };

const CHART_WIDTH = 640;
const CHART_HEIGHT = 120;

export function ReviewPage() {
  const { application } = useCaissaApp();
  const { gameId: rawGameId } = useParams<{ gameId: string }>();
  const [state, setState] = useState<ReviewState>({ kind: "running", progress: undefined });
  const [runToken, setRunToken] = useState(0);

  // Every state update happens after an await so the first render never cascades.
  useEffect(() => {
    const signal = { cancelled: false };

    void (async () => {
      const gameId = safeGameId(rawGameId);
      if (!gameId) {
        if (!signal.cancelled) {
          setState({ detail: "That game identifier is not valid.", kind: "unavailable" });
        }
        return;
      }

      const result = await application.reviewService.generateReview({
        gameId,
        onProgress: (progress) => {
          if (signal.cancelled) return;
          setState((current) =>
            current.kind === "running" ? { kind: "running", progress } : current,
          );
        },
        signal,
      });
      if (signal.cancelled) return;

      if (result.status === "completed") {
        setState({ kind: "ready", report: result.report });
        return;
      }
      if (result.status === "cancelled") {
        setState({ kind: "idle" });
        return;
      }
      setState({
        detail:
          result.status === "game-not-found"
            ? "That game is not saved in this browser."
            : result.reason,
        kind: "unavailable",
      });
    })();

    return () => {
      signal.cancelled = true;
      application.reviewService.cancel();
    };
  }, [application, rawGameId, runToken]);

  const run = useCallback(() => {
    setState({ kind: "running", progress: undefined });
    setRunToken((value) => value + 1);
  }, []);

  return (
    <section aria-labelledby="review-title" className="review-page route-fade">
      <header className="page-heading">
        <p className="eyebrow">Guided review</p>
        <h1 id="review-title">Game review</h1>
        <p>
          Caissa replays your game through the bundled engine and points out the moments that
          mattered. Every judgement below comes from that analysis, not from a guess about intent.
        </p>
      </header>

      {state.kind === "running" ? <ReviewProgressPanel progress={state.progress} /> : null}

      {state.kind === "unavailable" ? (
        <section aria-labelledby="review-unavailable-title" className="state-card">
          <h2 id="review-unavailable-title">Review unavailable</h2>
          <p>{state.detail}</p>
          <div className="state-actions">
            <button className="button button-secondary" onClick={run} type="button">
              Try Again
            </button>
            <Link className="button button-ghost" to="/history">
              Back to History
            </Link>
          </div>
        </section>
      ) : null}

      {state.kind === "ready" ? <ReviewReport report={state.report} /> : null}
    </section>
  );
}

function safeGameId(value: string | undefined) {
  if (value === undefined) return undefined;
  try {
    return parseGameId(value);
  } catch {
    return undefined;
  }
}

function ReviewProgressPanel({ progress }: { readonly progress: ReviewProgress | undefined }) {
  const percent = progress
    ? Math.round((progress.analyzedPositions / Math.max(1, progress.totalPositions)) * 100)
    : 0;

  return (
    <section aria-live="polite" className="opponent-status is-loading" role="status">
      <div className="opponent-status-body">
        <p className="opponent-status-title">Analysing your game</p>
        <p className="opponent-status-detail">
          {progress
            ? `Position ${String(progress.analyzedPositions)} of ${String(progress.totalPositions)}.`
            : "Preparing the engine. The first review of a session takes a little longer."}
        </p>
      </div>
      <div aria-hidden="true" className="opponent-progress" data-indeterminate="false">
        <span style={{ width: `${String(percent)}%` }} />
      </div>
    </section>
  );
}

function ReviewReport({ report }: { readonly report: GameReviewReport }) {
  const curve = createEvaluationCurve(report);
  const white = createAccuracyCard("white", "White", report.white);
  const black = createAccuracyCard("black", "Black", report.black);

  return (
    <>
      <p className="review-headline">{summaryHeadline(report)}</p>

      <div className="review-accuracy">
        {[white, black].map((card) => (
          <section className="review-accuracy-card" key={card.color}>
            <p className="player-color">{card.name}</p>
            <p className="review-accuracy-value">{card.accuracyLabel}</p>
            <p className="opponent-status-detail">Accuracy</p>
            <p className="review-accuracy-counts">{card.countsLabel}</p>
          </section>
        ))}
      </div>

      <section aria-labelledby="review-curve-title" className="review-curve">
        <h2 id="review-curve-title">Evaluation over the game</h2>
        <p className="opponent-status-detail">
          Higher means White is doing better. The line follows the engine evaluation after each
          move.
        </p>
        <svg
          aria-hidden="true"
          className="review-curve-chart"
          preserveAspectRatio="none"
          viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
        >
          <line
            className="review-curve-midline"
            x1="0"
            x2={String(CHART_WIDTH)}
            y1={String(CHART_HEIGHT / 2)}
            y2={String(CHART_HEIGHT / 2)}
          />
          <polyline
            className="review-curve-line"
            points={toSvgPolyline(curve, CHART_WIDTH, CHART_HEIGHT)}
          />
        </svg>
      </section>

      <section aria-labelledby="review-moments-title" className="review-moments">
        <h2 id="review-moments-title">Key moments</h2>
        {report.keyMoments.length === 0 ? (
          <p className="empty-copy">
            Nothing in this game cost either side a meaningful share of the result.
          </p>
        ) : (
          <ol className="review-moment-list">
            {report.keyMoments.map((moment) => (
              <li key={moment.ply}>
                <h3>{moment.headline}</h3>
                <p>{moment.explanation}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="review-moves-title" className="review-moves">
        <h2 id="review-moves-title">Every move</h2>
        <ol className="review-move-list">
          {report.moves.map((move) => {
            const row = createMoveRow(move);
            return (
              <li
                className="review-move-row"
                data-classification={row.classification}
                key={row.ply}
              >
                <span className="review-move-number">{row.numberLabel}</span>
                <span className="review-move-san">{row.san}</span>
                <span className="review-move-classification">{row.classificationLabel}</span>
                <span className="review-move-evaluation">{row.evaluationLabel}</span>
                <span className="review-move-suggestion">{row.suggestionLabel ?? ""}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="field-note">
        Analysed with {report.engineVersion} at depth {String(report.analysisDepth)}. Accuracy is an
        estimate of decision quality from engine evaluations, not a rating.
      </p>
    </>
  );
}
