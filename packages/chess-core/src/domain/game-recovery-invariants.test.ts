import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci } from "./chess-rules";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { createGameController } from "./game-controller";
import { restoreGameController } from "./game-restoration";
import { parseRequestId, parseSessionRevision, parseUndoPlyCount } from "./primitives";

function create(black: "external-opponent" | "human" = "human") {
  return createGameController({
    configuration: {
      allowUndo: true,
      gameId: "recovery-invariant",
      initialPosition: { kind: "standard" },
      participants: { black: { kind: black }, white: { kind: "human" } },
      timeControl: { initialMs: 60_000, kind: "sudden-death" },
    },
    rules: new ChessJsRulesAdapter(),
  });
}

function now(value: number) {
  return parseMonotonicTimestampMs(value);
}

function restore(checkpoint: unknown) {
  const result = restoreGameController({
    checkpoint,
    createRules: () => new ChessJsRulesAdapter(),
  });
  if (result.status !== "restored") throw new Error(result.reason);
  return result.controller;
}

describe("recoverable-domain sequence invariants", () => {
  it("undo followed by replay reproduces the same final FEN", () => {
    const game = create();
    game.start(now(0));
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(1_000) });
    const originalFen = game.getSession().position.fen;
    game.undoMoves({ now: now(10_000), plies: parseUndoPlyCount(1) });
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(10_000) });
    expect(game.getSession().position.fen).toBe(originalFen);
  });

  it("two-ply undo and replay reproduce continuous history", () => {
    const game = create();
    game.start(now(0));
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(1) });
    game.submitHumanMove({ move: moveInputFromUci("e7e5"), now: now(2) });
    const expectedFen = game.getSession().position.fen;
    game.undoMoves({ now: now(10), plies: parseUndoPlyCount(2) });
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(10) });
    game.submitHumanMove({ move: moveInputFromUci("e7e5"), now: now(10) });
    const session = game.getSession();
    expect(session.history.map((record) => record.ply)).toEqual([1, 2]);
    expect(session.history[0]?.fenAfter).toBe(session.history[1]?.fenBefore);
    expect(session.position.fen).toBe(expectedFen);
  });

  it("restart always returns to the configured initial position", () => {
    const game = create();
    const initial = game.getSession().position.fen;
    game.start(now(0));
    for (const uci of ["e2e4", "e7e5", "g1f3", "b8c6"]) {
      game.submitHumanMove({ move: moveInputFromUci(uci), now: now(0) });
    }
    expect(game.restart({}).session.position.fen).toBe(initial);
  });

  it("revision never decreases and changes once per applied recovery command", () => {
    const game = create();
    const revisions = [game.getSession().revision];
    revisions.push(game.start(now(0)).session.revision);
    revisions.push(
      game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) }).session.revision,
    );
    const beforeUndo = game.getSession().revision;
    revisions.push(game.undoMoves({ now: now(1), plies: parseUndoPlyCount(1) }).session.revision);
    const rejected = game.undoMoves({ now: now(1), plies: parseUndoPlyCount(1) });
    revisions.push(rejected.session.revision);
    const restarted = game.restart({});
    revisions.push(restarted.session.revision);
    expect(revisions).toEqual([...revisions].sort((left, right) => left - right));
    expect(revisions[3]).toBe(beforeUndo + 1);
    expect(rejected.status).toBe("rejected");
  });

  it("reconstruction preserves revision and final history/position continuity", () => {
    const game = create();
    game.start(now(0));
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) });
    const checkpoint = game.exportCheckpoint();
    const restored = restore(checkpoint).getSession();
    expect(restored.revision).toBe(checkpoint.revision);
    expect(restored.history.at(-1)?.fenAfter).toBe(restored.position.fen);
    expect(restored.clock).toMatchObject({
      activeColor: restored.position.turn,
      status: "running",
    });
  });

  it("restores a valid move history that includes pause and resume between moves", () => {
    const game = create();
    game.start(now(0));
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(1_000) });
    game.pause(now(2_000));
    game.resume(now(20_000));
    game.submitHumanMove({ move: moveInputFromUci("e7e5"), now: now(21_000) });
    expect(restore(game.exportCheckpoint()).getSession().history).toHaveLength(2);
  });

  it("restored pending request matches every captured authority value", () => {
    const game = create("external-opponent");
    game.start(now(0));
    game.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) });
    game.requestOpponentMove({ requestId: parseRequestId("invariant-request") });
    const restored = restore(game.exportCheckpoint()).getSession();
    expect(restored.activeOpponentRequest).toEqual({
      expectedFen: restored.position.fen,
      expectedPly: restored.position.ply,
      expectedRevision: parseSessionRevision(restored.revision - 1),
      requestId: parseRequestId("invariant-request"),
      requestedColor: restored.position.turn,
    });
  });
});
