import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci, type ChessRulesPort } from "./chess-rules";
import {
  parseClockDurationMs,
  parseClockIncrementMs,
  parseMonotonicTimestampMs,
} from "./clock-primitives";
import { GameControllerError } from "./errors";
import { createGameController, type GameController } from "./game-controller";
import type { GameSession, OpponentMoveProposal } from "./game-session";
import {
  parseFen,
  parseGameId,
  parsePly,
  parseRequestId,
  parseSessionRevision,
} from "./primitives";

const initialFen = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

function configuration(
  white: "external-opponent" | "human" = "human",
  black: "external-opponent" | "human" = "external-opponent",
  timeControl: Readonly<Record<string, unknown>> = { kind: "untimed" },
  initialPosition: Readonly<Record<string, unknown>> = { kind: "standard" },
) {
  return {
    allowUndo: false,
    gameId: "game-controller-test",
    initialPosition,
    participants: {
      black: { kind: black, label: "Black" },
      white: { kind: white, label: "White" },
    },
    timeControl,
  };
}

function controller(
  white: "external-opponent" | "human" = "human",
  black: "external-opponent" | "human" = "external-opponent",
  timeControl: Readonly<Record<string, unknown>> = { kind: "untimed" },
  initialPosition: Readonly<Record<string, unknown>> = { kind: "standard" },
): { readonly controller: GameController; readonly rules: ChessJsRulesAdapter } {
  const rules = new ChessJsRulesAdapter();
  return {
    controller: createGameController({
      configuration: configuration(white, black, timeControl, initialPosition),
      rules,
    }),
    rules,
  };
}

function now(value: number) {
  return parseMonotonicTimestampMs(value);
}

function start(game: GameController, at = 0): GameSession {
  const result = game.start(now(at));
  expect(result.status).toBe("applied");
  return result.session;
}

function humanMove(game: GameController, uci: string, at = 0) {
  return game.submitHumanMove({ move: moveInputFromUci(uci), now: now(at) });
}

function requestMove(game: GameController, id = "request-1") {
  return game.requestOpponentMove({ requestId: parseRequestId(id) });
}

function proposal(session: GameSession, uci: string): OpponentMoveProposal {
  const request = session.activeOpponentRequest;
  if (!request) {
    throw new Error("Test setup requires an active request.");
  }
  return { ...request, move: moveInputFromUci(uci) };
}

describe("authoritative game creation and start", () => {
  it("creates a standard ready session at session-relative ply zero", () => {
    const { controller: game } = controller();
    const session = game.getSession();
    expect(session.lifecycle).toEqual({ phase: "ready" });
    expect(session.position).toMatchObject({ fen: initialFen, ply: 0, turn: "white" });
    expect(session.history).toEqual([]);
    expect(session.revision).toBe(0);
  });

  it("creates a custom-FEN session at session-relative ply zero", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 20";
    const { controller: game } = controller(
      "human",
      "human",
      { kind: "untimed" },
      { fen, kind: "fen" },
    );
    expect(game.getSession().position).toMatchObject({ fen, ply: 0, turn: "white" });
  });

  it.each([
    [null, "object"],
    [{}, "participants"],
    [{ ...configuration(), participants: { white: { kind: "human" } } }, "participants"],
    [{ ...configuration(), gameId: "bad id" }, "identifier"],
    [{ ...configuration(), timeControl: { kind: "delay" } }, "time-control"],
  ])("rejects invalid configuration %#", (value, description) => {
    expect(description).toBeTypeOf("string");
    expect(() =>
      createGameController({ configuration: value, rules: new ChessJsRulesAdapter() }),
    ).toThrow(GameControllerError);
  });

  it("freezes the initial session and its nested configuration", () => {
    const { controller: game } = controller();
    const session = game.getSession();
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.configuration)).toBe(true);
    expect(Object.isFrozen(session.configuration.participants.white)).toBe(true);
    expect(Object.isFrozen(session.history)).toBe(true);
    expect(Reflect.set(session.configuration.participants.white, "kind", "external-opponent")).toBe(
      false,
    );
    expect(game.getSession().configuration.participants.white.kind).toBe("human");
  });

  it("starts a human White game in player-turn", () => {
    const { controller: game } = controller();
    const result = game.start(now(10));
    expect(result.status).toBe("applied");
    expect(result.session.lifecycle).toEqual({ phase: "player-turn" });
    expect(result.events).toMatchObject([{ activeColor: "white", type: "game-started" }]);
  });

  it("starts an external White game in opponent-turn", () => {
    const { controller: game } = controller("external-opponent", "human");
    expect(game.start(now(10)).session.lifecycle).toEqual({ phase: "opponent-turn" });
  });

  it("activates the correct timed clock", () => {
    const { controller: game } = controller("human", "human", {
      initialMs: 5_000,
      kind: "sudden-death",
    });
    const session = start(game, 100);
    expect(session.clock).toMatchObject({
      activeColor: "white",
      lastTimestampMs: 100,
      status: "running",
    });
  });

  it("starts an untimed game without creating remaining balances", () => {
    const { controller: game } = controller();
    expect(start(game, 100).clock).toEqual({
      lastTimestampMs: 100,
      status: "untimed",
      timeControl: { kind: "untimed" },
    });
  });

  it("rejects a repeated start with the exact prior session", () => {
    const { controller: game } = controller();
    const prior = start(game);
    const result = game.start(now(1));
    expect(result).toMatchObject({ reason: "already-started", status: "rejected" });
    expect(result.session).toBe(prior);
    expect(result.events).toEqual([]);
  });
});

describe("human move authority", () => {
  it("commits a valid human move through the rules authority", () => {
    const { controller: game } = controller();
    start(game);
    const result = humanMove(game, "e2e4");
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.move).toMatchObject({ actor: "human", mover: "white", san: "e4", uci: "e2e4" });
    expect(result.session.position.turn).toBe("black");
  });

  it("records SAN, UCI, FEN, ply, and before/after clocks", () => {
    const { controller: game } = controller("human", "human", {
      incrementMs: 2_000,
      initialMs: 180_000,
      kind: "increment",
    });
    start(game, 1_000);
    const result = humanMove(game, "e2e4", 4_000);
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.move).toMatchObject({ fenBefore: initialFen, ply: 1, san: "e4", uci: "e2e4" });
    expect(result.move.fenAfter).toBe(result.session.position.fen);
    expect(result.move.clockBefore).toMatchObject({ remaining: { white: 177_000 } });
    expect(result.move.clockAfter).toMatchObject({
      activeColor: "black",
      remaining: { white: 179_000 },
    });
  });

  it("rejects an illegal move without mutating session or rules", () => {
    const { controller: game, rules } = controller();
    const prior = start(game);
    const fen = rules.getFen();
    const result = humanMove(game, "e2e5");
    expect(result).toMatchObject({ reason: "illegal-move", status: "rejected" });
    expect(result.session).toBe(prior);
    expect(rules.getFen()).toBe(fen);
  });

  it.each([
    ["opponent-turn", "external-opponent", "human"],
    ["awaiting-opponent", "external-opponent", "human"],
  ] as const)("rejects a human move during %s", (phase, white, black) => {
    const { controller: game } = controller(white, black);
    start(game);
    if (phase === "awaiting-opponent") requestMove(game);
    const prior = game.getSession();
    const result = humanMove(game, "e2e4");
    expect(result).toMatchObject({ reason: "invalid-lifecycle", status: "rejected" });
    expect(result.session).toBe(prior);
  });

  it("rejects a human move while paused", () => {
    const { controller: game } = controller("human", "human");
    start(game);
    game.pause(now(1));
    const prior = game.getSession();
    expect(humanMove(game, "e2e4", 2)).toMatchObject({
      reason: "already-paused",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects a stale expected revision", () => {
    const { controller: game } = controller("human", "human");
    start(game);
    const prior = game.getSession();
    const result = game.submitHumanMove({
      expectedRevision: parseSessionRevision(0),
      move: moveInputFromUci("e2e4"),
      now: now(0),
    });
    expect(result).toMatchObject({ reason: "stale-revision", session: prior, status: "rejected" });
  });

  it("completes at the exact clock boundary without applying the move", () => {
    const { controller: game, rules } = controller("human", "human", {
      initialMs: 1_000,
      kind: "sudden-death",
    });
    start(game, 0);
    const result = humanMove(game, "e2e4", 1_000);
    expect(result).toMatchObject({
      move: undefined,
      result: { loser: "white", reason: "timeout", winner: "black" },
      status: "completed",
    });
    expect(result.session.history).toHaveLength(0);
    expect(rules.getFen()).toBe(initialFen);
  });

  it("adds increment only after a successful move", () => {
    const { controller: game } = controller("human", "human", {
      incrementMs: 2_000,
      initialMs: 180_000,
      kind: "increment",
    });
    start(game, 0);
    const result = humanMove(game, "e2e4", 3_000);
    expect(result.session.clock).toMatchObject({ remaining: { white: 179_000 } });
  });

  it("increments revision exactly once for a successful move", () => {
    const { controller: game } = controller("human", "human");
    const prior = start(game);
    expect(humanMove(game, "e2e4").session.revision).toBe(prior.revision + 1);
  });

  it("does not increment revision for a rejected move", () => {
    const { controller: game } = controller("human", "human");
    const prior = start(game);
    expect(humanMove(game, "e2e5").session.revision).toBe(prior.revision);
  });
});

describe("participant routing and opponent requests", () => {
  it.each([
    ["human-to-external", "human", "external-opponent", "opponent-turn"],
    ["external-to-human", "external-opponent", "human", "player-turn"],
    ["human-to-human", "human", "human", "player-turn"],
  ] as const)("routes %s after a committed move", (_name, white, black, expectedPhase) => {
    const { controller: game } = controller(white, black);
    start(game);
    const result =
      white === "human"
        ? humanMove(game, "e2e4")
        : (() => {
            requestMove(game);
            return game.commitOpponentMove(proposal(game.getSession(), "e2e4"), now(0));
          })();
    expect(result.session.lifecycle.phase).toBe(expectedPhase);
  });

  it("represents external-versus-external without executing a provider", () => {
    const { controller: game } = controller("external-opponent", "external-opponent");
    start(game);
    const requested = requestMove(game);
    const moved = game.commitOpponentMove(proposal(requested.session, "e2e4"), now(0));
    expect(moved.session.lifecycle.phase).toBe("opponent-turn");
  });

  it("creates a request with the complete stale-response context", () => {
    const { controller: game } = controller("external-opponent", "human");
    const started = start(game);
    const result = requestMove(game, "request-context");
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.request).toEqual({
      expectedFen: started.position.fen,
      expectedPly: started.position.ply,
      expectedRevision: started.revision,
      requestId: parseRequestId("request-context"),
      requestedColor: "white",
    });
    expect(result.session.revision).toBe(started.revision + 1);
    expect(result.events).toMatchObject([
      { request: result.request, type: "opponent-move-requested" },
    ]);
  });

  it("rejects a duplicate active request", () => {
    const { controller: game } = controller("external-opponent", "human");
    start(game);
    requestMove(game);
    const prior = game.getSession();
    expect(requestMove(game, "request-2")).toMatchObject({
      reason: "opponent-request-active",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects a request during a human turn", () => {
    const { controller: game } = controller("human", "human");
    const prior = start(game);
    expect(requestMove(game)).toMatchObject({
      reason: "invalid-lifecycle",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects a request with a stale caller revision", () => {
    const { controller: game } = controller("external-opponent", "human");
    const prior = start(game);
    const result = game.requestOpponentMove({
      expectedRevision: parseSessionRevision(0),
      requestId: parseRequestId("stale"),
    });
    expect(result).toMatchObject({ reason: "stale-revision", session: prior, status: "rejected" });
  });
});

describe("external opponent proposal protection", () => {
  function awaiting(): { game: GameController; prior: GameSession; valid: OpponentMoveProposal } {
    const { controller: game } = controller("external-opponent", "human");
    start(game);
    const prior = requestMove(game).session;
    return { game, prior, valid: proposal(prior, "e2e4") };
  }

  it("commits a valid external proposal and clears the request", () => {
    const { game, valid } = awaiting();
    const result = game.commitOpponentMove(valid, now(0));
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.move).toMatchObject({ actor: "external-opponent", uci: "e2e4" });
    expect(result.session.activeOpponentRequest).toBeUndefined();
  });

  it.each([
    [
      "request-id-mismatch",
      (value: OpponentMoveProposal) => ({ ...value, requestId: parseRequestId("stale-id") }),
    ],
    [
      "position-mismatch",
      (value: OpponentMoveProposal) => ({
        ...value,
        expectedFen: parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1"),
      }),
    ],
    ["ply-mismatch", (value: OpponentMoveProposal) => ({ ...value, expectedPly: parsePly(1) })],
    [
      "stale-revision",
      (value: OpponentMoveProposal) => ({
        ...value,
        expectedRevision: parseSessionRevision(value.expectedRevision + 1),
      }),
    ],
    [
      "request-color-mismatch",
      (value: OpponentMoveProposal) => ({ ...value, requestedColor: "black" as const }),
    ],
  ] as const)("rejects stale proposal context as %s without mutation", (reason, mutate) => {
    const { game, prior, valid } = awaiting();
    const result = game.commitOpponentMove(mutate(valid), now(0));
    expect(result).toMatchObject({ reason, session: prior, status: "rejected" });
    expect(game.getSession()).toBe(prior);
    expect(game.getSession().activeOpponentRequest).toBe(prior.activeOpponentRequest);
  });

  it("rejects an illegal proposal without mutation or replacement", () => {
    const { game, prior, valid } = awaiting();
    const result = game.commitOpponentMove({ ...valid, move: moveInputFromUci("e2e5") }, now(0));
    expect(result).toMatchObject({ reason: "illegal-move", session: prior, status: "rejected" });
    expect(result.events).toEqual([]);
    expect(game.getSession().position.fen).toBe(initialFen);
  });

  it("rejects a proposal after pause and preserves its request", () => {
    const { game, valid } = awaiting();
    game.pause(now(10));
    const prior = game.getSession();
    expect(game.commitOpponentMove(valid, now(10))).toMatchObject({
      reason: "already-paused",
      session: prior,
      status: "rejected",
    });
    expect(prior.activeOpponentRequest).toBeDefined();
  });

  it("accepts the captured request revision after pause and resume", () => {
    const { game, valid } = awaiting();
    game.pause(now(10));
    game.resume(now(20));
    expect(game.commitOpponentMove(valid, now(20)).status).toBe("applied");
  });
});

describe("pause, degraded mode, abandonment, and timeout", () => {
  it.each([
    ["player-turn", "human", "human"],
    ["opponent-turn", "external-opponent", "human"],
  ] as const)("pauses from %s and resumes the exact phase", (phase, white, black) => {
    const { controller: game } = controller(white, black);
    start(game);
    const paused = game.pause(now(10));
    expect(paused.session.lifecycle).toEqual({ phase: "paused", resumePhase: phase });
    expect(paused.events).toMatchObject([{ resumePhase: phase, type: "game-paused" }]);
    const resumed = game.resume(now(50));
    expect(resumed.session.lifecycle.phase).toBe(phase);
    expect(resumed.events).toMatchObject([{ resumedPhase: phase, type: "game-resumed" }]);
  });

  it("preserves an awaiting request through pause and resume", () => {
    const { controller: game } = controller("external-opponent", "human");
    start(game);
    const request = requestMove(game).session.activeOpponentRequest;
    const paused = game.pause(now(10));
    expect(paused.session.lifecycle).toEqual({ phase: "paused", resumePhase: "awaiting-opponent" });
    expect(paused.session.activeOpponentRequest).toEqual(request);
    expect(game.resume(now(20)).session.activeOpponentRequest).toEqual(request);
  });

  it("charges active time at pause but never charges paused duration", () => {
    const { controller: game } = controller("human", "human", {
      initialMs: 10_000,
      kind: "sudden-death",
    });
    start(game, 1_000);
    const paused = game.pause(now(4_000));
    expect(paused.session.clock).toMatchObject({ remaining: { white: 7_000 }, status: "paused" });
    const resumed = game.resume(now(9_000));
    expect(resumed.session.clock).toMatchObject({
      lastTimestampMs: 9_000,
      remaining: { white: 7_000 },
      status: "running",
    });
  });

  it("completes by timeout when pause reaches the expiration boundary", () => {
    const { controller: game } = controller("human", "human", {
      initialMs: 1_000,
      kind: "sudden-death",
    });
    start(game);
    expect(game.pause(now(1_000))).toMatchObject({
      result: { reason: "timeout" },
      status: "completed",
    });
  });

  it("rejects resume unless paused", () => {
    const { controller: game } = controller();
    const prior = start(game);
    expect(game.resume(now(1))).toMatchObject({
      reason: "not-paused",
      session: prior,
      status: "rejected",
    });
  });

  it("maps opponent failure to degraded state without raw exceptions or a move", () => {
    const { controller: game } = controller("external-opponent", "human");
    start(game);
    const awaitingSession = requestMove(game, "provider-failure").session;
    const result = game.rejectOpponentRequest({
      expectedRevision: awaitingSession.revision,
      reason: "internal-provider-error",
      requestId: parseRequestId("provider-failure"),
    });
    expect(result.status).toBe("applied");
    expect(result.session.lifecycle).toEqual({ phase: "degraded" });
    expect(result.session.activeOpponentRequest).toBeUndefined();
    expect(result.session.history).toHaveLength(0);
    expect(result.events.map((event) => event.type)).toEqual([
      "opponent-request-failed",
      "game-entered-degraded-mode",
    ]);
    expect(JSON.stringify(result.session)).not.toContain("Error");
  });

  it.each([
    "timeout",
    "unavailable",
    "invalid-response",
    "illegal-move",
    "request-cancelled",
    "internal-provider-error",
  ] as const)("accepts the typed opponent failure category %s", (reason) => {
    const { controller: game } = controller("external-opponent", "human");
    start(game);
    requestMove(game);
    expect(
      game.rejectOpponentRequest({ reason, requestId: parseRequestId("request-1") }).session
        .lifecycle.phase,
    ).toBe("degraded");
  });

  it.each([
    ["active", false],
    ["paused", true],
  ])("abandons an %s game, stops its clock, and rejects repetition", (_name, shouldPause) => {
    const { controller: game } = controller("human", "human", {
      initialMs: 10_000,
      kind: "sudden-death",
    });
    start(game, 0);
    if (shouldPause) game.pause(now(1_000));
    const result = game.abandon({ now: now(2_000) });
    expect(result).toMatchObject({ result: { reason: "abandoned" }, status: "completed" });
    expect(result.session.lifecycle.phase).toBe("abandoned");
    expect(result.session.clock.status).toBe("stopped");
    expect(game.abandon({ now: now(3_000) })).toMatchObject({
      reason: "already-abandoned",
      session: result.session,
      status: "rejected",
    });
    expect(humanMove(game, "e2e4", 3_000)).toMatchObject({
      reason: "already-abandoned",
      session: result.session,
      status: "rejected",
    });
  });

  it("abandons an awaiting game and clears its request", () => {
    const { controller: game } = controller("external-opponent", "human");
    start(game);
    requestMove(game);
    const result = game.abandon({ awardedWinner: "black", now: now(0) });
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.session.activeOpponentRequest).toBeUndefined();
    expect(result.result).toMatchObject({ loser: "white", pgnResult: "0-1", winner: "black" });
  });

  it.each([
    ["white", "human", "human", "e2e4"],
    ["black", "human", "human", "e2e4"],
  ] as const)(
    "records %s timeout at zero and emits both completion events",
    (color, white, black, firstMove) => {
      const { controller: game } = controller(white, black, {
        initialMs: 1_000,
        kind: "sudden-death",
      });
      start(game, 0);
      if (color === "black") humanMove(game, firstMove, 0);
      const before = game.getSession();
      const result = humanMove(game, color === "white" ? "e2e4" : "e7e5", 1_000);
      expect(result.status).toBe("completed");
      expect(result.session.history).toHaveLength(before.history.length);
      expect(result.session.position.fen).toBe(before.position.fen);
      expect(result.session.clock).toMatchObject({
        expiredColor: color,
        remaining: { [color]: 0 },
        status: "expired",
      });
      expect(result.events.map((event) => event.type)).toEqual(["clock-expired", "game-completed"]);
    },
  );
});

describe("unexpected post-rules failure rollback", () => {
  it("undoes an applied rules move and preserves the prior session when clock increment overflows", () => {
    const rules = new ChessJsRulesAdapter();
    const game = createGameController({
      configuration: configuration("human", "human", {
        incrementMs: Number.MAX_SAFE_INTEGER,
        initialMs: 1,
        kind: "increment",
      }),
      rules,
    });
    const prior = start(game, 0);
    expect(() => humanMove(game, "e2e4", 0)).toThrow(GameControllerError);
    expect(game.getSession()).toBe(prior);
    expect(rules.getFen()).toBe(initialFen);
  });

  it("wraps a throwing rules boundary as a typed controller failure", () => {
    const rules = new ChessJsRulesAdapter();
    const throwingRules: ChessRulesPort = {
      attemptMove: () => {
        throw new Error("provider detail");
      },
      createInitialPosition: rules.createInitialPosition.bind(rules),
      exportPgn: rules.exportPgn.bind(rules),
      getFen: rules.getFen.bind(rules),
      getLegalMoves: rules.getLegalMoves.bind(rules),
      getTerminalState: rules.getTerminalState.bind(rules),
      getTurn: rules.getTurn.bind(rules),
      isCheck: rules.isCheck.bind(rules),
      loadFen: rules.loadFen.bind(rules),
      loadPgn: rules.loadPgn.bind(rules),
      undo: rules.undo.bind(rules),
    };
    const game = createGameController({
      configuration: configuration("human", "human"),
      rules: throwingRules,
    });
    const prior = start(game);
    expect(() => humanMove(game, "e2e4")).toThrow(GameControllerError);
    expect(game.getSession()).toBe(prior);
    expect(rules.getFen()).toBe(initialFen);
  });
});

describe("public model primitives used by the controller", () => {
  it("accepts branded IDs and safe clock values without widening runtime state", () => {
    expect(parseGameId("game-1")).toBe("game-1");
    expect(parseClockDurationMs(1_000)).toBe(1_000);
    expect(parseClockIncrementMs(10)).toBe(10);
  });
});
