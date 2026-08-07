import { StrictMode, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  moveInputFromUci,
  parseMonotonicTimestampMs,
  parseUciMove,
  parseUndoPlyCount,
} from "@caissa/chess-core";
import { describe, expect, it, vi } from "vitest";

import { CaissaAppProvider, useCaissaApp } from "./CaissaAppProvider";
import { DEFAULT_NEW_GAME_SETUP, type GamePersistenceResult } from "../application";
import { createDeferred, retryableStorageError } from "../test/application-service-test-kit";
import { createTestApplication } from "../test/caissa-app-test-kit";

function Probe() {
  const { activeGame, startup } = useCaissaApp();
  return <p>{`${startup.status}:${activeGame?.session.lifecycle.phase ?? "none"}`}</p>;
}

describe("CaissaAppProvider", () => {
  it("creates one application and runs startup once under StrictMode", async () => {
    const { application } = createTestApplication();
    const restore = vi.spyOn(application.startupService, "restoreActiveGame");
    const createApplication = vi.fn(() => application);
    render(
      <StrictMode>
        <CaissaAppProvider createApplication={createApplication}>
          <Probe />
        </CaissaAppProvider>
      </StrictMode>,
    );
    await screen.findByText("no-active-game:none");
    expect(createApplication).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("does not recreate services on an ordinary rerender", async () => {
    const { application } = createTestApplication();
    const createApplication = vi.fn(() => application);
    const view = render(
      <CaissaAppProvider createApplication={createApplication}>
        <Probe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none");
    view.rerender(
      <CaissaAppProvider createApplication={createApplication}>
        <Probe />
      </CaissaAppProvider>,
    );
    expect(createApplication).toHaveBeenCalledTimes(1);
  });

  it("closes an owned application after true unmount", async () => {
    const { application } = createTestApplication();
    const close = vi.fn();
    const ownedApplication = { ...application, close };
    const view = render(
      <CaissaAppProvider
        createApplication={() => {
          return ownedApplication;
        }}
      >
        <Probe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none");
    view.unmount();
    await waitFor(() => {
      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  it("does not close an externally owned application", async () => {
    const { application } = createTestApplication();
    const close = vi.fn();
    const externalApplication = { ...application, close };
    const view = render(
      <CaissaAppProvider application={externalApplication}>
        <Probe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none");
    view.unmount();
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
  });

  it("starts and submits through bounded actions using the injected monotonic clock", async () => {
    const user = userEvent.setup();
    const now = vi
      .fn()
      .mockReturnValueOnce(parseMonotonicTimestampMs(12_345))
      .mockReturnValueOnce(parseMonotonicTimestampMs(13_345));
    const { application, gameRepository } = createTestApplication(undefined, {
      monotonicClock: { now },
    });
    render(
      <CaissaAppProvider application={application}>
        <InteractionProbe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none:0");
    await user.click(screen.getByRole("button", { name: "Create fixture game" }));
    await screen.findByText("no-active-game:ready:0");
    const savesAfterCreation = gameRepository.activeSaves.length;

    await user.click(screen.getByRole("button", { name: "Read legal moves" }));
    expect(screen.getByTestId("legal-count")).toHaveTextContent("20");
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
    expect(gameRepository.activeSaves).toHaveLength(savesAfterCreation);

    await user.click(screen.getByRole("button", { name: "Start fixture game" }));
    await screen.findByText("no-active-game:player-turn:1");
    expect(screen.getByTestId("result")).toHaveTextContent("applied:saved");
    expect(gameRepository.activeSaves.at(-1)?.clock).toMatchObject({
      activeColor: "white",
      lastTimestampMs: parseMonotonicTimestampMs(12_345),
      status: "running",
    });

    await user.click(screen.getByRole("button", { name: "Play e2 to e4" }));
    await screen.findByText("no-active-game:player-turn:2");
    expect(screen.getByTestId("history-count")).toHaveTextContent("1");
    expect(screen.getByTestId("turn")).toHaveTextContent("black");
    expect(gameRepository.activeSaves.at(-1)?.history[0]?.san).toBe("e4");
    expect(now).toHaveBeenCalledTimes(2);
  });

  it("preserves an unsaved persistence outcome separately from successful chess state", async () => {
    const user = userEvent.setup();
    const { application, gameRepository } = createTestApplication();
    render(
      <CaissaAppProvider application={application}>
        <InteractionProbe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none:0");
    await user.click(screen.getByRole("button", { name: "Create fixture game" }));
    await screen.findByText("no-active-game:ready:0");
    gameRepository.saveActiveImplementation = () => ({
      error: retryableStorageError,
      status: "failed",
    });

    await user.click(screen.getByRole("button", { name: "Start fixture game" }));
    await screen.findByText("no-active-game:player-turn:1");
    expect(screen.getByTestId("result")).toHaveTextContent("applied:unsaved");
    expect(screen.getByTestId("persistence")).toHaveTextContent("unsaved");
  });

  it("maps an illegal command to a safe result without changing the authoritative snapshot", async () => {
    const user = userEvent.setup();
    const { application } = createTestApplication();
    render(
      <CaissaAppProvider application={application}>
        <InteractionProbe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none:0");
    await user.click(screen.getByRole("button", { name: "Create fixture game" }));
    await user.click(screen.getByRole("button", { name: "Start fixture game" }));
    await screen.findByText("no-active-game:player-turn:1");
    await user.click(screen.getByRole("button", { name: "Try illegal move" }));
    expect(screen.getByTestId("result")).toHaveTextContent("rejected:illegal-move");
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
    expect(screen.getByTestId("history-count")).toHaveTextContent("0");
  });

  it("delegates pause, resume, bounded undo, restart, and unawarded abandonment", async () => {
    const user = userEvent.setup();
    let timestamp = 10_000;
    const now = vi.fn(() => parseMonotonicTimestampMs((timestamp += 100)));
    const { application, gameRepository } = createTestApplication(undefined, {
      monotonicClock: { now },
    });
    render(
      <CaissaAppProvider application={application}>
        <InteractionProbe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none:0");
    await user.click(screen.getByRole("button", { name: "Create fixture game" }));
    await user.click(screen.getByRole("button", { name: "Start fixture game" }));
    await user.click(screen.getByRole("button", { name: "Play e2 to e4" }));
    await user.click(screen.getByRole("button", { name: "Play e7 to e5" }));
    expect(screen.getByTestId("history-count")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "Pause fixture game" }));
    await screen.findByText("no-active-game:paused:4");
    expect(screen.getByTestId("result")).toHaveTextContent("applied:saved");

    await user.click(screen.getByRole("button", { name: "Resume fixture game" }));
    await screen.findByText("no-active-game:player-turn:5");
    await user.click(screen.getByRole("button", { name: "Undo two fixture plies" }));
    await screen.findByText("no-active-game:player-turn:6");
    expect(screen.getByTestId("history-count")).toHaveTextContent("0");
    expect(screen.getByTestId("turn")).toHaveTextContent("white");

    await user.click(screen.getByRole("button", { name: "Restart fixture game" }));
    await screen.findByText("no-active-game:ready:7");
    expect(screen.getByTestId("history-count")).toHaveTextContent("0");
    await user.click(screen.getByRole("button", { name: "Start fixture game" }));
    await user.click(screen.getByRole("button", { name: "End fixture game" }));
    await screen.findByText("no-active-game:abandoned:9");
    expect(screen.getByTestId("result")).toHaveTextContent("completed:finalized");
    expect(gameRepository.active).toBeUndefined();
    expect(gameRepository.completed.values().next().value?.result).toEqual({
      isDraw: false,
      reason: "abandoned",
      status: "abandoned",
    });
    expect(now).toHaveBeenCalled();
  });

  it("rejects a game control while another bounded mutation is still saving", async () => {
    const user = userEvent.setup();
    const { application, gameRepository } = createTestApplication();
    render(
      <CaissaAppProvider application={application}>
        <InteractionProbe />
      </CaissaAppProvider>,
    );
    await screen.findByText("no-active-game:none:0");
    await user.click(screen.getByRole("button", { name: "Create fixture game" }));
    await screen.findByText("no-active-game:ready:0");
    const pendingSave = createDeferred<GamePersistenceResult>();
    gameRepository.saveActiveImplementation = () => pendingSave.promise;

    await user.click(screen.getByRole("button", { name: "Start fixture game" }));
    await user.click(screen.getByRole("button", { name: "Pause fixture game" }));
    expect(screen.getByTestId("result")).toHaveTextContent("blocked:operation-in-progress");
    expect(screen.getByTestId("revision")).toHaveTextContent("0");

    pendingSave.resolve({ status: "saved" });
    await screen.findByText("no-active-game:player-turn:1");
    expect(screen.getByTestId("history-count")).toHaveTextContent("0");
  });
});

function InteractionProbe() {
  const { actions, activeGame, startup } = useCaissaApp();
  const [legalCount, setLegalCount] = useState(0);
  const [result, setResult] = useState("none");
  const summary = `${startup.status}:${activeGame?.session.lifecycle.phase ?? "none"}:${String(activeGame?.session.revision ?? 0)}`;

  return (
    <>
      <p>{summary}</p>
      <p data-testid="revision">{activeGame?.session.revision ?? 0}</p>
      <p data-testid="history-count">{activeGame?.session.history.length ?? 0}</p>
      <p data-testid="turn">{activeGame?.session.position.turn ?? "none"}</p>
      <p data-testid="persistence">{activeGame?.persistence.status ?? "none"}</p>
      <p data-testid="legal-count">{legalCount}</p>
      <p data-testid="result">{result}</p>
      <button
        onClick={() => {
          void actions.createNewGame({
            setup: { ...DEFAULT_NEW_GAME_SETUP, timeControlId: "5-minutes" },
          });
        }}
        type="button"
      >
        Create fixture game
      </button>
      <button
        onClick={() => {
          if (!activeGame) return;
          void actions
            .submitCurrentHumanMove({
              expectedRevision: activeGame.session.revision,
              move: moveInputFromUci(parseUciMove("e7e5")),
            })
            .then((outcome) => {
              setResult(
                outcome.status === "applied"
                  ? `${outcome.status}:${outcome.persistence}`
                  : `${outcome.status}:${"messageKey" in outcome ? outcome.messageKey : outcome.persistence}`,
              );
            });
        }}
        type="button"
      >
        Play e7 to e5
      </button>
      <button
        onClick={() => void actions.pauseCurrentGame().then(showControlResult(setResult))}
        type="button"
      >
        Pause fixture game
      </button>
      <button
        onClick={() => void actions.resumeCurrentGame().then(showControlResult(setResult))}
        type="button"
      >
        Resume fixture game
      </button>
      <button
        onClick={() =>
          void actions.undoCurrentGameMoves(parseUndoPlyCount(2)).then(showControlResult(setResult))
        }
        type="button"
      >
        Undo two fixture plies
      </button>
      <button
        onClick={() => void actions.restartCurrentGame().then(showControlResult(setResult))}
        type="button"
      >
        Restart fixture game
      </button>
      <button
        onClick={() => void actions.abandonCurrentGame().then(showControlResult(setResult))}
        type="button"
      >
        End fixture game
      </button>
      <button
        onClick={() => {
          setLegalCount(actions.readCurrentLegalMoves().length);
        }}
        type="button"
      >
        Read legal moves
      </button>
      <button
        onClick={() => {
          void actions.startCurrentGame().then((outcome) => {
            setResult(
              outcome.status === "applied"
                ? `${outcome.status}:${outcome.persistence}`
                : `${outcome.status}:${"messageKey" in outcome ? outcome.messageKey : outcome.persistence}`,
            );
          });
        }}
        type="button"
      >
        Start fixture game
      </button>
      <button
        onClick={() => {
          if (!activeGame) return;
          void actions
            .submitCurrentHumanMove({
              expectedRevision: activeGame.session.revision,
              move: moveInputFromUci(parseUciMove("e2e4")),
            })
            .then((outcome) => {
              setResult(
                outcome.status === "applied"
                  ? `${outcome.status}:${outcome.persistence}`
                  : `${outcome.status}:${"messageKey" in outcome ? outcome.messageKey : outcome.persistence}`,
              );
            });
        }}
        type="button"
      >
        Play e2 to e4
      </button>
      <button
        onClick={() => {
          if (!activeGame) return;
          void actions
            .submitCurrentHumanMove({
              expectedRevision: activeGame.session.revision,
              move: moveInputFromUci(parseUciMove("e2e5")),
            })
            .then((outcome) => {
              setResult(
                outcome.status === "applied"
                  ? `${outcome.status}:${outcome.persistence}`
                  : `${outcome.status}:${"messageKey" in outcome ? outcome.messageKey : outcome.persistence}`,
              );
            });
        }}
        type="button"
      >
        Try illegal move
      </button>
    </>
  );
}

function showControlResult(setResult: (value: string) => void) {
  return (
    outcome: Awaited<ReturnType<ReturnType<typeof useCaissaApp>["actions"]["pauseCurrentGame"]>>,
  ) => {
    setResult(
      outcome.status === "applied" || outcome.status === "completed"
        ? `${outcome.status}:${outcome.persistence}`
        : `${outcome.status}:${outcome.messageKey}`,
    );
  };
}
