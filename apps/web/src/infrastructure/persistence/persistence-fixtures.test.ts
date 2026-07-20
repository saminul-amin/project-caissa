import {
  activeGamePersistenceFixtures,
  analysisCachePersistenceFixtures,
  completedGamePersistenceFixtures,
  persistenceCorruptionFixtures,
  preferencesPersistenceFixtures,
  reviewPersistenceFixtures,
} from "@caissa/test-fixtures/persistence";
import { describe, expect, it } from "vitest";

describe("persistence fixture catalog", () => {
  it("documents every required fixture category without embedding product data", () => {
    expect(Object.keys(activeGamePersistenceFixtures)).toHaveLength(5);
    expect(Object.keys(completedGamePersistenceFixtures)).toHaveLength(5);
    expect(Object.keys(preferencesPersistenceFixtures)).toHaveLength(4);
    expect(Object.keys(reviewPersistenceFixtures)).toHaveLength(4);
    expect(Object.keys(analysisCachePersistenceFixtures)).toHaveLength(5);
    expect(Object.keys(persistenceCorruptionFixtures)).toHaveLength(9);

    for (const group of [
      activeGamePersistenceFixtures,
      completedGamePersistenceFixtures,
      preferencesPersistenceFixtures,
      reviewPersistenceFixtures,
      analysisCachePersistenceFixtures,
      persistenceCorruptionFixtures,
    ]) {
      for (const fixture of Object.values(group)) {
        expect(fixture.purpose).toContain("deterministic local-persistence behavior");
        expect(fixture.expected.length).toBeGreaterThan(20);
      }
    }
  });
});
