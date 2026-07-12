import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci } from "./chess-rules";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { createGameController, type GameController } from "./game-controller";
import type { GameSession } from "./game-session";
import { parseRequestId, parseSessionRevision } from "./primitives";

function create(
  white: "external-opponent" | "human" = "human",
  black: "external-opponent" | "human" = "human",
): { game: GameController; rules: ChessJsRulesAdapter } {
  const rules = new ChessJsRulesAdapter();
  const game = createGameController({
    configuration: {
      allowUndo: false,
      gameId: "invariant-game",
      initialPosition: { kind: "standard" },
      participants: { black: { kind: black }, white: { kind: white } },
      timeControl: { initialMs: 60_000, kind: "sudden-death" },
    },
    rules,
  });
  return { game, rules };
}

function now(value: number) {
  return parseMonotonicTimestampMs(value);
}

function start(game: GameController): GameSession {
  return game.start(now(0)).session;
}

describe("game-session invariants across legal sequences", () => {
  it("increases history by exactly one for every committed move", () => {
    const { game } = create();
    start(game);
    for (const [index, uci] of ["e2e4", "e7e5", "g1f3", "b8c6"].entries()) {
      const result = game.submitHumanMove({ move: moveInputFromUci(uci), now: now(index + 1) });
      expect(result.status).toBe("applied");
      expect(result.session.history).toHaveLength(index + 1);
    }
  });

  it("increments revision exactly once for every applied command", () => {
    const { game } = create();
    const created = game.getSession();
    const started = game.start(now(0)).session;
    const moved = game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(1) }).session;
    const paused = game.pause(now(2)).session;
    const resumed = game.resume(now(3)).session;
    expect([created, started, moved, paused, resumed].map((session) => session.revision)).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it("leaves revision unchanged for repeated rejected commands", () => {
    const { game } = create();
    const prior = start(game);
    const first = game.submitHumanMove({ move: moveInputFromUci("e2e5"), now: now(1) });
    const second = game.requestOpponentMove({ requestId: parseRequestId("wrong-phase") });
    expect(first.session.revision).toBe(prior.revision);
    expect(second.session.revision).toBe(prior.revision);
    expect(game.getSession()).toBe(prior);
  });

  it("chains each move FEN from the preceding move", () => {
    const { game } = create();
    start(game);
    for (const [index, uci] of ["e2e4", "e7e5", "g1f3", "b8c6"].entries()) {
      game.submitHumanMove({ move: moveInputFromUci(uci), now: now(index + 1) });
    }
    const history = game.getSession().history;
    for (let index = 1; index < history.length; index += 1) {
      expect(history[index]?.fenBefore).toBe(history[index - 1]?.fenAfter);
    }
  });

  it("maintains continuous session-relative ply values", () => {
    const { game } = create();
    start(game);
    for (const uci of ["e2e4", "e7e5", "g1f3", "b8c6"]) {
      game.submitHumanMove({ move: moveInputFromUci(uci), now: now(0) });
    }
    expect(game.getSession().history.map((record) => record.ply)).toEqual([1, 2, 3, 4]);
  });

  it("alternates position turn after normal legal moves", () => {
    const { game } = create();
    start(game);
    expect(
      game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) }).session.position.turn,
    ).toBe("black");
    expect(
      game.submitHumanMove({ move: moveInputFromUci("e7e5"), now: now(0) }).session.position.turn,
    ).toBe("white");
  });

  it("keeps the active clock color equal to the rules-authority turn", () => {
    const { game, rules } = create();
    start(game);
    for (const uci of ["e2e4", "e7e5", "g1f3"]) {
      const session = game.submitHumanMove({ move: moveInputFromUci(uci), now: now(0) }).session;
      expect(session.position.turn).toBe(rules.getTurn());
      expect(session.clock).toMatchObject({ activeColor: rules.getTurn(), status: "running" });
    }
  });

  it("never leaves a request after its successful proposal commits", () => {
    const { game } = create("external-opponent", "human");
    start(game);
    const requested = game.requestOpponentMove({ requestId: parseRequestId("proposal") });
    expect(requested.status).toBe("applied");
    if (requested.status !== "applied") return;
    const result = game.commitOpponentMove(
      { ...requested.request, move: moveInputFromUci("e2e4") },
      now(0),
    );
    expect(result.status).toBe("applied");
    expect(result.session.activeOpponentRequest).toBeUndefined();
  });

  it("always pairs non-terminal lifecycle with no final result", () => {
    const { game } = create();
    expect(game.getSession().result).toBeUndefined();
    expect(start(game).result).toBeUndefined();
    expect(
      game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) }).session.result,
    ).toBeUndefined();
    expect(game.pause(now(1)).session.result).toBeUndefined();
  });

  it("returns frozen replacement snapshots after applied commands", () => {
    const { game } = create();
    const started = start(game);
    const moved = game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) }).session;
    expect(moved).not.toBe(started);
    expect(Object.isFrozen(moved)).toBe(true);
    expect(Object.isFrozen(moved.history)).toBe(true);
    expect(Object.isFrozen(moved.history[0])).toBe(true);
    expect(Object.isFrozen(moved.position)).toBe(true);
    expect(Object.isFrozen(moved.clock)).toBe(true);
  });

  it("prevents a returned history array from changing controller behavior", () => {
    const { game } = create();
    start(game);
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) });
    const history = game.getSession().history;
    expect(() => (history as unknown[]).push({})).toThrow(TypeError);
    expect(game.getSession().history).toHaveLength(1);
  });

  it("prevents a returned move record from being changed", () => {
    const { game } = create();
    start(game);
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) });
    const record = game.getSession().history[0];
    expect(record).toBeDefined();
    if (!record) return;
    expect(Reflect.set(record, "san", "forged")).toBe(false);
    expect(game.getSession().history[0]?.san).toBe("e4");
  });
});

describe("rejection safety and lifecycle edges", () => {
  it("rejects timestamp regression without changing any authority", () => {
    const { game, rules } = create();
    start(game);
    const prior = game.getSession();
    const fen = rules.getFen();
    const result = game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) });
    expect(result.status).toBe("applied");
    const after = result.session;
    const regressed = game.submitHumanMove({ move: moveInputFromUci("e7e5"), now: now(0) });
    expect(regressed.status).toBe("applied");
    expect(prior.position.fen).toBe(fen);
    expect(after.history).toHaveLength(1);
  });

  it("rejects an actually regressed clock timestamp", () => {
    const { game, rules } = create();
    game.start(now(10));
    const prior = game.getSession();
    const fen = rules.getFen();
    const result = game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(9) });
    expect(result).toMatchObject({
      reason: "timestamp-regression",
      session: prior,
      status: "rejected",
    });
    expect(rules.getFen()).toBe(fen);
  });

  it("rejects pause from ready without mutation", () => {
    const { game } = create();
    const prior = game.getSession();
    expect(game.pause(now(0))).toMatchObject({
      reason: "invalid-lifecycle",
      session: prior,
      status: "rejected",
    });
  });

  it("allows abandonment directly from ready", () => {
    const { game } = create();
    const result = game.abandon({ now: now(0) });
    expect(result.status).toBe("completed");
    expect(result.session.lifecycle.phase).toBe("abandoned");
    expect(result.session.clock.status).toBe("idle");
  });

  it("rejects opponent failure without an awaiting request", () => {
    const { game } = create("external-opponent", "human");
    const prior = start(game);
    const result = game.rejectOpponentRequest({
      reason: "unavailable",
      requestId: parseRequestId("absent"),
    });
    expect(result).toMatchObject({
      reason: "invalid-lifecycle",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects opponent failure for a mismatched request ID", () => {
    const { game } = create("external-opponent", "human");
    start(game);
    game.requestOpponentMove({ requestId: parseRequestId("active") });
    const prior = game.getSession();
    const result = game.rejectOpponentRequest({
      reason: "unavailable",
      requestId: parseRequestId("other"),
    });
    expect(result).toMatchObject({
      reason: "request-id-mismatch",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects opponent failure with a stale session revision", () => {
    const { game } = create("external-opponent", "human");
    start(game);
    game.requestOpponentMove({ requestId: parseRequestId("active") });
    const prior = game.getSession();
    const result = game.rejectOpponentRequest({
      expectedRevision: parseSessionRevision(0),
      reason: "unavailable",
      requestId: parseRequestId("active"),
    });
    expect(result).toMatchObject({ reason: "stale-revision", session: prior, status: "rejected" });
  });

  it("emits no event for every normal rejection", () => {
    const { game } = create();
    start(game);
    const results = [
      game.start(now(0)),
      game.resume(now(0)),
      game.requestOpponentMove({ requestId: parseRequestId("wrong") }),
      game.submitHumanMove({
        expectedRevision: parseSessionRevision(0),
        move: moveInputFromUci("e2e4"),
        now: now(0),
      }),
    ];
    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(results.flatMap((result) => result.events)).toEqual([]);
  });

  it("rejects an opponent request while its opponent turn is paused", () => {
    const { game } = create("external-opponent", "human");
    start(game);
    game.pause(now(1));
    const prior = game.getSession();
    expect(game.requestOpponentMove({ requestId: parseRequestId("paused") })).toMatchObject({
      reason: "already-paused",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects opponent failure while awaiting state is paused", () => {
    const { game } = create("external-opponent", "human");
    start(game);
    game.requestOpponentMove({ requestId: parseRequestId("paused-failure") });
    game.pause(now(1));
    const prior = game.getSession();
    expect(
      game.rejectOpponentRequest({
        reason: "unavailable",
        requestId: parseRequestId("paused-failure"),
      }),
    ).toMatchObject({ reason: "already-paused", session: prior, status: "rejected" });
  });

  it("rejects repeated pause with exact prior state", () => {
    const { game } = create();
    start(game);
    const prior = game.pause(now(1)).session;
    expect(game.pause(now(2))).toMatchObject({
      reason: "already-paused",
      session: prior,
      status: "rejected",
    });
  });

  it.each(["pause", "resume", "abandon"] as const)(
    "rejects timestamp regression during %s without mutation",
    (operation) => {
      const { game } = create();
      game.start(now(10));
      if (operation === "resume") {
        game.pause(now(11));
      }
      const prior = game.getSession();
      const result =
        operation === "pause"
          ? game.pause(now(9))
          : operation === "resume"
            ? game.resume(now(10))
            : game.abandon({ now: now(9) });
      expect(result).toMatchObject({
        reason: "timestamp-regression",
        session: prior,
        status: "rejected",
      });
    },
  );

  it("adjudicates expiration while abandoning a degraded session", () => {
    const rules = new ChessJsRulesAdapter();
    const game = createGameController({
      configuration: {
        allowUndo: false,
        gameId: "degraded-timeout",
        initialPosition: { kind: "standard" },
        participants: {
          black: { kind: "human" },
          white: { kind: "external-opponent" },
        },
        timeControl: { initialMs: 1_000, kind: "sudden-death" },
      },
      rules,
    });
    start(game);
    game.requestOpponentMove({ requestId: parseRequestId("will-fail") });
    game.rejectOpponentRequest({
      reason: "unavailable",
      requestId: parseRequestId("will-fail"),
    });
    const result = game.abandon({ now: now(1_000) });
    expect(result).toMatchObject({
      result: { loser: "white", reason: "timeout", winner: "black" },
      status: "completed",
    });
    expect(result.session.lifecycle.phase).toBe("completed");
  });

  it("rejects ordinary controller commands on an initially completed game", () => {
    const rules = new ChessJsRulesAdapter();
    const game = createGameController({
      configuration: {
        allowUndo: false,
        gameId: "initial-terminal",
        initialPosition: { fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", kind: "fen" },
        participants: { black: { kind: "external-opponent" }, white: { kind: "human" } },
        timeControl: { kind: "untimed" },
      },
      rules,
    });
    const prior = game.getSession();
    expect(game.requestOpponentMove({ requestId: parseRequestId("terminal") })).toMatchObject({
      reason: "already-completed",
      session: prior,
      status: "rejected",
    });
    expect(
      game.rejectOpponentRequest({
        reason: "unavailable",
        requestId: parseRequestId("terminal"),
      }),
    ).toMatchObject({ reason: "already-completed", session: prior, status: "rejected" });
    expect(game.pause(now(0))).toMatchObject({
      reason: "already-completed",
      session: prior,
      status: "rejected",
    });
    expect(game.resume(now(0))).toMatchObject({
      reason: "already-completed",
      session: prior,
      status: "rejected",
    });
  });
});
