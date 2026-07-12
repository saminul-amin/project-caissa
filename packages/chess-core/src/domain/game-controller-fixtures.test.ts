import {
  gameConfigurationFixtures,
  gameSessionFixtures,
  opponentProposalFixtures,
} from "@caissa/test-fixtures/game-controller";
import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { createGameController } from "./game-controller";

describe("curated game-controller fixtures", () => {
  it("documents every required configuration category with valid controller input", () => {
    expect(Object.keys(gameConfigurationFixtures)).toEqual([
      "humanWhiteExternalBlack",
      "externalWhiteHumanBlack",
      "humanVersusHuman",
      "untimed",
      "suddenDeath",
      "increment",
      "customFen",
    ]);
    for (const fixture of Object.values(gameConfigurationFixtures)) {
      expect(fixture.purpose.length).toBeGreaterThan(0);
      expect(
        createGameController({
          configuration: fixture.configuration,
          rules: new ChessJsRulesAdapter(),
        }).getSession().position.ply,
      ).toBe(0);
    }
  });

  it("documents every required session category", () => {
    expect(Object.values(gameSessionFixtures).map((fixture) => fixture.phase)).toEqual([
      "creating",
      "ready",
      "player-turn",
      "opponent-turn",
      "awaiting-opponent",
      "paused",
      "degraded",
      "completed",
      "completed",
      "completed",
      "abandoned",
    ]);
    expect(Object.values(gameSessionFixtures).every((fixture) => fixture.expected.length > 0)).toBe(
      true,
    );
  });

  it("documents valid and independently stale proposal categories", () => {
    expect(Object.keys(opponentProposalFixtures)).toEqual([
      "valid",
      "staleRequestId",
      "staleFen",
      "stalePly",
      "staleRevision",
      "wrongColor",
      "illegalMove",
    ]);
    expect(
      Object.values(opponentProposalFixtures).every((fixture) => fixture.purpose.length > 0),
    ).toBe(true);
  });
});
