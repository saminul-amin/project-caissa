import {
  checkpointFixtures,
  corruptedCheckpointFixtures,
  restartFixtures,
  undoFixtures,
} from "@caissa/test-fixtures/game-recovery";
import { describe, expect, it } from "vitest";

describe("curated recoverable-domain fixtures", () => {
  it("documents all required undo scenarios", () => {
    expect(Object.keys(undoFixtures)).toHaveLength(9);
    expect(Object.values(undoFixtures).every(isDocumented)).toBe(true);
  });

  it("documents all required restart scenarios", () => {
    expect(Object.keys(restartFixtures)).toHaveLength(7);
    expect(Object.values(restartFixtures).every(isDocumented)).toBe(true);
  });

  it("documents all required checkpoint session categories", () => {
    expect(Object.keys(checkpointFixtures)).toHaveLength(10);
    expect(Object.values(checkpointFixtures).every(isDocumented)).toBe(true);
  });

  it("documents independently corrupted checkpoint categories", () => {
    expect(Object.keys(corruptedCheckpointFixtures)).toHaveLength(13);
    expect(Object.values(corruptedCheckpointFixtures).every(isDocumented)).toBe(true);
  });
});

function isDocumented(fixture: { readonly expected: string; readonly purpose: string }): boolean {
  return fixture.expected.length > 0 && fixture.purpose.length > 0;
}
