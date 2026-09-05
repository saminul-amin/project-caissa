import { moveInputFromUci, parseUciMove } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import { at, createControllerFixture, humanMove } from "../../test/application-service-test-kit";
import {
  boardPlayerOrder,
  clockUrgency,
  createMoveHistoryRows,
  createPlayerPanelModel,
  gameStatusLabel,
  resultLabel,
  timeControlLabel,
} from "./game-shell-projections";
import { createPiecePositionSummary, findKingSquare } from "./position-summary";

describe("game shell projections", () => {
  it("maps ready and active phases to approved user-facing labels", () => {
    const controller = createControllerFixture();
    expect(gameStatusLabel(controller.getSession())).toBe("Ready");
    controller.start(at(0));
    expect(gameStatusLabel(controller.getSession())).toBe("White to move");
    expect(
      gameStatusLabel({
        ...controller.getSession(),
        lifecycle: { phase: "awaiting-opponent" },
      }),
    ).toBe("Waiting for opponent");
    expect(
      gameStatusLabel({
        ...controller.getSession(),
        lifecycle: { phase: "degraded" },
      }),
    ).toBe("Connection or opponent unavailable");
  });

  it("maps participant kind and active turn without fake ratings", () => {
    const controller = createControllerFixture();
    controller.start(at(0));
    expect(
      createPlayerPanelModel(
        "white",
        controller.getSession().configuration.participants.white,
        controller.getSession(),
      ),
    ).toEqual({ color: "white", isActive: true, kindLabel: "Human player", label: "White" });
  });

  it("groups authoritative SAN history into numbered turns", () => {
    const controller = createControllerFixture();
    controller.start(at(0));
    controller.submitHumanMove(humanMove("e2e4", 1));
    controller.submitHumanMove(humanMove("e7e5", 2));
    const rows = createMoveHistoryRows(controller.getSession().history);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.moveNumber).toBe(1);
    expect(rows[0]?.white?.san).toBe("e4");
    expect(rows[0]?.black?.san).toBe("e5");
  });

  it("projects approved time-control labels", () => {
    expect(timeControlLabel({ kind: "untimed" })).toBe("Untimed");
    expect(
      timeControlLabel(
        createControllerFixture({
          timeControl: { initialMs: 300_000, kind: "sudden-death" },
        }).getSession().configuration.timeControl,
      ),
    ).toBe("5 minutes");
    expect(
      timeControlLabel(
        createControllerFixture({
          timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
        }).getSession().configuration.timeControl,
      ),
    ).toBe("3 + 2");
  });

  it("maps completed and abandoned results without exposing lifecycle enum text", () => {
    const abandoned = createControllerFixture();
    abandoned.start(at(0));
    abandoned.abandon({ now: at(1) });
    expect(gameStatusLabel(abandoned.getSession())).toBe("Abandoned");
    expect(resultLabel(abandoned.getSession().result)).toBe("Abandoned");
  });

  it("produces an accessible piece listing and locates a checked king", () => {
    const session = createControllerFixture({ fen: "7k/8/8/8/8/8/4R3/4K3 b - - 0 1" }).getSession();
    const pieces = createPiecePositionSummary(session.position.fen);
    expect(pieces).toContainEqual({ color: "black", name: "king", square: "h8" });
    expect(findKingSquare(session.position.fen, "black")).toBe("h8");
  });

  it("keeps move legality outside projections", () => {
    expect(moveInputFromUci(parseUciMove("e2e4"))).toEqual({ from: "e2", to: "e4" });
  });
});

describe("clockUrgency", () => {
  it("stays calm for untimed, stopped, and comfortable clocks", () => {
    expect(clockUrgency(undefined, true)).toBe("calm");
    expect(clockUrgency(5_000 as never, false)).toBe("calm");
    expect(clockUrgency(31_000 as never, true)).toBe("calm");
  });

  it("steps to low under thirty seconds and critical under ten", () => {
    expect(clockUrgency(30_000 as never, true)).toBe("low");
    expect(clockUrgency(10_001 as never, true)).toBe("low");
    expect(clockUrgency(10_000 as never, true)).toBe("critical");
    expect(clockUrgency(0 as never, true)).toBe("critical");
  });
});

describe("boardPlayerOrder", () => {
  it("places the opposing side above the board for either orientation", () => {
    expect(boardPlayerOrder("white")).toEqual(["black", "white"]);
    expect(boardPlayerOrder("black")).toEqual(["white", "black"]);
  });
});
