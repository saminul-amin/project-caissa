import { parseUndoPlyCount } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import type { GameControlMessageKey, GameControlUiResult } from "../../app/game-runtime-results";
import { createControllerFixture } from "../../test/application-service-test-kit";
import { gameControlResultMessage } from "./use-active-game-controls";

const session = createControllerFixture().getSession();

describe("game control result presentation", () => {
  it.each([
    ["no-active-game", "No active game"],
    ["operation-in-progress", "already in progress"],
    ["persistence-pending", "Save the completed game"],
    ["position-changed", "game changed"],
    ["game-paused", "already paused"],
    ["game-not-paused", "not paused"],
    ["game-completed", "already ended"],
    ["undo-disabled", "Undo is disabled"],
    ["insufficient-history", "not enough moves"],
    ["resume-before-undo", "Resume the game"],
    ["already-ready", "already at its starting position"],
    ["invalid-state", "unavailable in the current game state"],
    ["temporarily-unavailable", "could not be completed"],
  ] satisfies readonly (readonly [GameControlMessageKey, string])[])(
    "maps %s to safe user-facing copy",
    (messageKey, expected) => {
      expect(
        gameControlResultMessage({ control: "pause", messageKey, status: "rejected" }, session),
      ).toContain(expected);
    },
  );

  it.each([
    [
      {
        control: "pause",
        persistence: "saved",
        resumePhase: "player-turn",
        status: "applied",
      },
      "Game paused. Neither clock is running. Saved locally.",
    ],
    [
      {
        control: "resume",
        persistence: "unsaved",
        resumedPhase: "player-turn",
        status: "applied",
      },
      "Game resumed. White to move. The change is active but has not been saved locally.",
    ],
    [
      {
        control: "undo-one",
        persistence: "saved",
        removedPlies: parseUndoPlyCount(1),
        reopened: false,
        status: "applied",
      },
      "Undid the last move. Saved locally.",
    ],
    [
      {
        control: "undo-two",
        persistence: "saved",
        removedPlies: parseUndoPlyCount(2),
        reopened: true,
        status: "applied",
      },
      "Completed game reopened. Undid the last two plies. Saved locally.",
    ],
    [
      { control: "restart", persistence: "unsaved", status: "applied" },
      "Game returned to its starting position. Choose Begin Game when ready.",
    ],
  ] satisfies readonly (readonly [GameControlUiResult, string])[])(
    "presents an applied %s result",
    (result, expected) => {
      expect(gameControlResultMessage(result, session)).toContain(expected);
    },
  );

  it("presents timeout and abandonment completion without inventing a winner", () => {
    const timeoutResult = {
      isDraw: false,
      loser: "white" as const,
      pgnResult: "0-1" as const,
      reason: "timeout" as const,
      status: "decisive" as const,
      winner: "black",
    } as const;
    expect(
      gameControlResultMessage(
        {
          control: "pause",
          expiredColor: "white",
          persistence: "finalization-pending",
          result: timeoutResult,
          status: "completed",
        },
        session,
      ),
    ).toContain("White's time expired before the game could be paused");
    expect(
      gameControlResultMessage(
        {
          control: "abandon",
          expiredColor: "white",
          persistence: "finalized",
          result: timeoutResult,
          status: "completed",
        },
        session,
      ),
    ).toContain("before the game could be ended as abandoned");
    expect(
      gameControlResultMessage(
        {
          control: "abandon",
          expiredColor: undefined,
          persistence: "finalized",
          result: { isDraw: false, reason: "abandoned", status: "abandoned" },
          status: "completed",
        },
        session,
      ),
    ).toBe("Game ended without awarding a winner. Saved locally.");
  });
});
