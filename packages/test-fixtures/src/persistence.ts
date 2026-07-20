export interface PersistenceFixtureDocumentation {
  readonly description: string;
  readonly expected: string;
  readonly id: string;
  readonly purpose: string;
}

export const activeGamePersistenceFixtures = {
  ready: active("active-ready", "ready game checkpoint"),
  humanTurn: active("active-human-turn", "active human-turn checkpoint"),
  opponentTurn: active("active-opponent-turn", "active opponent-turn checkpoint"),
  awaitingOpponent: active("active-awaiting-opponent", "awaiting-opponent checkpoint"),
  paused: active("active-paused", "paused checkpoint with an exact resume phase"),
} as const;

export const completedGamePersistenceFixtures = {
  checkmate: completed("completed-checkmate", "checkmate result and final PGN"),
  stalemate: completed("completed-stalemate", "stalemate draw and final PGN"),
  repetition: completed("completed-repetition", "threefold-repetition draw and final PGN"),
  timeout: completed("completed-timeout", "deterministic timeout result and final PGN"),
  abandoned: completed("completed-abandoned", "abandoned lifecycle and preserved PGN"),
} as const;

export const preferencesPersistenceFixtures = {
  defaults: fixture(
    "preferences-defaults",
    "The approved dark-first, Caissa Classic defaults.",
    "A missing record returns the immutable default model.",
  ),
  customized: fixture(
    "preferences-customized",
    "Every supported preference uses a valid non-default value where one exists.",
    "Every value round-trips without accepting unapproved settings.",
  ),
  partiallyInvalid: fixture(
    "preferences-partially-invalid",
    "One Boolean and one enum are invalid while other values remain supported.",
    "Valid fields survive and invalid fields fall back independently.",
  ),
  unsupportedEnum: fixture(
    "preferences-unsupported-enum",
    "A future or malicious theme name is stored.",
    "The unknown value never escapes runtime validation.",
  ),
} as const;

export const reviewPersistenceFixtures = {
  notStarted: review("review-not-started", "not-started"),
  partial: review("review-partial", "partial"),
  completed: review("review-completed", "completed"),
  failed: review("review-failed", "failed"),
} as const;

export const analysisCachePersistenceFixtures = {
  unexpired: cache("cache-unexpired", "A valid entry whose expiry is in the future."),
  expired: cache("cache-expired", "A valid entry whose expiry boundary has passed."),
  analysisProfile: cache(
    "cache-profile-identity",
    "The same position and engine use a different analysis profile.",
  ),
  engineVersion: cache(
    "cache-engine-version-identity",
    "The same position and profile use a different engine version.",
  ),
  corrupted: cache("cache-corrupted", "The disposable payload or identity is malformed."),
} as const;

export const persistenceCorruptionFixtures = {
  unsupportedRecordVersion: corruption("corrupt-record-version", "unsupported record version"),
  invalidCheckpoint: corruption("corrupt-checkpoint", "invalid checkpoint"),
  mismatchedGameId: corruption("corrupt-game-id", "mismatched game ID"),
  invalidRevision: corruption("corrupt-revision", "invalid revision"),
  invalidTimestamp: corruption("corrupt-timestamp", "invalid epoch timestamp"),
  invalidCompletedResult: corruption("corrupt-result", "invalid completed result"),
  missingPgn: corruption("corrupt-missing-pgn", "missing final PGN"),
  invalidReviewStatus: corruption("corrupt-review-status", "invalid review status"),
  invalidCacheKey: corruption("corrupt-cache-key", "invalid analysis-cache key"),
} as const;

function active(id: string, description: string): PersistenceFixtureDocumentation {
  return fixture(
    id,
    `A version 1 ${description}.`,
    "The singleton active slot validates and round-trips without constructing a controller.",
  );
}

function completed(id: string, description: string): PersistenceFixtureDocumentation {
  return fixture(
    id,
    `A terminal checkpoint with ${description}.`,
    "The game is eligible for bounded history storage and full-record retrieval.",
  );
}

function review(id: string, status: string): PersistenceFixtureDocumentation {
  return fixture(
    id,
    `Metadata for a ${status} review-generation state.`,
    "Only status, timestamps, and safe provenance are stored; review generation is absent.",
  );
}

function cache(id: string, description: string): PersistenceFixtureDocumentation {
  return fixture(
    id,
    description,
    "The disposable record remains isolated from active and completed games.",
  );
}

function corruption(id: string, description: string): PersistenceFixtureDocumentation {
  return fixture(
    id,
    `A durable record containing an ${description}.`,
    "The repository returns safe corruption metadata and never exposes the raw value.",
  );
}

function fixture(
  id: string,
  description: string,
  expected: string,
): PersistenceFixtureDocumentation {
  return {
    description,
    expected,
    id,
    purpose: "Document deterministic local-persistence behavior without personal information.",
  };
}
