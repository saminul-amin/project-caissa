import {
  coordinatorApplicationFixtures,
  historyApplicationFixtures,
  startupApplicationFixtures,
} from "@caissa/test-fixtures/application-persistence";
import { describe, expect, it } from "vitest";

describe("application-persistence fixture catalog", () => {
  it("documents every approved coordinator fixture without personal information", () => {
    expect(Object.keys(coordinatorApplicationFixtures)).toHaveLength(12);
    expect(JSON.stringify(coordinatorApplicationFixtures)).not.toMatch(/@|password|secret/iu);
  });

  it("documents every approved startup fixture", () => {
    expect(Object.keys(startupApplicationFixtures)).toHaveLength(11);
  });

  it("documents every approved history fixture", () => {
    expect(Object.keys(historyApplicationFixtures)).toHaveLength(7);
  });

  it("gives every fixture an expected behavior and purpose", () => {
    const fixtures = [
      ...Object.values(coordinatorApplicationFixtures),
      ...Object.values(startupApplicationFixtures),
      ...Object.values(historyApplicationFixtures),
    ];
    expect(fixtures.every((fixture) => fixture.expected.length > 0)).toBe(true);
    expect(fixtures.every((fixture) => fixture.purpose.length > 0)).toBe(true);
  });
});
