import { describe, expect, it } from "vitest";

import { ChessJsRulesAdapter } from "../adapters/chess-js-rules-adapter";
import { moveInputFromUci } from "./chess-rules";
import { parseMonotonicTimestampMs } from "./clock-primitives";
import { createGameController, type GameController } from "./game-controller";
import type { GameSessionCheckpoint } from "./game-checkpoint";
import {
  restoreGameController,
  type GameControllerRestorationResult,
  type GameRestorationRejectionReason,
} from "./game-restoration";
import type { GameSession } from "./game-session";
import { parseRequestId, parseUndoPlyCount } from "./primitives";

type Participant = "external-opponent" | "human";

function create(
  options: {
    readonly black?: Participant;
    readonly initialPosition?: Readonly<Record<string, unknown>>;
    readonly timeControl?: Readonly<Record<string, unknown>>;
    readonly white?: Participant;
  } = {},
): GameController {
  return createGameController({
    configuration: {
      allowUndo: true,
      gameId: "restoration-test",
      initialPosition: options.initialPosition ?? { kind: "standard" },
      participants: {
        black: { kind: options.black ?? "human" },
        white: { kind: options.white ?? "human" },
      },
      timeControl: options.timeControl ?? { kind: "untimed" },
    },
    rules: new ChessJsRulesAdapter(),
  });
}

function now(value: number) {
  return parseMonotonicTimestampMs(value);
}

function start(game: GameController, value = 0): void {
  expect(game.start(now(value)).status).toBe("applied");
}

function move(game: GameController, uci: string, value = 0): void {
  expect(game.submitHumanMove({ move: moveInputFromUci(uci), now: now(value) }).status).not.toBe(
    "rejected",
  );
}

function restore(checkpoint: unknown): GameControllerRestorationResult {
  return restoreGameController({ checkpoint, createRules: () => new ChessJsRulesAdapter() });
}

function restored(checkpoint: unknown): { controller: GameController; session: GameSession } {
  const result = restore(checkpoint);
  expect(result.status).toBe("restored");
  if (result.status !== "restored") throw new Error(`Restoration rejected: ${result.reason}`);
  return result;
}

function expectRejected(checkpoint: unknown, reason: GameRestorationRejectionReason): void {
  const result = restore(checkpoint);
  expect(result).toEqual({ reason, status: "rejected" });
  expect("controller" in result).toBe(false);
}

function activeCheckpoint(): GameSessionCheckpoint {
  const game = create({
    timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
  });
  start(game, 100);
  move(game, "e2e4", 1_100);
  return game.exportCheckpoint();
}

function withFirstMove(
  checkpoint: GameSessionCheckpoint,
  patch: Readonly<Record<string, unknown>>,
): unknown {
  const first = checkpoint.history[0];
  if (!first) throw new Error("Expected a move-record fixture.");
  return { ...checkpoint, history: [{ ...first, ...patch }, ...checkpoint.history.slice(1)] };
}

describe("replay-based controller reconstruction", () => {
  it("restores a ready session without incrementing revision", () => {
    const checkpoint = create().exportCheckpoint();
    const result = restored(checkpoint);
    expect(result.session).toEqual(checkpointWithoutVersion(checkpoint));
    expect(result.session.revision).toBe(checkpoint.revision);
    expect(result.session.lifecycle.phase).toBe("ready");
  });

  it("restores an active timed session and continues legal play", () => {
    const checkpoint = activeCheckpoint();
    const { controller, session } = restored(checkpoint);
    expect(session).toEqual(checkpointWithoutVersion(checkpoint));
    const result = controller.submitHumanMove({ move: moveInputFromUci("e7e5"), now: now(2_100) });
    expect(result.status).toBe("applied");
    expect(result.session.history).toHaveLength(2);
    expect(result.session.revision).toBe(checkpoint.revision + 1);
  });

  it("restores awaiting-opponent state and preserves proposal validation", () => {
    const game = create({ black: "external-opponent" });
    start(game);
    move(game, "e2e4");
    const requested = game.requestOpponentMove({ requestId: parseRequestId("restored-request") });
    expect(requested.status).toBe("applied");
    if (requested.status !== "applied") return;
    const checkpoint = game.exportCheckpoint();
    const { controller, session } = restored(checkpoint);
    expect(session.activeOpponentRequest).toEqual(checkpoint.activeOpponentRequest);

    const stale = {
      ...requested.request,
      move: moveInputFromUci("e7e5"),
      requestId: parseRequestId("wrong-request"),
    };
    expect(controller.commitOpponentMove(stale, now(0))).toMatchObject({
      reason: "request-id-mismatch",
      session,
      status: "rejected",
    });
    expect(
      controller.commitOpponentMove(
        { ...requested.request, move: moveInputFromUci("e7e5") },
        now(0),
      ).status,
    ).toBe("applied");
  });

  it("restores paused state and resumes without charging paused duration", () => {
    const game = create({ timeControl: { initialMs: 10_000, kind: "sudden-death" } });
    start(game, 0);
    game.pause(now(3_000));
    const checkpoint = game.exportCheckpoint();
    const { controller } = restored(checkpoint);
    const resumed = controller.resume(now(50_000));
    expect(resumed.status).toBe("applied");
    expect(resumed.session.clock).toMatchObject({
      activeColor: "white",
      lastTimestampMs: 50_000,
      remaining: { white: 7_000 },
      status: "running",
    });
  });

  it("restores completed checkmate and keeps it terminal", () => {
    const game = create();
    start(game);
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) move(game, uci);
    const checkpoint = game.exportCheckpoint();
    const { controller, session } = restored(checkpoint);
    expect(session.result).toMatchObject({ reason: "checkmate", winner: "black" });
    expect(
      controller.submitHumanMove({ move: moveInputFromUci("e2e4"), now: now(0) }),
    ).toMatchObject({ reason: "already-completed", session, status: "rejected" });
  });

  it("restores a completed repetition draw", () => {
    const game = create();
    start(game);
    for (const uci of ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"]) {
      move(game, uci);
    }
    expect(restored(game.exportCheckpoint()).session.result).toMatchObject({
      reason: "threefold-repetition",
      status: "draw",
    });
  });

  it("restores timeout completion with its expired clock", () => {
    const game = create({ timeControl: { initialMs: 1_000, kind: "sudden-death" } });
    start(game);
    move(game, "e2e4", 0);
    move(game, "e7e5", 1_000);
    const session = restored(game.exportCheckpoint()).session;
    expect(session).toMatchObject({
      clock: { expiredColor: "black", remaining: { black: 0 }, status: "expired" },
      lifecycle: { phase: "completed" },
      result: { loser: "black", reason: "timeout", winner: "white" },
    });
  });

  it("restores an abandoned session", () => {
    const game = create();
    start(game);
    move(game, "e2e4");
    game.abandon({ now: now(0) });
    expect(restored(game.exportCheckpoint()).session).toMatchObject({
      lifecycle: { phase: "abandoned" },
      result: { reason: "abandoned" },
    });
  });

  it("restores a custom-FEN session by replaying from its configured position", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 20";
    const game = create({ initialPosition: { fen, kind: "fen" } });
    start(game);
    move(game, "e2e4");
    const { session } = restored(game.exportCheckpoint());
    expect(session.configuration.initialPosition).toEqual({ fen, kind: "fen" });
    expect(session.history[0]?.fenBefore).toBe(fen);
  });

  it("restores capture and promotion metadata through authoritative replay", () => {
    const game = create({
      initialPosition: { fen: "4k3/P7/8/8/8/8/1r6/4K3 w - - 0 1", kind: "fen" },
    });
    start(game);
    move(game, "a7a8q");
    const promoted = restored(game.exportCheckpoint()).session;
    expect(promoted.history[0]).toMatchObject({ promotion: "queen", san: "a8=Q+" });

    const captureGame = create({
      initialPosition: { fen: "4k3/8/8/8/8/8/4r3/4K3 w - - 0 1", kind: "fen" },
    });
    start(captureGame);
    move(captureGame, "e1e2");
    expect(restored(captureGame.exportCheckpoint()).session.history[0]).toMatchObject({
      captured: "rook",
    });
  });

  it("restored controllers retain undo and restart behavior", () => {
    const checkpoint = activeCheckpoint();
    const { controller } = restored(checkpoint);
    const undone = controller.undoMoves({ now: now(9_000), plies: parseUndoPlyCount(1) });
    expect(undone.status).toBe("applied");
    expect(undone.session.history).toEqual([]);
    expect(controller.restart({}).session.lifecycle.phase).toBe("ready");
  });

  it("re-export after reconstruction is domain-equivalent", () => {
    const checkpoint = activeCheckpoint();
    const { controller } = restored(checkpoint);
    expect(controller.exportCheckpoint()).toEqual(checkpoint);
  });

  it.each(["failed", "recovery"] as const)(
    "restores representable %s state and permits restart",
    (phase) => {
      const checkpoint = activeCheckpoint();
      const modified = {
        ...checkpoint,
        lifecycle: { failure: { code: "unexpected-failure" }, phase },
      };
      const { controller, session } = restored(modified);
      expect(session.lifecycle.phase).toBe(phase);
      expect(controller.restart({}).session.lifecycle.phase).toBe("ready");
    },
  );
});

describe("checkpoint corruption rejection", () => {
  it("rejects an unsupported checkpoint version", () => {
    expectRejected(
      { ...activeCheckpoint(), checkpointVersion: 2 },
      "unsupported-checkpoint-version",
    );
  });

  it("rejects invalid configuration", () => {
    const checkpoint = activeCheckpoint();
    expectRejected(
      { ...checkpoint, configuration: { ...checkpoint.configuration, allowUndo: "yes" } },
      "invalid-configuration",
    );
  });

  it("rejects malformed and semantically invalid initial FEN", () => {
    const checkpoint = activeCheckpoint();
    expectRejected(
      {
        ...checkpoint,
        configuration: {
          ...checkpoint.configuration,
          initialPosition: { fen: "bad-fen", kind: "fen" },
        },
      },
      "invalid-initial-position",
    );
    expectRejected(
      {
        ...checkpoint,
        configuration: {
          ...checkpoint.configuration,
          initialPosition: { fen: "8/8/8/8/8/8/8/8 w - - 0 1", kind: "fen" },
        },
      },
      "invalid-initial-position",
    );
  });

  it("rejects non-continuous ply", () => {
    expectRejected(withFirstMove(activeCheckpoint(), { ply: 2 }), "non-continuous-ply");
  });

  it("rejects an illegal replayed UCI move", () => {
    expectRejected(withFirstMove(activeCheckpoint(), { uci: "e2e5" }), "illegal-replayed-move");
  });

  it.each([
    ["modified SAN", { san: "e3" }],
    ["modified legal UCI", { uci: "d2d4" }],
    [
      "modified FEN before",
      { fenBefore: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1" },
    ],
    [
      "modified FEN after",
      { fenAfter: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" },
    ],
    ["wrong mover", { mover: "black" }],
  ])("rejects %s as a move-record mismatch", (_label, movePatch) => {
    expectRejected(withFirstMove(activeCheckpoint(), movePatch), "move-record-mismatch");
  });

  it("rejects the wrong actor kind", () => {
    expectRejected(
      withFirstMove(activeCheckpoint(), { actor: "external-opponent" }),
      "actor-mismatch",
    );
  });

  it("rejects an incorrect final position", () => {
    const checkpoint = activeCheckpoint();
    expectRejected(
      {
        ...checkpoint,
        position: {
          ...checkpoint.position,
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        },
      },
      "position-mismatch",
    );
  });

  it("rejects a broken move-clock transition and sequential clock chain", () => {
    const checkpoint = activeCheckpoint();
    const first = checkpoint.history[0];
    if (!first || first.clockAfter.status === "untimed") throw new Error("Expected timed history.");
    expectRejected(
      withFirstMove(checkpoint, {
        clockAfter: {
          ...first.clockAfter,
          remaining: { ...first.clockAfter.remaining, white: first.clockAfter.remaining.white - 1 },
        },
      }),
      "clock-history-mismatch",
    );

    const game = create({ timeControl: { initialMs: 10_000, kind: "sudden-death" } });
    start(game);
    move(game, "e2e4", 1_000);
    move(game, "e7e5", 2_000);
    const twoMoves = game.exportCheckpoint();
    const second = twoMoves.history[1];
    if (!second || second.clockBefore.status !== "running") throw new Error("Expected clock.");
    expectRejected(
      {
        ...twoMoves,
        history: [
          twoMoves.history[0],
          {
            ...second,
            clockBefore: {
              ...second.clockBefore,
              remaining: { ...second.clockBefore.remaining, white: 9_999 },
            },
          },
        ],
      },
      "clock-history-mismatch",
    );
  });

  it("rejects a final clock incompatible with lifecycle and turn", () => {
    const checkpoint = activeCheckpoint();
    expectRejected(
      {
        ...checkpoint,
        clock:
          checkpoint.clock.status === "running"
            ? { ...checkpoint.clock, activeColor: "white" }
            : checkpoint.clock,
      },
      "clock-state-mismatch",
    );
  });

  it("rejects lifecycle/participant mismatch", () => {
    expectRejected(
      { ...activeCheckpoint(), lifecycle: { phase: "opponent-turn" } },
      "lifecycle-mismatch",
    );
  });

  it("rejects result/lifecycle mismatch", () => {
    const game = create();
    start(game);
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) move(game, uci);
    const checkpoint = game.exportCheckpoint();
    expectRejected(
      {
        ...checkpoint,
        result: {
          isDraw: false,
          loser: "black",
          pgnResult: "1-0",
          reason: "timeout",
          status: "decisive",
          winner: "white",
        },
      },
      "result-mismatch",
    );
  });

  it("rejects incompatible pending request state", () => {
    const checkpoint = activeCheckpoint();
    expectRejected(
      {
        ...checkpoint,
        activeOpponentRequest: {
          expectedFen: checkpoint.position.fen,
          expectedPly: checkpoint.position.ply,
          expectedRevision: checkpoint.revision,
          requestId: "forged-request",
          requestedColor: checkpoint.position.turn,
        },
      },
      "opponent-request-mismatch",
    );
  });

  it.each([-1, 1.5, "two"])("rejects invalid revision %s", (revision) => {
    expectRejected({ ...activeCheckpoint(), revision }, "invalid-revision");
  });

  it("maps a throwing fresh-rules factory without exposing a partial controller", () => {
    const result = restoreGameController({
      checkpoint: activeCheckpoint(),
      createRules: () => {
        throw new Error("factory detail");
      },
    });
    expect(result).toEqual({ reason: "internal-restoration-failure", status: "rejected" });
    expect("controller" in result).toBe(false);
  });

  it("never mutates another active controller after restoration failure", () => {
    const active = create();
    start(active);
    move(active, "e2e4");
    const prior = active.getSession();
    expectRejected(withFirstMove(active.exportCheckpoint(), { san: "e3" }), "move-record-mismatch");
    expect(active.getSession()).toBe(prior);
    expect(active.getSession().position.fen).toBe(prior.position.fen);
  });

  const structuralCases: readonly [string, () => unknown, GameRestorationRejectionReason][] = [
    ["non-object checkpoint", () => null, "unsupported-checkpoint-version"],
    [
      "non-object configuration",
      () => ({ ...activeCheckpoint(), configuration: null }),
      "invalid-configuration",
    ],
    [
      "non-string checkpoint game ID",
      () => ({ ...activeCheckpoint(), gameId: 5 }),
      "invalid-configuration",
    ],
    [
      "mismatched checkpoint game ID",
      () => ({ ...activeCheckpoint(), gameId: "another-game" }),
      "invalid-configuration",
    ],
    ["non-array history", () => ({ ...activeCheckpoint(), history: {} }), "invalid-history"],
    [
      "non-object move record",
      () => ({ ...activeCheckpoint(), history: [null] }),
      "invalid-history",
    ],
    ["non-number ply", () => withFirstMove(activeCheckpoint(), { ply: "one" }), "invalid-history"],
    ["negative ply", () => withFirstMove(activeCheckpoint(), { ply: -1 }), "invalid-history"],
    [
      "non-string mover",
      () => withFirstMove(activeCheckpoint(), { mover: 1 }),
      "move-record-mismatch",
    ],
    [
      "invalid actor value",
      () => withFirstMove(activeCheckpoint(), { actor: "provider" }),
      "actor-mismatch",
    ],
    ["malformed UCI", () => withFirstMove(activeCheckpoint(), { uci: "e2-e4" }), "invalid-history"],
    ["malformed SAN", () => withFirstMove(activeCheckpoint(), { san: "<e4>" }), "invalid-history"],
    [
      "malformed move FEN",
      () => withFirstMove(activeCheckpoint(), { fenAfter: "bad" }),
      "invalid-history",
    ],
    [
      "invalid capture metadata",
      () => withFirstMove(activeCheckpoint(), { captured: "dragon" }),
      "move-record-mismatch",
    ],
    [
      "invalid promotion metadata",
      () => withFirstMove(activeCheckpoint(), { promotion: "king" }),
      "move-record-mismatch",
    ],
    [
      "non-boolean check metadata",
      () => withFirstMove(activeCheckpoint(), { givesCheck: "no" }),
      "invalid-history",
    ],
    [
      "missing position fields",
      () => ({ ...activeCheckpoint(), position: {} }),
      "position-mismatch",
    ],
    [
      "invalid position check value",
      () => {
        const checkpoint = activeCheckpoint();
        return { ...checkpoint, position: { ...checkpoint.position, inCheck: "no" } };
      },
      "position-mismatch",
    ],
    [
      "invalid terminal status",
      () => {
        const checkpoint = activeCheckpoint();
        return {
          ...checkpoint,
          position: { ...checkpoint.position, terminalState: { status: "unknown" } },
        };
      },
      "position-mismatch",
    ],
    [
      "invalid lifecycle phase",
      () => ({ ...activeCheckpoint(), lifecycle: { phase: "reviewing" } }),
      "lifecycle-mismatch",
    ],
    [
      "invalid paused resume phase",
      () => ({
        ...activeCheckpoint(),
        lifecycle: { phase: "paused", resumePhase: "ready" },
      }),
      "lifecycle-mismatch",
    ],
    [
      "invalid failure code",
      () => ({
        ...activeCheckpoint(),
        lifecycle: { failure: { code: "raw-error" }, phase: "failed" },
      }),
      "lifecycle-mismatch",
    ],
    [
      "clock with mismatched time control",
      () => {
        const checkpoint = activeCheckpoint();
        return { ...checkpoint, clock: { ...checkpoint.clock, timeControl: { kind: "untimed" } } };
      },
      "clock-state-mismatch",
    ],
    [
      "clock with invalid status",
      () => ({ ...activeCheckpoint(), clock: { ...activeCheckpoint().clock, status: "ticking" } }),
      "clock-state-mismatch",
    ],
    [
      "running clock without timestamp",
      () => {
        const checkpoint = activeCheckpoint();
        return { ...checkpoint, clock: { ...checkpoint.clock, lastTimestampMs: undefined } };
      },
      "clock-state-mismatch",
    ],
    [
      "clock with negative remaining time",
      () => {
        const checkpoint = activeCheckpoint();
        if (checkpoint.clock.status !== "running") return checkpoint;
        return {
          ...checkpoint,
          clock: {
            ...checkpoint.clock,
            remaining: { ...checkpoint.clock.remaining, black: -1 },
          },
        };
      },
      "clock-state-mismatch",
    ],
    [
      "unknown result status",
      () => ({ ...activeCheckpoint(), result: { status: "unknown" } }),
      "result-mismatch",
    ],
    [
      "malformed opponent request",
      () => ({
        ...activeCheckpoint(),
        activeOpponentRequest: { requestId: 4 },
        lifecycle: { phase: "awaiting-opponent" },
      }),
      "opponent-request-mismatch",
    ],
    [
      "revision lower than history length",
      () => ({ ...activeCheckpoint(), revision: 0 }),
      "invalid-revision",
    ],
    [
      "transient creating lifecycle",
      () => ({ ...create().exportCheckpoint(), lifecycle: { phase: "creating" } }),
      "lifecycle-mismatch",
    ],
    [
      "transient committing lifecycle",
      () => ({ ...activeCheckpoint(), lifecycle: { phase: "committing" } }),
      "lifecycle-mismatch",
    ],
  ];

  it.each(structuralCases)("rejects %s", (_label, createCheckpoint, reason) => {
    expectRejected(createCheckpoint(), reason);
  });

  it("rejects an invalid fresh-rules object", () => {
    const result = restoreGameController({
      checkpoint: activeCheckpoint(),
      createRules: () => ({}) as ChessJsRulesAdapter,
    });
    expect(result).toEqual({ reason: "internal-restoration-failure", status: "rejected" });
  });

  it.each([
    { isDraw: true, pgnResult: "0-1", reason: "stalemate", status: "draw" },
    {
      isDraw: false,
      loser: "white",
      pgnResult: "1-0",
      reason: "timeout",
      status: "decisive",
      winner: "white",
    },
    { isDraw: false, loser: "black", reason: "abandoned", status: "abandoned" },
  ])("rejects structurally contradictory result %#", (result) => {
    expectRejected({ ...activeCheckpoint(), result }, "result-mismatch");
  });

  it("rejects additional semantic contradictions at their stable boundaries", () => {
    const active = activeCheckpoint();
    expectRejected({ ...active, gameId: "invalid id" }, "invalid-configuration");
    expectRejected(withFirstMove(active, { captured: "pawn" }), "move-record-mismatch");
    expectRejected(withFirstMove(active, { givesCheck: true }), "move-record-mismatch");
    expectRejected(withFirstMove(active, { mover: "red" }), "move-record-mismatch");
    expectRejected(
      { ...active, position: { ...active.position, fen: "bad-fen" } },
      "position-mismatch",
    );
    expectRejected(
      {
        ...active,
        position: {
          ...active.position,
          terminalState: { reason: "agreement", status: "draw" },
        },
      },
      "position-mismatch",
    );
    expectRejected(
      {
        ...active,
        clock: { ...active.clock, lastTimestampMs: -1 },
      },
      "clock-state-mismatch",
    );
  });

  it("rejects missing, extraneous, and actor-incompatible session metadata", () => {
    const checkmateGame = create();
    start(checkmateGame);
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) move(checkmateGame, uci);
    const checkmate = checkmateGame.exportCheckpoint();
    expectRejected({ ...checkmate, result: undefined }, "result-mismatch");

    expectRejected(
      {
        ...activeCheckpoint(),
        result: { isDraw: false, reason: "abandoned", status: "abandoned" },
      },
      "result-mismatch",
    );

    const active = activeCheckpoint();
    expectRejected(
      {
        ...active,
        configuration: {
          ...active.configuration,
          participants: {
            ...active.configuration.participants,
            black: { kind: "external-opponent" },
          },
        },
        lifecycle: { phase: "player-turn" },
      },
      "lifecycle-mismatch",
    );
  });

  it("rejects lifecycle-incompatible final clocks", () => {
    const active = activeCheckpoint();
    const ready = create().exportCheckpoint();
    expectRejected({ ...ready, clock: active.clock }, "clock-state-mismatch");

    const pausedGame = create({ timeControl: { initialMs: 10_000, kind: "sudden-death" } });
    start(pausedGame);
    pausedGame.pause(now(1));
    const paused = pausedGame.exportCheckpoint();
    expectRejected({ ...paused, clock: active.clock }, "clock-state-mismatch");

    const abandonedGame = create({
      timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
    });
    start(abandonedGame, 100);
    move(abandonedGame, "e2e4", 1_100);
    const running = abandonedGame.exportCheckpoint().clock;
    abandonedGame.abandon({ now: now(2_000) });
    const abandoned = abandonedGame.exportCheckpoint();
    expectRejected({ ...abandoned, clock: running }, "clock-state-mismatch");

    expectRejected(
      {
        ...active,
        clock:
          active.clock.status === "running"
            ? { ...active.clock, activeColor: "white" }
            : active.clock,
        lifecycle: { failure: { code: "unexpected-failure" }, phase: "failed" },
      },
      "clock-state-mismatch",
    );
  });
});

function checkpointWithoutVersion(checkpoint: GameSessionCheckpoint): GameSession {
  return {
    activeOpponentRequest: checkpoint.activeOpponentRequest,
    clock: checkpoint.clock,
    configuration: checkpoint.configuration,
    gameId: checkpoint.gameId,
    history: checkpoint.history,
    lifecycle: checkpoint.lifecycle,
    position: checkpoint.position,
    result: checkpoint.result,
    revision: checkpoint.revision,
  };
}
