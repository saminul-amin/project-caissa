import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { parseGameId } from "@caissa/chess-core";

import type { GameReviewReport, ReviewProgress } from "../../application/review";
import { useCaissaApp } from "../../app/CaissaAppProvider";
import { useReducedMotion } from "../../app/use-preference-effects";
import { revealRowInList } from "../../components/list-scroll";
import { ChessBoardAdapter } from "../game-shell/components/ChessBoardAdapter";
import {
  accuracyBarPercent,
  createAccuracyCard,
  createEvaluationCurve,
  createMoveRow,
  createReviewBoardModel,
  curveMarkerPosition,
  defaultReviewPly,
  findReviewedMove,
  stepKeyMoment,
  stepReviewPly,
  summaryHeadline,
  toSvgPolyline,
  type ReviewStep,
} from "./review-presentation";

type ReviewState =
  | { readonly kind: "idle" }
  | { readonly kind: "running"; readonly progress: ReviewProgress | undefined }
  | { readonly kind: "ready"; readonly report: GameReviewReport }
  | { readonly detail: string; readonly kind: "unavailable" };

const CHART_WIDTH = 640;
const CHART_HEIGHT = 160;
/** Piece travel time when stepping through the review with motion allowed. */
const REVIEW_PIECE_ANIMATION_MS = 200;

export function ReviewPage() {
  const { application, preferences } = useCaissaApp();
  const reduceMotion = useReducedMotion(preferences);
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
      <header className="page-heading review-heading">
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

      {state.kind === "ready" ? (
        <ReviewReport reduceMotion={reduceMotion} report={state.report} />
      ) : null}
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

function ReviewReport({
  reduceMotion,
  report,
}: {
  readonly reduceMotion: boolean;
  readonly report: GameReviewReport;
}) {
  const curve = createEvaluationCurve(report);
  const white = createAccuracyCard("white", "White", report.white);
  const black = createAccuracyCard("black", "Black", report.black);
  const [chosenPly, setChosenPly] = useState<number | undefined>(undefined);
  const activePly = chosenPly ?? defaultReviewPly(report);
  const activeMove = activePly === undefined ? undefined : findReviewedMove(report, activePly);
  const board = activeMove ? createReviewBoardModel(activeMove) : undefined;
  const marker = activePly === undefined ? undefined : curveMarkerPosition(curve, activePly);
  const activeMomentIndex = report.keyMoments.findIndex((moment) => moment.ply === activePly);
  const moveListRef = useRef<HTMLOListElement>(null);
  const currentRowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const list = moveListRef.current;
    const row = currentRowRef.current;
    if (!list || !row) return;
    revealRowInList(list, row, { reduceMotion });
  }, [activePly, reduceMotion]);

  const step = (direction: ReviewStep) => {
    if (activePly === undefined) return;
    setChosenPly(stepReviewPly(report, activePly, direction));
  };
  const stepMoment = (direction: "next" | "previous") => {
    if (activePly === undefined) return;
    const next = stepKeyMoment(report, activePly, direction);
    if (next !== undefined) setChosenPly(next);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    const mapping: Readonly<Record<string, ReviewStep>> = {
      ArrowLeft: "previous",
      ArrowRight: "next",
      End: "last",
      Home: "first",
    };
    const direction = mapping[event.key];
    if (!direction) return;
    event.preventDefault();
    step(direction);
  };

  const firstPly = report.moves[0]?.ply;
  const lastPly = report.moves.at(-1)?.ply;

  return (
    <>
      <section aria-labelledby="review-verdict-title" className="review-verdict">
        <h2 className="review-headline" id="review-verdict-title">
          {summaryHeadline(report)}
        </h2>
        <div className="review-accuracy">
          {[white, black].map((card) => (
            <section
              aria-label={`${card.name} accuracy`}
              className="review-accuracy-card"
              data-color={card.color}
              key={card.color}
            >
              <p className="player-color">{card.name}</p>
              <p className="review-accuracy-value">{card.accuracyLabel}</p>
              <p className="opponent-status-detail">Accuracy</p>
              <span aria-hidden="true" className="review-accuracy-bar">
                <span
                  style={{
                    width: `${String(accuracyBarPercent(card.color === "white" ? report.white : report.black))}%`,
                  }}
                />
              </span>
              <p className="review-accuracy-counts">{card.countsLabel}</p>
            </section>
          ))}
        </div>
      </section>

      {board && activeMove ? (
        <section
          aria-labelledby="review-board-title"
          className="review-study"
          onKeyDown={handleKeyDown}
        >
          <h2 className="sr-only" id="review-board-title">
            Position on the board
          </h2>
          <div className="review-board">
            <ChessBoardAdapter
              animationDurationMs={reduceMotion ? 0 : REVIEW_PIECE_ANIMATION_MS}
              ariaLabel={`Read-only chessboard, White orientation. ${board.description}.`}
              fen={board.fen}
              isInCheck={false}
              lastMove={board.lastMove}
              orientation="white"
              turn={board.turn}
            />
          </div>
          <div className="review-moment-panel">
            <p className="eyebrow">
              {activeMomentIndex >= 0
                ? `Key moment ${String(activeMomentIndex + 1)} of ${String(report.keyMoments.length)}`
                : "Every move"}
            </p>
            <p className="review-moment-move">
              <span className="review-move-number">
                {activeMove.mover === "white"
                  ? `${String(activeMove.moveNumber)}.`
                  : `${String(activeMove.moveNumber)}…`}
              </span>{" "}
              <span className="review-move-san">{String(activeMove.san)}</span>
            </p>
            <p
              className="review-moment-classification"
              data-classification={activeMove.classification}
            >
              {createMoveRow(activeMove).classificationLabel}
              {createMoveRow(activeMove).suggestionLabel
                ? ` · ${createMoveRow(activeMove).suggestionLabel ?? ""}`
                : ""}
            </p>
            <p className="review-moment-explanation">
              {activeMomentIndex >= 0
                ? report.keyMoments[activeMomentIndex]?.explanation
                : `${board.description}. Evaluation after the move: ${createMoveRow(activeMove).evaluationLabel}.`}
            </p>
            <div className="review-stepper" role="group" aria-label="Move navigation">
              <StepButton
                label="First move"
                onActivate={() => {
                  step("first");
                }}
                symbol="⇤"
                unavailable={activePly === firstPly}
              />
              <StepButton
                label="Previous move"
                onActivate={() => {
                  step("previous");
                }}
                symbol="←"
                unavailable={activePly === firstPly}
              />
              <StepButton
                label="Next move"
                onActivate={() => {
                  step("next");
                }}
                symbol="→"
                unavailable={activePly === lastPly}
              />
              <StepButton
                label="Last move"
                onActivate={() => {
                  step("last");
                }}
                symbol="⇥"
                unavailable={activePly === lastPly}
              />
            </div>
            {report.keyMoments.length > 0 ? (
              <div className="review-stepper" role="group" aria-label="Key moment navigation">
                <StepButton
                  label="Previous key moment"
                  onActivate={() => {
                    stepMoment("previous");
                  }}
                  unavailable={stepKeyMoment(report, activePly ?? 0, "previous") === undefined}
                />
                <StepButton
                  label="Next key moment"
                  onActivate={() => {
                    stepMoment("next");
                  }}
                  unavailable={stepKeyMoment(report, activePly ?? 0, "next") === undefined}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="review-curve-title" className="review-curve">
        <div className="review-curve-heading">
          <h2 id="review-curve-title">Evaluation over the game</h2>
          <p className="opponent-status-detail">
            Higher means White is doing better. The line follows the engine evaluation after each
            move.
          </p>
        </div>
        <div className="review-curve-box">
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
          {marker ? (
            <span
              aria-hidden="true"
              className="review-curve-marker"
              style={{
                left: `${String(marker.leftPercent)}%`,
                top: `${String(marker.topPercent)}%`,
              }}
            />
          ) : null}
        </div>
        {firstPly !== undefined && lastPly !== undefined && activePly !== undefined ? (
          <input
            aria-label="Move position"
            aria-valuetext={
              activeMove ? `${String(activeMove.moveNumber)}. ${String(activeMove.san)}` : undefined
            }
            className="review-curve-scrubber"
            max={lastPly}
            min={firstPly}
            onChange={(event) => {
              setChosenPly(Number(event.target.value));
            }}
            step={1}
            type="range"
            value={activePly}
          />
        ) : null}
      </section>

      <section aria-labelledby="review-moments-title" className="review-moments">
        <h2 id="review-moments-title">Key moments</h2>
        {report.keyMoments.length === 0 ? (
          <p className="empty-copy">
            Nothing in this game cost either side a meaningful share of the result.
          </p>
        ) : (
          <ol className="review-moment-list">
            {report.keyMoments.map((moment, index) => (
              <li
                aria-current={moment.ply === activePly ? "true" : undefined}
                className="review-moment"
                key={moment.ply}
              >
                <h3>{moment.headline}</h3>
                <p>{moment.explanation}</p>
                <button
                  aria-label={`Show key moment ${String(index + 1)} on the board`}
                  className="button button-ghost button-small"
                  onClick={() => {
                    setChosenPly(moment.ply);
                  }}
                  type="button"
                >
                  Show on board
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="review-moves-title" className="review-moves">
        <h2 id="review-moves-title">Every move</h2>
        <ol className="review-move-list" ref={moveListRef}>
          {report.moves.map((move) => {
            const row = createMoveRow(move);
            const isActive = row.ply === activePly;
            return (
              <li
                aria-current={isActive ? "true" : undefined}
                className="review-move-row"
                data-classification={row.classification}
                key={row.ply}
                ref={isActive ? currentRowRef : undefined}
              >
                <button
                  aria-label={`Show ${row.numberLabel} ${row.san} on the board`}
                  className="review-move-button"
                  onClick={() => {
                    setChosenPly(row.ply);
                  }}
                  type="button"
                >
                  <span className="review-move-number">{row.numberLabel}</span>
                  <span className="review-move-san">{row.san}</span>
                  <span className="review-move-classification">{row.classificationLabel}</span>
                  <span className="review-move-evaluation">{row.evaluationLabel}</span>
                  <span className="review-move-suggestion">{row.suggestionLabel ?? ""}</span>
                </button>
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

/**
 * Stepping controls stay focusable when they reach an end of the game, so a reader holding
 * an arrow key is never dropped back to the document. The unavailable state is announced
 * rather than removed.
 */
function StepButton({
  label,
  onActivate,
  symbol,
  unavailable,
}: {
  readonly label: string;
  readonly onActivate: () => void;
  readonly symbol?: string;
  readonly unavailable: boolean;
}) {
  return (
    <button
      aria-disabled={unavailable}
      aria-label={symbol ? label : undefined}
      className={
        symbol ? "button button-ghost button-small" : "button button-secondary button-small"
      }
      onClick={() => {
        if (!unavailable) onActivate();
      }}
      type="button"
    >
      {symbol ?? label}
    </button>
  );
}
