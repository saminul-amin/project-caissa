import { chessRulesFixtures } from "@caissa/test-fixtures/chess-rules";
import { describe, expect, it } from "vitest";

import { moveInputFromUci } from "../domain/chess-rules";
import { DomainValidationError } from "../domain/errors";
import { ChessJsRulesAdapter } from "./chess-js-rules-adapter";

describe("ChessJsRulesAdapter", () => {
  it("creates the initial position with the canonical FEN, White turn, and twenty legal moves", () => {
    const rules = new ChessJsRulesAdapter();
    const position = rules.createInitialPosition();

    expect(position).toEqual({
      fen: chessRulesFixtures.initialPosition.fen,
      turn: "white",
      inCheck: false,
      legalMoveCount: 20,
    });
    expect(rules.getTurn()).toBe("white");
  });

  it("commits legal e2e4 with its UCI and SAN values", () => {
    const rules = new ChessJsRulesAdapter();
    const result = rules.attemptMove(moveInputFromUci("e2e4"));

    expect(result.status).toBe("committed");
    if (result.status === "committed") {
      expect(result.move).toMatchObject({
        from: "e2",
        to: "e4",
        color: "white",
        piece: "pawn",
        san: "e4",
        uci: "e2e4",
      });
      expect(result.fenBefore).toBe(chessRulesFixtures.initialPosition.fen);
      expect(result.fenAfter).toBe(rules.getFen());
    }
  });

  it("rejects an illegal move without mutating the position", () => {
    const rules = new ChessJsRulesAdapter();
    const before = rules.getFen();

    expect(rules.attemptMove(moveInputFromUci("e2e5"))).toEqual({
      status: "rejected",
      reason: "illegal-move",
    });
    expect(rules.getFen()).toBe(before);
  });

  it("discovers legal moves from a requested square", () => {
    const rules = new ChessJsRulesAdapter();
    const moves = rules.getLegalMoves({ from: moveInputFromUci("e2e4").from });

    expect(moves.map((move) => move.uci)).toEqual(["e2e3", "e2e4"]);
  });

  it("commits White kingside castling", () => {
    const rules = loadFixture(chessRulesFixtures.castling.fen);
    const result = rules.attemptMove(moveInputFromUci("e1g1"));

    expect(result.status).toBe("committed");
    if (result.status === "committed") {
      expect(result.move.san).toBe("O-O");
      expect(result.move.uci).toBe("e1g1");
      expect(result.fenAfter.split(" ")[0]).toBe("r3k2r/8/8/8/8/8/8/R4RK1");
    }
  });

  it("rejects castling through check without mutating the position", () => {
    const rules = loadFixture(chessRulesFixtures.castlingThroughCheck.fen);
    const before = rules.getFen();

    expect(rules.attemptMove(moveInputFromUci("e1g1"))).toEqual({
      status: "rejected",
      reason: "illegal-move",
    });
    expect(rules.getFen()).toBe(before);
  });

  it("commits a legal en passant capture", () => {
    const rules = loadFixture(chessRulesFixtures.enPassant.fen);
    const result = rules.attemptMove(moveInputFromUci("e5d6"));

    expect(result.status).toBe("committed");
    if (result.status === "committed") {
      expect(result.move).toMatchObject({
        captured: "pawn",
        san: "exd6",
        uci: "e5d6",
      });
      expect(result.fenAfter.split(" ")[0]).toBe("4k3/8/3P4/8/8/8/8/4K3");
    }
  });

  it("rejects en passant when it would expose the moving side's king", () => {
    const rules = loadFixture(chessRulesFixtures.illegalEnPassantExposesKing.fen);
    const before = rules.getFen();

    expect(rules.attemptMove(moveInputFromUci("e5d6"))).toEqual({
      status: "rejected",
      reason: "illegal-move",
    });
    expect(rules.getFen()).toBe(before);
  });

  it("requires an explicit promotion piece", () => {
    const rules = loadFixture(chessRulesFixtures.queenPromotion.fen);

    expect(
      rules.attemptMove({
        from: moveInputFromUci("a7a8q").from,
        to: moveInputFromUci("a7a8q").to,
      }),
    ).toEqual({ status: "rejected", reason: "promotion-required" });
  });

  it("commits a queen promotion", () => {
    const rules = loadFixture(chessRulesFixtures.queenPromotion.fen);
    const result = rules.attemptMove(moveInputFromUci("a7a8q"));

    expect(result.status).toBe("committed");
    if (result.status === "committed") {
      expect(result.move).toMatchObject({ promotion: "queen", san: "a8=Q+", uci: "a7a8q" });
    }
  });

  it("commits a knight underpromotion", () => {
    const rules = loadFixture(chessRulesFixtures.knightUnderpromotion.fen);
    const result = rules.attemptMove(moveInputFromUci("a7a8n"));

    expect(result.status).toBe("committed");
    if (result.status === "committed") {
      expect(result.move).toMatchObject({ promotion: "knight", san: "a8=N", uci: "a7a8n" });
    }
  });

  it("detects check without reporting a terminal position", () => {
    const rules = loadFixture(chessRulesFixtures.check.fen);

    expect(rules.isCheck()).toBe(true);
    expect(rules.getTerminalState()).toEqual({ status: "ongoing" });
  });

  it("detects checkmate and maps the winner", () => {
    const rules = loadFixture(chessRulesFixtures.checkmate.fen);

    expect(rules.isCheck()).toBe(true);
    expect(rules.getTerminalState()).toEqual({
      status: "checkmate",
      reason: "checkmate",
      winner: "white",
      loser: "black",
    });
  });

  it("detects stalemate", () => {
    const rules = loadFixture(chessRulesFixtures.stalemate.fen);

    expect(rules.isCheck()).toBe(false);
    expect(rules.getTerminalState()).toEqual({ status: "draw", reason: "stalemate" });
  });

  it("detects insufficient material", () => {
    const rules = loadFixture(chessRulesFixtures.insufficientMaterial.fen);

    expect(rules.getTerminalState()).toEqual({
      status: "draw",
      reason: "insufficient-material",
    });
  });

  it("detects threefold repetition from maintained move history", () => {
    const rules = loadFixture(chessRulesFixtures.threefoldRepetition.fen);

    for (const move of chessRulesFixtures.threefoldRepetition.moves) {
      expect(rules.attemptMove(moveInputFromUci(move)).status).toBe("committed");
    }

    expect(rules.getTerminalState()).toEqual({
      status: "draw",
      reason: "threefold-repetition",
    });
  });

  it("detects the fifty-move rule", () => {
    const rules = loadFixture(chessRulesFixtures.fiftyMoveRule.fen);

    expect(rules.getTerminalState()).toEqual({
      status: "draw",
      reason: "fifty-move-rule",
    });
  });

  it("undo restores the exact previous FEN", () => {
    const rules = new ChessJsRulesAdapter();
    const before = rules.getFen();
    expect(rules.attemptMove(moveInputFromUci("e2e4")).status).toBe("committed");

    const undo = rules.undo();

    expect(undo.status).toBe("undone");
    if (undo.status === "undone") {
      expect(undo.restoredFen).toBe(before);
      expect(undo.undoneMove).toMatchObject({ san: "e4", uci: "e2e4" });
    }
    expect(rules.getFen()).toBe(before);
  });

  it("returns an unavailable result when there is no move to undo", () => {
    expect(new ChessJsRulesAdapter().undo()).toEqual({
      status: "unavailable",
      reason: "no-move",
    });
  });

  it("exports PGN for the committed move history", () => {
    const rules = new ChessJsRulesAdapter();
    expect(rules.attemptMove(moveInputFromUci("e2e4")).status).toBe("committed");
    expect(rules.attemptMove(moveInputFromUci("e7e5")).status).toBe("committed");

    expect(rules.exportPgn()).toContain("1. e4 e5");
  });

  it("round-trips a valid FEN exactly", () => {
    const rules = loadFixture(chessRulesFixtures.castling.fen);

    expect(rules.getFen()).toBe(chessRulesFixtures.castling.fen);
  });

  it("round-trips PGN into the same final FEN", () => {
    const source = new ChessJsRulesAdapter();
    for (const move of ["e2e4", "e7e5", "g1f3"] as const) {
      expect(source.attemptMove(moveInputFromUci(move)).status).toBe("committed");
    }

    const target = new ChessJsRulesAdapter();
    target.loadPgn(source.exportPgn());

    expect(target.getFen()).toBe(source.getFen());
    expect(target.exportPgn()).toBe(source.exportPgn());
  });

  it("rejects invalid FEN without replacing the current position", () => {
    const rules = new ChessJsRulesAdapter();
    const before = rules.getFen();

    expect(() => rules.loadFen("not-a-fen")).toThrow(DomainValidationError);
    expect(rules.getFen()).toBe(before);
  });
});

function loadFixture(fen: string): ChessJsRulesAdapter {
  const rules = new ChessJsRulesAdapter();
  rules.loadFen(fen);
  return rules;
}
