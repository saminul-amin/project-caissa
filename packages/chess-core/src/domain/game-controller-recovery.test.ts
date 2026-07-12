import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci, type ChessRulesPort } from "./chess-rules";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { createGameController, type GameController } from "./game-controller";
import type { GameSession, OpponentMoveProposal } from "./game-session";
import {
  parseRequestId,
  parseSessionRevision,
  parseUndoPlyCount,
  type UndoPlyCount,
} from "./primitives";

type Participant = "external-opponent" | "human";

function configuration(
  options: {
    readonly allowUndo?: boolean;
    readonly black?: Participant;
    readonly initialPosition?: Readonly<Record<string, unknown>>;
    readonly timeControl?: Readonly<Record<string, unknown>>;
    readonly white?: Participant;
  } = {},
) {
  return {
    allowUndo: options.allowUndo ?? true,
    gameId: "recovery-test",
    initialPosition: options.initialPosition ?? { kind: "standard" },
    participants: {
      black: { kind: options.black ?? "human" },
      white: { kind: options.white ?? "human" },
    },
    timeControl: options.timeControl ?? { kind: "untimed" },
  };
}

function create(
  options: Parameters<typeof configuration>[0] = {},
  rules: ChessRulesPort = new ChessJsRulesAdapter(),
): { readonly game: GameController; readonly rules: ChessRulesPort } {
  return {
    game: createGameController({ configuration: configuration(options), rules }),
    rules,
  };
}

function now(value: number) {
  return parseMonotonicTimestampMs(value);
}

function start(game: GameController, value = 0): GameSession {
  const result = game.start(now(value));
  expect(result.status).toBe("applied");
  return result.session;
}

function move(game: GameController, uci: string, value = 0) {
  return game.submitHumanMove({ move: moveInputFromUci(uci), now: now(value) });
}

function request(game: GameController, requestId = "recovery-request") {
  return game.requestOpponentMove({ requestId: parseRequestId(requestId) });
}

function proposal(session: GameSession, uci: string): OpponentMoveProposal {
  const activeRequest = session.activeOpponentRequest;
  if (!activeRequest) throw new Error("Expected an active opponent request fixture.");
  return { ...activeRequest, move: moveInputFromUci(uci) };
}

function playFoolsMate(game: GameController) {
  start(game);
  move(game, "f2f3");
  move(game, "e7e5");
  move(game, "g2g4");
  return move(game, "d8h4");
}

describe("bounded practice undo", () => {
  it("undoes one ply in a human-versus-human game", () => {
    const { game } = create();
    start(game);
    const committed = move(game, "e2e4").session;
    const result = game.undoMoves({ now: now(100), plies: parseUndoPlyCount(1) });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.removedMoves).toEqual([committed.history[0]]);
    expect(result.session).toMatchObject({
      history: [],
      lifecycle: { phase: "player-turn" },
      position: { ply: 0, turn: "white" },
      result: undefined,
    });
  });

  it("atomically undoes two plies in a human-versus-external practice game", () => {
    const { game } = create({ black: "external-opponent" });
    start(game);
    move(game, "e2e4");
    const requested = request(game).session;
    game.commitOpponentMove(proposal(requested, "e7e5"), now(0));
    const prior = game.getSession();

    const result = game.undoMoves({ now: now(500), plies: parseUndoPlyCount(2) });

    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.removedMoves.map((record) => record.uci)).toEqual(["e2e4", "e7e5"]);
    expect(result.session.history).toEqual([]);
    expect(result.session.position.turn).toBe("white");
    expect(result.session.lifecycle.phase).toBe("player-turn");
    expect(result.session.revision).toBe(prior.revision + 1);
  });

  it("rejects undo when configuration disables it", () => {
    const { game } = create({ allowUndo: false });
    start(game);
    move(game, "e2e4");
    const prior = game.getSession();
    expect(game.undoMoves({ now: now(0), plies: parseUndoPlyCount(1) })).toMatchObject({
      events: [],
      reason: "undo-disabled",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects insufficient history without changing revision", () => {
    const { game } = create();
    const prior = start(game);
    const result = game.undoMoves({ now: now(0), plies: parseUndoPlyCount(1) });
    expect(result).toMatchObject({
      reason: "insufficient-history",
      session: prior,
      status: "rejected",
    });
    expect(result.session.revision).toBe(prior.revision);
  });

  it("rejects a runtime-invalid public undo count", () => {
    const { game } = create();
    start(game);
    move(game, "e2e4");
    const prior = game.getSession();
    expect(game.undoMoves({ now: now(0), plies: 3 as UndoPlyCount })).toMatchObject({
      reason: "invalid-undo-count",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects a stale expected revision", () => {
    const { game } = create();
    start(game);
    move(game, "e2e4");
    const prior = game.getSession();
    expect(
      game.undoMoves({
        expectedRevision: parseSessionRevision(0),
        now: now(0),
        plies: parseUndoPlyCount(1),
      }),
    ).toMatchObject({ reason: "stale-revision", session: prior, status: "rejected" });
  });

  it("rejects undo while paused under the explicit Version 1 policy", () => {
    const { game } = create();
    start(game);
    move(game, "e2e4");
    game.pause(now(10));
    const prior = game.getSession();
    expect(game.undoMoves({ now: now(20), plies: parseUndoPlyCount(1) })).toMatchObject({
      reason: "game-paused",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects undo after abandonment", () => {
    const { game } = create();
    start(game);
    move(game, "e2e4");
    game.abandon({ now: now(0) });
    const prior = game.getSession();
    expect(game.undoMoves({ now: now(0), plies: parseUndoPlyCount(1) })).toMatchObject({
      reason: "game-abandoned",
      session: prior,
      status: "rejected",
    });
  });

  it("clears an awaiting request, emits cancellation, and rejects its old proposal", () => {
    const { game } = create({ black: "external-opponent" });
    start(game);
    move(game, "e2e4");
    const awaiting = request(game, "cancel-on-undo").session;
    const oldProposal = proposal(awaiting, "e7e5");

    const undone = game.undoMoves({ now: now(50), plies: parseUndoPlyCount(1) });

    expect(undone.status).toBe("applied");
    expect(undone.session.activeOpponentRequest).toBeUndefined();
    expect(undone.events.map((event) => event.type)).toEqual([
      "opponent-request-cancelled",
      "moves-undone",
    ]);
    expect(game.commitOpponentMove(oldProposal, now(50))).toMatchObject({
      reason: "invalid-lifecycle",
      session: undone.session,
      status: "rejected",
    });
  });

  it("undoes from degraded mode without generating a replacement move", () => {
    const { game } = create({ black: "external-opponent" });
    start(game);
    move(game, "e2e4");
    request(game);
    game.rejectOpponentRequest({
      reason: "unavailable",
      requestId: parseRequestId("recovery-request"),
    });
    const result = game.undoMoves({ now: now(0), plies: parseUndoPlyCount(1) });
    expect(result.status).toBe("applied");
    expect(result.session).toMatchObject({
      activeOpponentRequest: undefined,
      history: [],
      lifecycle: { phase: "player-turn" },
    });
  });

  it("reopens checkmate and clears the final result", () => {
    const { game } = create();
    const completed = playFoolsMate(game);
    expect(completed.status).toBe("completed");

    const result = game.undoMoves({ now: now(1), plies: parseUndoPlyCount(1) });

    expect(result.status).toBe("applied");
    expect(result.session.lifecycle.phase).toBe("player-turn");
    expect(result.session.position.turn).toBe("black");
    expect(result.session.result).toBeUndefined();
    expect(result.events.map((event) => event.type)).toEqual(["moves-undone", "game-reopened"]);
  });

  it.each([
    ["stalemate", "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1", "f5f7"],
    ["insufficient material", "4k3/8/8/8/8/8/4r3/4K3 w - - 0 1", "e1e2"],
    ["fifty-move rule", "4k3/8/8/8/8/8/8/4K2R w - - 99 51", "h1h2"],
  ] as const)("reopens a game completed by %s", (_label, fen, uci) => {
    const { game } = create({ initialPosition: { fen, kind: "fen" } });
    start(game);
    expect(move(game, uci).status).toBe("completed");
    const result = game.undoMoves({ now: now(7), plies: parseUndoPlyCount(1) });
    expect(result.status).toBe("applied");
    expect(result.session.position.fen).toBe(fen);
    expect(result.session.result).toBeUndefined();
  });

  it("reopens a threefold-repetition draw", () => {
    const { game } = create();
    start(game);
    for (const uci of ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]) {
      move(game, uci);
    }
    expect(game.getSession().result).toMatchObject({ reason: "threefold-repetition" });
    const result = game.undoMoves({ now: now(10), plies: parseUndoPlyCount(1) });
    expect(result.status).toBe("applied");
    expect(result.session.position.terminalState.status).toBe("ongoing");
  });

  it("undoes a timeout with committed history", () => {
    const { game } = create({ timeControl: { initialMs: 1_000, kind: "sudden-death" } });
    start(game, 0);
    move(game, "e2e4", 0);
    expect(move(game, "e7e5", 1_000).status).toBe("completed");

    const result = game.undoMoves({ now: now(5_000), plies: parseUndoPlyCount(1) });

    expect(result.status).toBe("applied");
    expect(result.session).toMatchObject({
      clock: { activeColor: "white", lastTimestampMs: 5_000, status: "running" },
      history: [],
      lifecycle: { phase: "player-turn" },
      result: undefined,
    });
  });

  it("cannot undo a timeout that recorded no move", () => {
    const { game } = create({ timeControl: { initialMs: 1_000, kind: "sudden-death" } });
    start(game);
    move(game, "e2e4", 1_000);
    const prior = game.getSession();
    expect(game.undoMoves({ now: now(2_000), plies: parseUndoPlyCount(1) })).toMatchObject({
      reason: "insufficient-history",
      session: prior,
      status: "rejected",
    });
  });

  it("restores exact historical balances and rebases without charging later time", () => {
    const { game } = create({ timeControl: { initialMs: 10_000, kind: "sudden-death" } });
    start(game, 0);
    move(game, "e2e4", 3_000);
    const second = move(game, "e7e5", 5_000);
    expect(second.session.history[1]?.clockBefore).toMatchObject({
      remaining: { black: 8_000, white: 7_000 },
    });

    const result = game.undoMoves({ now: now(100_000), plies: parseUndoPlyCount(1) });

    expect(result.session.clock).toMatchObject({
      activeColor: "black",
      lastTimestampMs: 100_000,
      remaining: { black: 8_000, white: 7_000 },
      status: "running",
    });
  });

  it("increments revision once and freezes removed records and events", () => {
    const { game } = create();
    start(game);
    move(game, "e2e4");
    move(game, "e7e5");
    const prior = game.getSession();
    const result = game.undoMoves({ now: now(1), plies: parseUndoPlyCount(2) });
    expect(result.status).toBe("applied");
    if (result.status !== "applied") return;
    expect(result.session.revision).toBe(prior.revision + 1);
    expect(Object.isFrozen(result.removedMoves)).toBe(true);
    expect(Object.isFrozen(result.events)).toBe(true);
    expect(Object.isFrozen(result.events[0])).toBe(true);
  });

  it("returns a typed atomic rejection when target reconstruction fails", () => {
    const base = new ChessJsRulesAdapter();
    let resets = 0;
    const rules = delegatedRules(base, () => {
      resets += 1;
      if (resets === 2) throw new Error("target reset failed");
      return base.createInitialPosition();
    });
    const { game } = create({}, rules);
    start(game);
    move(game, "e2e4");
    const prior = game.getSession();
    const fen = base.getFen();

    const result = game.undoMoves({ now: now(0), plies: parseUndoPlyCount(1) });

    expect(result).toMatchObject({
      reason: "internal-restoration-failure",
      session: prior,
      status: "rejected",
    });
    expect(game.getSession()).toBe(prior);
    expect(base.getFen()).toBe(fen);
  });
});

describe("explicit same-game restart", () => {
  it("restarts an active game to a fresh ready session", () => {
    const { game } = create({ timeControl: { initialMs: 5_000, kind: "sudden-death" } });
    start(game, 10);
    move(game, "e2e4", 20);
    const prior = game.getSession();

    const result = game.restart({ expectedRevision: prior.revision });

    expect(result.status).toBe("applied");
    expect(result.session).toMatchObject({
      activeOpponentRequest: undefined,
      clock: { lastTimestampMs: undefined, status: "idle" },
      gameId: prior.gameId,
      history: [],
      lifecycle: { phase: "ready" },
      result: undefined,
      revision: prior.revision + 1,
    });
    expect(result.session.configuration).toEqual(prior.configuration);
    expect(result.events).toMatchObject([{ type: "game-restarted" }]);
  });

  it.each(["paused", "awaiting", "degraded", "completed", "abandoned"] as const)(
    "restarts a %s game",
    (state) => {
      const { game } = create({ black: "external-opponent" });
      start(game);
      move(game, "e2e4");
      if (state === "paused") game.pause(now(1));
      if (state === "awaiting" || state === "degraded") request(game);
      if (state === "degraded") {
        game.rejectOpponentRequest({
          reason: "unavailable",
          requestId: parseRequestId("recovery-request"),
        });
      }
      if (state === "completed") {
        game.restart({});
        const humanGame = create().game;
        playFoolsMate(humanGame);
        expect(humanGame.restart({}).session.lifecycle.phase).toBe("ready");
        return;
      }
      if (state === "abandoned") game.abandon({ now: now(1) });

      expect(game.restart({}).session).toMatchObject({
        activeOpponentRequest: undefined,
        history: [],
        lifecycle: { phase: "ready" },
        result: undefined,
      });
    },
  );

  it("restores the configured custom FEN at session-relative ply zero", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 20";
    const { game } = create({ initialPosition: { fen, kind: "fen" } });
    start(game);
    move(game, "e2e4");
    const result = game.restart({});
    expect(result.session.position).toMatchObject({ fen, ply: 0, turn: "white" });
  });

  it("rejects a pristine ready restart under the documented policy", () => {
    const { game } = create();
    const prior = game.getSession();
    expect(game.restart({})).toMatchObject({
      events: [],
      reason: "already-reset",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects stale restart revision without mutation", () => {
    const { game } = create();
    start(game);
    const prior = game.getSession();
    expect(game.restart({ expectedRevision: parseSessionRevision(0) })).toMatchObject({
      reason: "stale-revision",
      session: prior,
      status: "rejected",
    });
  });

  it("invalidates an old opponent proposal and does not start automatically", () => {
    const { game } = create({ black: "external-opponent" });
    start(game);
    move(game, "e2e4");
    const awaiting = request(game).session;
    const oldProposal = proposal(awaiting, "e7e5");
    const restarted = game.restart({});
    expect(restarted.session.clock.status).toBe("untimed");
    expect(restarted.session.lifecycle.phase).toBe("ready");
    expect(game.commitOpponentMove(oldProposal, now(0))).toMatchObject({
      reason: "invalid-lifecycle",
      session: restarted.session,
      status: "rejected",
    });
  });

  it("preserves the exact prior authority when rules reset fails", () => {
    const base = new ChessJsRulesAdapter();
    let resets = 0;
    const rules = delegatedRules(base, () => {
      resets += 1;
      if (resets === 2) throw new Error("restart reset failed");
      return base.createInitialPosition();
    });
    const { game } = create({}, rules);
    start(game);
    move(game, "e2e4");
    const prior = game.getSession();
    const fen = base.getFen();
    expect(game.restart({})).toMatchObject({
      reason: "internal-restoration-failure",
      session: prior,
      status: "rejected",
    });
    expect(base.getFen()).toBe(fen);
  });
});

function delegatedRules(
  base: ChessJsRulesAdapter,
  createInitialPosition: ChessRulesPort["createInitialPosition"],
): ChessRulesPort {
  return {
    attemptMove: base.attemptMove.bind(base),
    createInitialPosition,
    exportPgn: base.exportPgn.bind(base),
    getFen: base.getFen.bind(base),
    getLegalMoves: base.getLegalMoves.bind(base),
    getTerminalState: base.getTerminalState.bind(base),
    getTurn: base.getTurn.bind(base),
    isCheck: base.isCheck.bind(base),
    loadFen: base.loadFen.bind(base),
    loadPgn: base.loadPgn.bind(base),
    undo: base.undo.bind(base),
  };
}
