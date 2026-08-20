import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameReviewReport, GameReviewResult } from "../../application/review";
import { DEFAULT_USER_PREFERENCES } from "../../application/settings";
import { useCaissaApp } from "../../app/CaissaAppProvider";
import { ReviewPage } from "./ReviewPage";

vi.mock("../../app/CaissaAppProvider", () => ({ useCaissaApp: vi.fn() }));

const report: GameReviewReport = {
  analysisDepth: 14,
  black: {
    accuracyPercent: 91.2,
    bestMoves: 2,
    blunders: 0,
    inaccuracies: 0,
    mistakes: 0,
    moveCount: 2,
  },
  engineId: "stockfish",
  engineVersion: "18.0.8-lite-single",
  gameId: "game-1" as never,
  keyMoments: [
    { explanation: "White played Bc4, which loses material.", headline: "Move 2: Bc4", ply: 3 },
  ],
  moves: [
    {
      classification: "best",
      engineBestMove: "e2e4" as never,
      engineBestMoveSan: "e4" as never,
      expectedScoreLoss: 0,
      fenBefore: "8/8/8/8/8/8/8/8 w - - 0 1" as never,
      moveNumber: 1,
      mover: "white",
      ply: 1,
      san: "e4" as never,
      scoreAfterCentipawns: 20,
      uci: "e2e4" as never,
      winProbabilityAfter: 0.52,
      winProbabilityBefore: 0.52,
    },
    {
      classification: "blunder",
      engineBestMove: "e4d5" as never,
      engineBestMoveSan: "exd5" as never,
      expectedScoreLoss: 0.37,
      fenBefore: "8/8/8/8/8/8/8/8 w - - 0 1" as never,
      moveNumber: 2,
      mover: "white",
      ply: 3,
      san: "Bc4" as never,
      scoreAfterCentipawns: -400,
      uci: "f1c4" as never,
      winProbabilityAfter: 0.15,
      winProbabilityBefore: 0.52,
    },
  ],
  white: {
    accuracyPercent: 62.5,
    bestMoves: 1,
    blunders: 1,
    inaccuracies: 0,
    mistakes: 0,
    moveCount: 2,
  },
};

function install(generateReview: ReturnType<typeof vi.fn>, cancel = vi.fn()) {
  vi.mocked(useCaissaApp).mockReturnValue({
    actions: {} as never,
    activeGame: undefined,
    application: { reviewService: { cancel, generateReview } } as never,
    opponentStatus: { kind: "idle" },
    preferences: DEFAULT_USER_PREFERENCES,
    startup: { status: "no-active-game" },
  });
  return { cancel, generateReview };
}

function renderPage(path = "/review/game-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ReviewPage />} path="/review/:gameId" />
      </Routes>
    </MemoryRouter>,
  );
}

function completed(): Promise<GameReviewResult> {
  return Promise.resolve({ report, status: "completed" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReviewPage", () => {
  it("shows accuracy, key moments, and every move once analysis finishes", async () => {
    install(vi.fn(completed));
    renderPage();

    expect(await screen.findByText("62.5%")).toBeVisible();
    expect(screen.getByText("91.2%")).toBeVisible();
    expect(screen.getByText("Move 2: Bc4")).toBeVisible();
    expect(screen.getByText("Engine prefers exd5")).toBeVisible();
    expect(screen.getByText("Blunder")).toBeVisible();
  });

  it("names the engine and depth so the reader can judge the analysis", async () => {
    install(vi.fn(completed));
    renderPage();

    expect(await screen.findByText(/18\.0\.8-lite-single at depth 14/)).toBeVisible();
    expect(screen.getByText(/not a rating/)).toBeVisible();
  });

  it("reports progress while the engine is working", async () => {
    install(
      vi.fn((command: { onProgress?: (progress: unknown) => void }) => {
        command.onProgress?.({ analyzedPositions: 3, totalPositions: 10 });
        return completed();
      }),
    );
    renderPage();

    expect(await screen.findByText("62.5%")).toBeVisible();
  });

  it("shows an analysing state before any result arrives", () => {
    install(vi.fn(() => new Promise<GameReviewResult>(() => undefined)));
    renderPage();

    expect(screen.getByRole("heading", { name: "Game review" })).toBeVisible();
    expect(screen.getByText("Analysing your game")).toBeVisible();
  });

  it("explains a missing game", async () => {
    install(vi.fn(() => Promise.resolve({ status: "game-not-found" } as GameReviewResult)));
    renderPage();

    expect(await screen.findByText("That game is not saved in this browser.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to History" })).toBeVisible();
  });

  it("surfaces the reason an engine review could not run and retries on request", async () => {
    const generateReview = vi
      .fn()
      .mockResolvedValueOnce({ reason: "The engine is unavailable.", status: "unavailable" })
      .mockImplementation(completed);
    install(generateReview);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("The engine is unavailable.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try Again" }));

    expect(await screen.findByText("62.5%")).toBeVisible();
    expect(generateReview).toHaveBeenCalledTimes(2);
  });

  it("rejects an invalid identifier without calling the engine", async () => {
    const { generateReview } = install(vi.fn(completed));
    renderPage("/review/not a valid id");

    expect(await screen.findByText("That game identifier is not valid.")).toBeVisible();
    expect(generateReview).not.toHaveBeenCalled();
  });

  it("cancels the running analysis when the reader leaves", async () => {
    const cancel = vi.fn();
    install(
      vi.fn(() => new Promise<GameReviewResult>(() => undefined)),
      cancel,
    );
    const view = renderPage();

    view.unmount();

    await waitFor(() => {
      expect(cancel).toHaveBeenCalled();
    });
  });

  it("says nothing stood out when no key moment was found", async () => {
    install(
      vi.fn(() => Promise.resolve({ report: { ...report, keyMoments: [] }, status: "completed" })),
    );
    renderPage();

    expect(await screen.findByText(/Nothing in this game cost either side/)).toBeVisible();
    expect(screen.getByText(/No costly mistakes stood out/)).toBeVisible();
  });
});
