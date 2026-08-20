import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_USER_PREFERENCES } from "../../application/settings";
import { useCaissaApp } from "../../app/CaissaAppProvider";
import { HistoryPage } from "./HistoryPage";

vi.mock("../../app/CaissaAppProvider", () => ({ useCaissaApp: vi.fn() }));

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useNavigate: () => navigate };
});

const listItem = {
  completedAt: 1_700_000_000_000,
  gameId: "game-1",
  moveCount: 4,
  participants: {
    black: { kind: "external-opponent", label: "Caissa Club" },
    white: { kind: "human", label: "You" },
  },
  result: { isDraw: false, reason: "checkmate", status: "decisive", winner: "white" },
  review: { status: "not-available" },
  revision: 8,
  timeControl: { initialMs: 300_000, kind: "sudden-death" },
};

function installHistory(historyService: Record<string, unknown>) {
  vi.mocked(useCaissaApp).mockReturnValue({
    actions: {} as never,
    activeGame: undefined,
    application: { historyService } as never,
    opponentStatus: { kind: "idle" },
    preferences: DEFAULT_USER_PREFERENCES,
    startup: { status: "no-active-game" },
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HistoryPage", () => {
  it("lists saved games with their result and metadata", async () => {
    installHistory({
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    renderPage();

    expect(await screen.findByText("White won · checkmate")).toBeVisible();
    expect(screen.getByText("You vs Caissa Club")).toBeVisible();
    expect(screen.getByText(/2 moves/)).toBeVisible();
  });

  it("invites the player to play when nothing is saved", async () => {
    installHistory({
      listGames: vi.fn(() => Promise.resolve({ corruptions: [], items: [], status: "listed" })),
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "No finished games yet" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Start a Game" })).toHaveAttribute("href", "/play/new");
  });

  it("explains unavailable storage and can retry", async () => {
    const listGames = vi
      .fn()
      .mockResolvedValueOnce({ error: {}, status: "storage-unavailable" })
      .mockResolvedValueOnce({ corruptions: [], items: [listItem], status: "listed" });
    installHistory({ listGames });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "History is unavailable" })).toBeVisible();
    expect(screen.getByText(/Local storage is unavailable/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    expect(await screen.findByText("White won · checkmate")).toBeVisible();
    expect(listGames).toHaveBeenCalledTimes(2);
  });

  it("reports a generic failure without leaking storage details", async () => {
    installHistory({ listGames: vi.fn(() => Promise.resolve({ error: {}, status: "failed" })) });
    renderPage();

    expect(await screen.findByText("Caissa could not read your saved games.")).toBeVisible();
  });

  it("opens the review for a game", async () => {
    installHistory({
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Review" }));

    expect(navigate).toHaveBeenCalledWith("/review/game-1");
  });

  it("requires confirmation before deleting a game", async () => {
    const deleteGame = vi.fn(() => Promise.resolve({ status: "deleted" }));
    installHistory({
      deleteGame,
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(deleteGame).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete Game" }));

    await waitFor(() => {
      expect(deleteGame).toHaveBeenCalledExactlyOnceWith({
        confirmation: "delete-completed-game",
        gameId: "game-1",
      });
    });
    expect(await screen.findByText("Game deleted.")).toBeVisible();
  });

  it("keeps the game when deletion is cancelled", async () => {
    const deleteGame = vi.fn();
    installHistory({
      deleteGame,
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Keep Game" }));

    expect(deleteGame).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("requires confirmation before clearing every game", async () => {
    const clearHistory = vi.fn(() => Promise.resolve({ status: "cleared" }));
    installHistory({
      clearHistory,
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete All Saved Games" }));
    await user.click(screen.getByRole("button", { name: "Delete Everything" }));

    await waitFor(() => {
      expect(clearHistory).toHaveBeenCalledExactlyOnceWith({
        confirmation: "clear-completed-game-history",
      });
    });
    expect(await screen.findByText("All saved games were deleted.")).toBeVisible();
  });

  it("reports a failed deletion honestly", async () => {
    installHistory({
      deleteGame: vi.fn(() => Promise.resolve({ error: {}, status: "failed" })),
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete Game" }));

    expect(await screen.findByText("Caissa could not delete that game.")).toBeVisible();
  });

  it("exports a PGN download and confirms the filename", async () => {
    installHistory({
      createPgnExport: vi.fn(() =>
        Promise.resolve({
          descriptor: {
            content: '[Event "Caissa"]',
            filename: "caissa-game-1.pgn",
            mimeType: "application/x-chess-pgn",
          },
          status: "ready",
        }),
      ),
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    const createObjectURL = vi.fn(() => "blob:caissa");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Export PGN" }));

    expect(await screen.findByText("Exported caissa-game-1.pgn.")).toBeVisible();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("reports an export failure", async () => {
    installHistory({
      createPgnExport: vi.fn(() => Promise.resolve({ status: "not-found" })),
      listGames: vi.fn(() =>
        Promise.resolve({ corruptions: [], items: [listItem], status: "listed" }),
      ),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Export PGN" }));

    expect(await screen.findByText("Caissa could not export that game.")).toBeVisible();
  });
});
