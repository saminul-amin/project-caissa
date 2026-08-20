import { moveInputFromUci, parseMonotonicTimestampMs } from "@caissa/chess-core";
import { describe, expect, it, vi } from "vitest";

import { createGameSessionCoordinator, type GameSessionCoordinator } from "../game-session";
import {
  MemoryGameRepository,
  at,
  createControllerFixture,
} from "../../test/application-service-test-kit";
import { FixedWallClock } from "../../test/persistence-test-kit";
import {
  DEFAULT_OPPONENT_PROFILE_ID,
  OPPONENT_PROFILES,
  findOpponentProfile,
  isOpponentProfileId,
} from "./opponent-profiles";
import type { OpponentMoveResult, OpponentProvider } from "./opponent-port";
import { createOpponentTurnService } from "./opponent-turn-service";

const monotonicClock = { now: () => parseMonotonicTimestampMs(5_000) };

function engineGameCoordinator(): GameSessionCoordinator {
  const controller = createControllerFixture({ black: "external-opponent" });
  return createGameSessionCoordinator({
    controller,
    gameRepository: new MemoryGameRepository(),
    wallClock: new FixedWallClock(),
  });
}

interface StubProvider {
  readonly cancel: ReturnType<typeof vi.fn>;
  readonly propose: ReturnType<typeof vi.fn<OpponentProvider["proposeMove"]>>;
  readonly provider: OpponentProvider;
}

function stubProvider(result: OpponentMoveResult): StubProvider {
  const cancel = vi.fn();
  const propose = vi.fn<OpponentProvider["proposeMove"]>(() => Promise.resolve(result));
  return {
    cancel,
    propose,
    provider: { cancel, proposeMove: propose, providerId: "test-provider" },
  };
}

async function reachOpponentTurn(coordinator: GameSessionCoordinator) {
  await coordinator.start(at(1_000));
  await coordinator.submitHumanMove({ move: moveInputFromUci("e2e4"), now: at(1_100) });
  return coordinator;
}

function createService(stub: StubProvider, requestValue = "req-1") {
  return createOpponentTurnService({
    monotonicClock,
    provider: stub.provider,
    requestIdFactory: { create: () => requestValue },
  });
}

describe("OpponentTurnService", () => {
  it("opens a request, commits the proposed move, and advances the game", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    const provider = stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" });

    const outcome = await createService(provider).runTurn({
      coordinator,
      profileId: "club",
    });

    expect(outcome).toEqual({ status: "committed" });
    expect(coordinator.getSession().history.at(-1)?.san).toBe("e5");
    expect(coordinator.getSession().lifecycle.phase).toBe("player-turn");
    expect(coordinator.getSession().activeOpponentRequest).toBeUndefined();
  });

  it("passes the position, colour, and complete move list to the provider", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    const provider = stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" });

    await createService(provider).runTurn({ coordinator, profileId: "expert" });

    expect(provider.propose).toHaveBeenCalledExactlyOnceWith({
      color: "black",
      fen: expect.stringContaining(" b ") as string,
      moves: ["e2e4"],
      profileId: "expert",
      startsFromInitialPosition: true,
    });
  });

  it("includes the opponent clock when the game is timed", async () => {
    const controller = createControllerFixture({
      black: "external-opponent",
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    });
    const coordinator = createGameSessionCoordinator({
      controller,
      gameRepository: new MemoryGameRepository(),
      wallClock: new FixedWallClock(),
    });
    await reachOpponentTurn(coordinator);
    const provider = stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" });

    await createService(provider).runTurn({ coordinator, profileId: "club" });

    expect(provider.propose.mock.calls[0]?.[0].remainingMs).toBe(300_000);
  });

  it("does nothing when it is not the external opponent's turn", async () => {
    const coordinator = engineGameCoordinator();
    await coordinator.start(at(1_000));
    const provider = stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" });

    await expect(
      createService(provider).runTurn({ coordinator, profileId: "club" }),
    ).resolves.toEqual({ status: "not-opponent-turn" });
    expect(provider.propose).not.toHaveBeenCalled();
  });

  it("degrades the game when the provider cannot supply a move", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    const provider = stubProvider({ reason: "unavailable", status: "failed" });

    const outcome = await createService(provider).runTurn({ coordinator, profileId: "club" });

    expect(outcome).toEqual({ reason: "unavailable", status: "degraded" });
    expect(coordinator.getSession().lifecycle.phase).toBe("degraded");
    expect(coordinator.getSession().history).toHaveLength(1);
  });

  it("recovers a degraded game by opening a fresh request", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    await createService(stubProvider({ reason: "timeout", status: "failed" })).runTurn({
      coordinator,
      profileId: "club",
    });
    expect(coordinator.getSession().lifecycle.phase).toBe("degraded");

    const retry = await createService(
      stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" }),
      "req-2",
    ).runTurn({ coordinator, profileId: "club" });

    expect(retry).toEqual({ status: "committed" });
    expect(coordinator.getSession().lifecycle.phase).toBe("player-turn");
  });

  it("degrades rather than committing when the provider proposes an illegal move", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    const provider = stubProvider({ move: moveInputFromUci("a1a8"), status: "proposed" });

    const outcome = await createService(provider).runTurn({ coordinator, profileId: "club" });

    expect(outcome).toEqual({ reason: "illegal-move", status: "degraded" });
    expect(coordinator.getSession().history).toHaveLength(1);
  });

  it("treats a thrown provider error as an internal failure without crashing", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    const provider: StubProvider = {
      cancel: vi.fn(),
      propose: vi.fn<OpponentProvider["proposeMove"]>(),
      provider: {
        cancel: vi.fn(),
        proposeMove: () => Promise.reject(new Error("private detail")),
        providerId: "throwing",
      },
    };

    await expect(
      createService(provider).runTurn({ coordinator, profileId: "club" }),
    ).resolves.toEqual({ reason: "internal-provider-error", status: "degraded" });
  });

  it("reports a superseded turn when the request cannot be opened", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    await coordinator.requestOpponentMove({ requestId: "req-existing" as never });
    const provider = stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" });

    await expect(
      createService(provider).runTurn({ coordinator, profileId: "club" }),
    ).resolves.toEqual({ status: "not-opponent-turn" });
  });

  it("forwards cancellation to the provider", () => {
    const provider = stubProvider({ reason: "request-cancelled", status: "failed" });
    createService(provider).cancel();
    expect(provider.cancel).toHaveBeenCalledOnce();
  });
});

describe("opponent profiles", () => {
  it("exposes a default that exists in the catalogue", () => {
    expect(isOpponentProfileId(DEFAULT_OPPONENT_PROFILE_ID)).toBe(true);
    expect(findOpponentProfile(DEFAULT_OPPONENT_PROFILE_ID).id).toBe(DEFAULT_OPPONENT_PROFILE_ID);
  });

  it("rejects unknown identifiers", () => {
    expect(isOpponentProfileId("grandmaster")).toBe(false);
    expect(isOpponentProfileId(undefined)).toBe(false);
    expect(() => findOpponentProfile("grandmaster" as never)).toThrow();
  });

  it("keeps every profile inside the engine's supported ranges", () => {
    for (const profile of OPPONENT_PROFILES) {
      expect(profile.strength.skillLevel).toBeGreaterThanOrEqual(0);
      expect(profile.strength.skillLevel).toBeLessThanOrEqual(20);
      expect(profile.strength.moveTimeMs).toBeGreaterThan(0);
      expect(profile.thinkTime.minimumMs).toBeLessThanOrEqual(profile.thinkTime.maximumMs);
      if (profile.strength.limitStrengthElo !== undefined) {
        expect(profile.strength.limitStrengthElo).toBeGreaterThanOrEqual(1_320);
        expect(profile.strength.limitStrengthElo).toBeLessThanOrEqual(3_190);
      }
    }
  });

  it("orders profiles from weakest to strongest", () => {
    const skills = OPPONENT_PROFILES.map((profile) => profile.strength.skillLevel);
    expect([...skills].sort((left, right) => left - right)).toEqual(skills);
  });
});

describe("OpponentTurnService guards", () => {
  it("refuses to move for a human side even when the phase allows it", async () => {
    const controller = createControllerFixture({ white: "external-opponent" });
    const coordinator = createGameSessionCoordinator({
      controller,
      gameRepository: new MemoryGameRepository(),
      wallClock: new FixedWallClock(),
    });
    await coordinator.start(at(1_000));
    const provider = stubProvider({ move: moveInputFromUci("e2e4"), status: "proposed" });
    await createService(provider).runTurn({ coordinator, profileId: "club" });
    await coordinator.submitHumanMove({ move: moveInputFromUci("e7e5"), now: at(1_200) });

    await expect(
      createService(provider, "req-9").runTurn({ coordinator, profileId: "club" }),
    ).resolves.toEqual({ status: "not-opponent-turn" });
  });

  it("reports a superseded turn when the position moved on before the proposal landed", async () => {
    const coordinator = await reachOpponentTurn(engineGameCoordinator());
    const provider: StubProvider = {
      cancel: vi.fn(),
      propose: vi.fn<OpponentProvider["proposeMove"]>(),
      provider: {
        cancel: vi.fn(),
        proposeMove: async () => {
          await coordinator.undoMoves({ now: at(1_500), plies: 1 as never });
          return { move: moveInputFromUci("e7e5"), status: "proposed" as const };
        },
        providerId: "racing",
      },
    };

    const outcome = await createService(provider).runTurn({ coordinator, profileId: "club" });

    expect(outcome).toEqual({ status: "superseded" });
  });
});

describe("OpponentTurnService against a hostile coordinator", () => {
  function fakeCoordinator(
    session: unknown,
    overrides: Partial<Record<string, unknown>> = {},
  ): GameSessionCoordinator {
    return {
      abandon: vi.fn(),
      commitOpponentMove: vi.fn(() => Promise.resolve({ status: "blocked" })),
      exportPgn: vi.fn(),
      getLegalMoves: vi.fn(() => []),
      getPersistenceState: vi.fn(),
      getSession: () => session,
      pause: vi.fn(),
      rejectOpponentRequest: vi.fn(() => Promise.resolve({ status: "applied" })),
      requestOpponentMove: vi.fn(() =>
        Promise.resolve({
          session: {
            ...(session as Record<string, unknown>),
            activeOpponentRequest: {
              expectedFen: "8/8/8/8/8/8/8/8 w - - 0 1",
              expectedPly: 0,
              expectedRevision: 0,
              requestId: "req-1",
              requestedColor: "black",
            },
            history: [],
          },
          status: "applied",
        }),
      ),
      restart: vi.fn(),
      resume: vi.fn(),
      retryPersistence: vi.fn(),
      start: vi.fn(),
      submitHumanMove: vi.fn(),
      undoMoves: vi.fn(),
      ...overrides,
    } as unknown as GameSessionCoordinator;
  }

  const opponentTurnSession = {
    clock: { status: "untimed" },
    configuration: {
      initialPosition: { kind: "standard" },
      participants: { black: { kind: "human" }, white: { kind: "human" } },
    },
    history: [],
    lifecycle: { phase: "opponent-turn" },
    position: { turn: "black" },
    revision: 0,
  };

  it("refuses to act when the side to move is not an external opponent", async () => {
    const requestOpponentMove = vi.fn();
    const coordinator = fakeCoordinator(opponentTurnSession, { requestOpponentMove });
    const provider = stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" });

    await expect(
      createService(provider).runTurn({ coordinator, profileId: "club" }),
    ).resolves.toEqual({ status: "not-opponent-turn" });
    expect(requestOpponentMove).not.toHaveBeenCalled();
  });

  it("fails safely when a request cannot be opened at all", async () => {
    const coordinator = fakeCoordinator(
      { ...opponentTurnSession, configuration: externalBlack() },
      { requestOpponentMove: vi.fn(() => Promise.resolve({ status: "failed" })) },
    );

    await expect(
      createService(stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" })).runTurn({
        coordinator,
        profileId: "club",
      }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("fails safely when no request state comes back with an applied request", async () => {
    const coordinator = fakeCoordinator(
      { ...opponentTurnSession, configuration: externalBlack() },
      {
        requestOpponentMove: vi.fn(() =>
          Promise.resolve({ session: { activeOpponentRequest: undefined }, status: "applied" }),
        ),
      },
    );

    await expect(
      createService(stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" })).runTurn({
        coordinator,
        profileId: "club",
      }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("fails safely when the commit is blocked rather than applied or rejected", async () => {
    const coordinator = fakeCoordinator({
      ...opponentTurnSession,
      configuration: externalBlack(),
    });

    await expect(
      createService(stubProvider({ move: moveInputFromUci("e7e5"), status: "proposed" })).runTurn({
        coordinator,
        profileId: "club",
      }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("reports a superseded turn when a degraded request cannot be recorded", async () => {
    const coordinator = fakeCoordinator(
      { ...opponentTurnSession, configuration: externalBlack() },
      { rejectOpponentRequest: vi.fn(() => Promise.resolve({ status: "rejected" })) },
    );

    await expect(
      createService(stubProvider({ reason: "unavailable", status: "failed" })).runTurn({
        coordinator,
        profileId: "club",
      }),
    ).resolves.toEqual({ status: "superseded" });
  });

  function externalBlack() {
    return {
      initialPosition: { kind: "standard" },
      participants: { black: { kind: "external-opponent" }, white: { kind: "human" } },
    };
  }
});
