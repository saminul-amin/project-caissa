import { describe, expect, it } from "vitest";

import type { GameSession } from "@caissa/chess-core";
import { createControllerFixture } from "../../test/application-service-test-kit";
import {
  gameModeLabel,
  localPlayerColor,
  opponentLabel,
  projectGameResult,
  projectOpponentPanel,
} from "./opponent-presentation";

function engineSession(phase: GameSession["lifecycle"]["phase"] = "opponent-turn"): GameSession {
  const session = createControllerFixture({ black: "external-opponent" }).getSession();
  return {
    ...session,
    configuration: {
      ...session.configuration,
      participants: {
        black: { kind: "external-opponent", label: "Caissa Club", profile: "club" },
        white: { kind: "human", label: "You" },
      },
    },
    lifecycle: { phase } as GameSession["lifecycle"],
  };
}

function humanSession(): GameSession {
  return createControllerFixture().getSession();
}

describe("projectOpponentPanel", () => {
  it("stays hidden for a local two-player game", () => {
    expect(
      projectOpponentPanel({
        hasExternalOpponent: false,
        opponentLabel: "Caissa",
        session: humanSession(),
        status: { kind: "thinking" },
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("stays hidden while it is the player's own turn", () => {
    expect(
      projectOpponentPanel({
        hasExternalOpponent: true,
        opponentLabel: "Caissa Club",
        session: engineSession("player-turn"),
        status: { kind: "ready" },
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("shows a determinate loading state with a whole-number percentage", () => {
    expect(
      projectOpponentPanel({
        hasExternalOpponent: true,
        opponentLabel: "Caissa Club",
        session: engineSession(),
        status: { kind: "loading", ratio: 0.4567 },
      }),
    ).toEqual({ kind: "loading", percent: 46 });
  });

  it("shows an indeterminate loading state before any progress arrives", () => {
    expect(
      projectOpponentPanel({
        hasExternalOpponent: true,
        opponentLabel: "Caissa Club",
        session: engineSession(),
        status: { kind: "loading" },
      }),
    ).toEqual({ kind: "loading", percent: undefined });
  });

  it("names the opponent while it is thinking", () => {
    expect(
      projectOpponentPanel({
        hasExternalOpponent: true,
        opponentLabel: "Caissa Club",
        session: engineSession("awaiting-opponent"),
        status: { kind: "thinking" },
      }),
    ).toEqual({ kind: "thinking", label: "Caissa Club" });
  });

  it("offers a retry when the game has degraded", () => {
    const panel = projectOpponentPanel({
      hasExternalOpponent: true,
      opponentLabel: "Caissa Club",
      session: engineSession("degraded"),
      status: { kind: "ready" },
    });
    expect(panel).toMatchObject({ kind: "unavailable", retryable: true });
  });

  it("explains an unavailable engine without offering a pointless retry", () => {
    const panel = projectOpponentPanel({
      hasExternalOpponent: true,
      opponentLabel: "Caissa Club",
      session: engineSession("player-turn"),
      status: { detail: "No WebAssembly here.", kind: "unavailable" },
    });
    expect(panel).toEqual({
      detail: "No WebAssembly here.",
      kind: "unavailable",
      retryable: false,
    });
  });
});

describe("projectGameResult", () => {
  it("speaks to the player when they won", () => {
    const presentation = projectGameResult({
      playerColor: "white",
      result: { isDraw: false, reason: "checkmate", status: "decisive", winner: "white" } as never,
    });
    expect(presentation).toMatchObject({ headline: "You won", outcome: "win" });
  });

  it("points a losing player at the review", () => {
    const presentation = projectGameResult({
      playerColor: "white",
      result: { isDraw: false, reason: "checkmate", status: "decisive", winner: "black" } as never,
    });
    expect(presentation.outcome).toBe("loss");
    expect(presentation.detail).toContain("review");
  });

  it("stays neutral when both sides were human", () => {
    const presentation = projectGameResult({
      playerColor: undefined,
      result: { isDraw: false, reason: "checkmate", status: "decisive", winner: "black" } as never,
    });
    expect(presentation.outcome).toBe("unfinished");
    expect(presentation.headline).toBe("Black wins");
    expect(presentation.detail).toBe("Black won by checkmate.");
  });

  it("describes a draw and an abandoned game without declaring a winner", () => {
    expect(
      projectGameResult({
        playerColor: "white",
        result: { isDraw: true, reason: "stalemate", status: "draw" } as never,
      }),
    ).toMatchObject({ headline: "Drawn game", outcome: "draw" });
    expect(
      projectGameResult({
        playerColor: "white",
        result: { isDraw: false, reason: "abandoned", status: "abandoned" } as never,
      }),
    ).toMatchObject({ headline: "Game ended", outcome: "unfinished" });
  });
});

describe("session labels", () => {
  it("identifies the side the local player controls", () => {
    expect(localPlayerColor(engineSession())).toBe("white");
    expect(localPlayerColor(humanSession())).toBeUndefined();
  });

  it("names the opponent and the mode", () => {
    expect(opponentLabel(engineSession())).toBe("Caissa Club");
    expect(gameModeLabel(engineSession())).toBe("Game against Caissa Club");
    expect(gameModeLabel(humanSession())).toBe("Local two-player game");
  });
});
