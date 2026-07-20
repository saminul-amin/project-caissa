import { describe, expect, it } from "vitest";

import { at, createControllerFixture, humanMove } from "../../test/application-service-test-kit";
import { parseEpochTimestampMs } from "../persistence";
import { buildCompletedGameRecord } from "./completed-game-record-builder";

describe("buildCompletedGameRecord", () => {
  it("rejects a nonterminal controller instead of inventing completion data", () => {
    const controller = createControllerFixture();

    expect(() =>
      buildCompletedGameRecord({
        completedAt: parseEpochTimestampMs(2_000),
        controller,
      }),
    ).toThrow("terminal game session");
  });

  it("derives terminal metadata from the authoritative session", () => {
    const controller = createControllerFixture({ id: "builder-terminal" });
    controller.start(at(0));
    controller.submitHumanMove(humanMove("e2e4", 1));
    controller.abandon({ now: at(2) });

    const built = buildCompletedGameRecord({
      completedAt: parseEpochTimestampMs(2_000),
      controller,
      startedAt: parseEpochTimestampMs(1_000),
    });

    expect(built.record).toMatchObject({
      completedAt: 2_000,
      gameId: "builder-terminal",
      startedAt: 1_000,
    });
    expect(built.record.pgn).toBe(controller.exportPgn());
    expect(built.metadata).toMatchObject({
      blackParticipantKind: "human",
      revision: controller.getSession().revision,
      whiteParticipantKind: "human",
    });
  });
});
