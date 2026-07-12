import { describe, expect, it } from "vitest";

import { ChessRulesAdapterError, DomainValidationError } from "./errors";
import { moveInputFromUci } from "./chess-rules";
import {
  parseFen,
  parseColor,
  parseGameId,
  parsePgn,
  parsePly,
  parseRequestId,
  parseSanMove,
  parseSessionRevision,
  parseSquare,
  parseUciMove,
  parseUndoPlyCount,
} from "./primitives";

describe("chess domain primitives", () => {
  it("constructs validated external chess and identifier values", () => {
    expect(parseColor("white")).toBe("white");
    expect(parseSquare("e4")).toBe("e4");
    expect(parseFen("8/8/8/8/8/8/4k3/4K3 w - - 0 1")).toContain(" w ");
    expect(parsePgn("1. e4 e5")).toBe("1. e4 e5");
    expect(parseSanMove("O-O")).toBe("O-O");
    expect(parseUciMove("E2E4")).toBe("e2e4");
    expect(parsePly(12)).toBe(12);
    expect(parseGameId("game-2026-001")).toBe("game-2026-001");
    expect(parseRequestId("request:001")).toBe("request:001");
    expect(parseSessionRevision(7)).toBe(7);
    expect(parseUndoPlyCount(1)).toBe(1);
    expect(parseUndoPlyCount(2)).toBe(2);
  });

  it("maps every supported UCI promotion symbol", () => {
    expect(moveInputFromUci("a7a8b").promotion).toBe("bishop");
    expect(moveInputFromUci("a7a8n").promotion).toBe("knight");
    expect(moveInputFromUci("a7a8q").promotion).toBe("queen");
    expect(moveInputFromUci("a7a8r").promotion).toBe("rook");
  });

  it("provides a typed error for unexpected adapter failures", () => {
    const cause = new Error("upstream failure");
    const error = new ChessRulesAdapterError("Rules adapter failed.", { cause });

    expect(error.name).toBe("ChessRulesAdapterError");
    expect(error.code).toBe("chess-rules-adapter-failure");
    expect(error.cause).toBe(cause);
  });

  it.each([
    ["color", () => parseColor("red"), "invalid-color"],
    ["square", () => parseSquare("i9"), "invalid-square"],
    ["FEN", () => parseFen("not-a-fen"), "invalid-fen"],
    ["PGN", () => parsePgn("bad\0pgn"), "invalid-pgn"],
    ["SAN", () => parseSanMove("<script>"), "invalid-san"],
    ["UCI", () => parseUciMove("e2-e4"), "invalid-uci"],
    ["ply", () => parsePly(-1), "invalid-ply"],
    ["game ID", () => parseGameId("invalid id"), "invalid-game-id"],
    ["request ID", () => parseRequestId(""), "invalid-request-id"],
    ["session revision", () => parseSessionRevision(-1), "invalid-session-revision"],
    ["undo ply count", () => parseUndoPlyCount(3), "invalid-undo-count"],
  ])("rejects an invalid %s at runtime", (_label, parse, expectedCode) => {
    expect(parse).toThrow(DomainValidationError);

    try {
      parse();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DomainValidationError);
      expect((error as DomainValidationError).code).toBe(expectedCode);
    }
  });
});
