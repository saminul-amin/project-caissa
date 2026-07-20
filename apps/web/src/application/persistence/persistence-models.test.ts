import { ChessJsRulesAdapter } from "@caissa/chess-core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_PREFERENCES,
  PersistenceValidationError,
  createAnalysisCacheKey,
  parseAnalysisCacheKey,
  parseEpochTimestampMs,
  parseUserPreferences,
} from "./index";

describe("persistence application models", () => {
  it("parses a non-negative safe epoch timestamp", () => {
    expect(parseEpochTimestampMs(0)).toBe(0);
    expect(parseEpochTimestampMs(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects negative, fractional, non-finite, and non-numeric epoch timestamps", () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      expect(() => parseEpochTimestampMs(value)).toThrow(PersistenceValidationError);
    }
  });

  it("builds deterministic length-prefixed cache keys", () => {
    const fen = new ChessJsRulesAdapter().createInitialPosition().fen;
    const identity = {
      analysisProfile: "profile:one",
      configurationVersion: "configuration-v1",
      engineId: "engine",
      engineVersion: "1.0.0",
      fen,
    };

    expect(createAnalysisCacheKey(identity)).toBe(createAnalysisCacheKey({ ...identity }));
    expect(createAnalysisCacheKey(identity)).toContain(
      `${String(identity.analysisProfile.length)}:profile:one`,
    );
  });

  it("rejects malformed cache keys and invalid identity parts", () => {
    expect(() => parseAnalysisCacheKey("not-versioned")).toThrow(PersistenceValidationError);
    expect(() => parseAnalysisCacheKey(`v1:${"x".repeat(4_100)}`)).toThrow(
      PersistenceValidationError,
    );
    const fen = new ChessJsRulesAdapter().createInitialPosition().fen;
    expect(() =>
      createAnalysisCacheKey({
        analysisProfile: "",
        configurationVersion: "1",
        engineId: "engine",
        engineVersion: "1",
        fen,
      }),
    ).toThrow(PersistenceValidationError);
  });

  it("strictly parses only approved preference values", () => {
    expect(parseUserPreferences(DEFAULT_USER_PREFERENCES)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(() =>
      parseUserPreferences({ ...DEFAULT_USER_PREFERENCES, theme: "future-theme" }),
    ).toThrow();
    expect(() =>
      parseUserPreferences({ ...DEFAULT_USER_PREFERENCES, unknownSetting: true }),
    ).toThrow();
  });
});
