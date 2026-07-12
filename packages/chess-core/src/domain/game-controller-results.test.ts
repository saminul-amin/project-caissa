import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci, type ChessRulesPort } from "./chess-rules";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { createGameController, type GameController } from "./game-controller";
import { parseFen, parsePly, parseRequestId, parseSessionRevision } from "./primitives";

function create(
  initialPosition: Readonly<Record<string, unknown>> = { kind: "standard" },
  timeControl: Readonly<Record<string, unknown>> = { kind: "untimed" },
): GameController {
  return createGameController({
    configuration: {
      allowUndo: false,
      gameId: "terminal-test",
      initialPosition,
      participants: { black: { kind: "human" }, white: { kind: "human" } },
      timeControl,
    },
    rules: new ChessJsRulesAdapter(),
  });
}

function at(value: number) {
  return parseMonotonicTimestampMs(value);
}

function play(game: GameController, ...moves: readonly string[]) {
  let result = game.start(at(0));
  for (const move of moves) {
    result = game.submitHumanMove({ move: moveInputFromUci(move), now: at(0) });
  }
  return result;
}

describe("authoritative chess terminal adjudication", () => {
  it("completes checkmate after the committing move with the correct winner", () => {
    const game = create();
    const result = play(game, "f2f3", "e7e5", "g2g4", "d8h4");
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.result).toEqual({
      isDraw: false,
      loser: "white",
      pgnResult: "0-1",
      reason: "checkmate",
      status: "decisive",
      winner: "black",
    });
    expect(result.session.position.terminalState.status).toBe("checkmate");
    expect(result.session.history.at(-1)).toMatchObject({
      givesCheck: true,
      givesCheckmate: true,
      san: "Qh4#",
    });
    expect(result.events.map((event) => event.type)).toEqual(["move-committed", "game-completed"]);
  });

  it.each([
    ["stalemate", "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", "stalemate"],
    ["insufficient material", "4k3/8/8/8/8/8/8/4K3 w - - 0 1", "insufficient-material"],
    ["fifty-move rule", "4k3/8/8/8/8/8/8/4K2R w - - 100 51", "fifty-move-rule"],
  ] as const)("creates a completed draw session for %s", (_label, fen, reason) => {
    const game = create({ fen, kind: "fen" });
    const session = game.getSession();
    expect(session.lifecycle.phase).toBe("completed");
    expect(session.result).toEqual({ isDraw: true, pgnResult: "1/2-1/2", reason, status: "draw" });
    expect(session.position.ply).toBe(0);
  });

  it("detects threefold repetition after an authoritative legal sequence", () => {
    const game = create();
    const result = play(game, "g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8");
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.result).toEqual({
      isDraw: true,
      pgnResult: "1/2-1/2",
      reason: "threefold-repetition",
      status: "draw",
    });
    expect(result.session.history).toHaveLength(8);
  });

  it("stops a timed clock when chess completes", () => {
    const game = create({ kind: "standard" }, { initialMs: 30_000, kind: "sudden-death" });
    const result = play(game, "f2f3", "e7e5", "g2g4", "d8h4");
    expect(result.session.clock.status).toBe("stopped");
  });

  it("rejects play after a completed lifecycle with the exact terminal session", () => {
    const game = create({ fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", kind: "fen" });
    const prior = game.getSession();
    const result = game.submitHumanMove({ move: moveInputFromUci("h8h7"), now: at(0) });
    expect(result).toMatchObject({
      reason: "already-completed",
      session: prior,
      status: "rejected",
    });
    expect(game.start(at(0))).toMatchObject({
      reason: "already-completed",
      session: prior,
      status: "rejected",
    });
  });

  it("rejects an external proposal after completion", () => {
    const game = create({ fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", kind: "fen" });
    const prior = game.getSession();
    const result = game.commitOpponentMove(
      {
        expectedFen: prior.position.fen,
        expectedPly: parsePly(0),
        expectedRevision: parseSessionRevision(0),
        move: moveInputFromUci("h8h7"),
        requestId: parseRequestId("terminal-request"),
        requestedColor: "black",
      },
      at(0),
    );
    expect(result).toMatchObject({
      reason: "already-completed",
      session: prior,
      status: "rejected",
    });
  });

  it("keeps completed sessions consistent: result, terminal lifecycle, FEN, and history", () => {
    const game = create();
    const result = play(game, "f2f3", "e7e5", "g2g4", "d8h4");
    expect(result.session.result).toBeDefined();
    expect(result.session.lifecycle.phase).toBe("completed");
    expect(result.session.position.fen).toBe(result.session.history.at(-1)?.fenAfter);
    expect(result.session.position.ply).toBe(result.session.history.length);
  });

  it("uses the documented deterministic v1 timeout policy", () => {
    const game = create({ kind: "standard" }, { initialMs: 1, kind: "sudden-death" });
    game.start(at(0));
    const result = game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: at(1) });
    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.result).toMatchObject({
      loser: "white",
      pgnResult: "0-1",
      reason: "timeout",
      winner: "black",
    });
    expect(result.session.position.fen).toBe(
      parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    );
  });

  it("adjudicates a position that becomes externally terminal before another move attempt", () => {
    const rules = new ChessJsRulesAdapter();
    let reportTerminal = false;
    const controlledRules: ChessRulesPort = {
      attemptMove: rules.attemptMove.bind(rules),
      createInitialPosition: rules.createInitialPosition.bind(rules),
      exportPgn: rules.exportPgn.bind(rules),
      getFen: rules.getFen.bind(rules),
      getLegalMoves: rules.getLegalMoves.bind(rules),
      getTerminalState: () =>
        reportTerminal ? { reason: "stalemate", status: "draw" } : rules.getTerminalState(),
      getTurn: rules.getTurn.bind(rules),
      isCheck: rules.isCheck.bind(rules),
      loadFen: rules.loadFen.bind(rules),
      loadPgn: rules.loadPgn.bind(rules),
      undo: rules.undo.bind(rules),
    };
    const game = createGameController({
      configuration: {
        allowUndo: false,
        gameId: "preexisting-terminal",
        initialPosition: { kind: "standard" },
        participants: { black: { kind: "human" }, white: { kind: "human" } },
        timeControl: { kind: "untimed" },
      },
      rules: controlledRules,
    });
    game.start(at(0));
    reportTerminal = true;
    const result = game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: at(0) });
    expect(result).toMatchObject({
      move: undefined,
      result: { reason: "stalemate", status: "draw" },
      status: "completed",
    });
    expect(rules.getFen()).toBe(
      parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    );
  });
});
