import { describe, expect, it, vi } from "vitest";

import { findOpponentProfile, type OpponentMoveContext } from "../../application/opponent";
import type { ChessEnginePort, EngineSearchResult } from "../engine";
import {
  boundedMoveTimeMs,
  createEngineOpponentProvider,
  remainingThinkTimeMs,
} from "./engine-opponent-provider";

const context: OpponentMoveContext = Object.freeze({
  color: "black",
  fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" as never,
  moves: ["e2e4" as never],
  profileId: "club",
  startsFromInitialPosition: true,
});

function stubEngine(result: EngineSearchResult): ChessEnginePort & {
  readonly searchMock: ReturnType<typeof vi.fn>;
  readonly stopMock: ReturnType<typeof vi.fn>;
} {
  const searchMock = vi.fn(() => Promise.resolve(result));
  const stopMock = vi.fn();
  return {
    dispose: vi.fn(),
    searchMock,
    stopMock,
    engineId: "test-engine",
    engineVersion: "1.0",
    getStatus: () => ({ state: "ready" }),
    initialize: () =>
      Promise.resolve({ engineId: "test-engine", engineVersion: "1.0", status: "ready" }),
    search: searchMock,
    stop: stopMock,
    subscribe: () => () => undefined,
  };
}

const noDelay = { wait: () => Promise.resolve() };
const fixedRandom = { next: () => 0.5 };

function createSubject(result: EngineSearchResult) {
  const engine = stubEngine(result);
  const provider = createEngineOpponentProvider({ delay: noDelay, engine, random: fixedRandom });
  return { engine, provider };
}

describe("engine opponent provider", () => {
  it("proposes the engine's best move as a structured move input", async () => {
    const { provider } = createSubject({ bestMove: "e7e5", lines: [], status: "completed" });

    await expect(provider.proposeMove(context)).resolves.toEqual({
      move: { from: "e7", to: "e5" },
      status: "proposed",
    });
  });

  it("applies the profile's strength settings to the search", async () => {
    const { engine, provider } = createSubject({
      bestMove: "e7e5",
      lines: [],
      status: "completed",
    });
    const profile = findOpponentProfile("club");

    await provider.proposeMove(context);

    expect(engine.searchMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        options: expect.objectContaining({
          limitStrengthElo: profile.strength.limitStrengthElo,
          skillLevel: profile.strength.skillLevel,
        }) as unknown,
      }),
    );
  });

  it("promotes correctly when the engine returns a promotion move", async () => {
    const { provider } = createSubject({ bestMove: "a2a1q", lines: [], status: "completed" });

    await expect(provider.proposeMove(context)).resolves.toEqual({
      move: { from: "a2", promotion: "queen", to: "a1" },
      status: "proposed",
    });
  });

  it("reports an unavailable engine as an unavailable opponent", async () => {
    const { provider } = createSubject({ reason: "load-failed", status: "failed" });

    await expect(provider.proposeMove(context)).resolves.toEqual({
      reason: "unavailable",
      status: "failed",
    });
  });

  it("maps a search timeout to a timeout reason", async () => {
    const { provider } = createSubject({ reason: "timeout", status: "failed" });

    await expect(provider.proposeMove(context)).resolves.toEqual({
      reason: "timeout",
      status: "failed",
    });
  });

  it("treats a position with no engine move as an invalid response", async () => {
    const { provider } = createSubject({ lines: [], status: "no-move" });

    await expect(provider.proposeMove(context)).resolves.toEqual({
      reason: "invalid-response",
      status: "failed",
    });
  });

  it("rejects an unparsable engine move rather than passing it on", async () => {
    const { provider } = createSubject({ bestMove: "zz9z", lines: [], status: "completed" });

    await expect(provider.proposeMove(context)).resolves.toEqual({
      reason: "invalid-response",
      status: "failed",
    });
  });

  it("discards a result whose turn was cancelled", async () => {
    const engine = stubEngine({ bestMove: "e7e5", lines: [], status: "completed" });
    const provider = createEngineOpponentProvider({
      delay: {
        wait: () => {
          provider.cancel();
          return Promise.resolve();
        },
      },
      engine,
      random: fixedRandom,
    });

    await expect(provider.proposeMove(context)).resolves.toEqual({
      reason: "request-cancelled",
      status: "failed",
    });
  });

  it("stops the running search when cancelled", () => {
    const { engine, provider } = createSubject({
      bestMove: "e7e5",
      lines: [],
      status: "completed",
    });
    provider.cancel();
    expect(engine.stopMock).toHaveBeenCalledOnce();
  });
});

describe("search-time bounds", () => {
  const profile = findOpponentProfile("club");

  it("uses the profile time when the game is untimed", () => {
    expect(boundedMoveTimeMs(profile)).toBe(profile.strength.moveTimeMs);
  });

  it("never spends more than a fraction of the remaining clock", () => {
    expect(boundedMoveTimeMs(profile, 60_000)).toBe(profile.strength.moveTimeMs);
    expect(boundedMoveTimeMs(profile, 5_400)).toBe(450);
  });

  it("moves almost instantly when the clock is nearly out", () => {
    expect(boundedMoveTimeMs(profile, 2_000)).toBe(80);
  });
});

describe("think-time pacing", () => {
  const profile = findOpponentProfile("club");

  it("pads a fast search up to a human-looking pause", () => {
    const pause = remainingThinkTimeMs(profile, 100, 0);
    expect(pause).toBe(profile.thinkTime.minimumMs - 100);
  });

  it("adds nothing when the search already took long enough", () => {
    expect(remainingThinkTimeMs(profile, 10_000, 1)).toBe(0);
  });

  it("varies the pause with the random draw", () => {
    expect(remainingThinkTimeMs(profile, 0, 0.9)).toBeGreaterThan(
      remainingThinkTimeMs(profile, 0, 0.1),
    );
  });

  it("survives a non-finite random draw", () => {
    expect(remainingThinkTimeMs(profile, 0, Number.NaN)).toBe(profile.thinkTime.minimumMs);
  });
});
