export interface ApplicationPersistenceFixtureDocumentation {
  readonly description: string;
  readonly expected: string;
  readonly id: string;
  readonly purpose: string;
}

export const coordinatorApplicationFixtures = {
  ready: coordinator("coordinator-ready", "an active ready session", "the applied start is saved"),
  humanTurn: coordinator(
    "coordinator-human-turn",
    "an active human-turn session",
    "the next accepted human command is saved",
  ),
  opponentTurn: coordinator(
    "coordinator-opponent-turn",
    "an active opponent-turn session",
    "opponent request context is saved",
  ),
  awaitingOpponent: coordinator(
    "coordinator-awaiting-opponent",
    "an awaiting-opponent session",
    "the exact pending request survives persistence",
  ),
  paused: coordinator(
    "coordinator-paused",
    "a paused session",
    "the exact resume phase survives persistence",
  ),
  completedCheckmate: coordinator(
    "coordinator-completed-checkmate",
    "a checkmate completion",
    "history is finalized with authoritative PGN",
  ),
  completedDraw: coordinator(
    "coordinator-completed-draw",
    "a rules-authority draw",
    "the draw is finalized without an active write",
  ),
  completedTimeout: coordinator(
    "coordinator-completed-timeout",
    "a deterministic timeout",
    "the timeout result is finalized",
  ),
  abandoned: coordinator(
    "coordinator-abandoned",
    "an abandoned session",
    "the abandoned result is finalized",
  ),
  writeFailure: coordinator(
    "coordinator-write-failure",
    "an active-save failure",
    "domain success remains authoritative and retryable",
  ),
  finalizationFailure: coordinator(
    "coordinator-finalization-failure",
    "a finalization failure",
    "the exact completed record remains pending",
  ),
  pendingRetry: coordinator(
    "coordinator-pending-retry",
    "a pending durable operation",
    "retry does not rerun the chess command",
  ),
} as const;

export const startupApplicationFixtures = {
  noActive: startup("startup-no-active", "an empty active slot", "no-active-game"),
  ready: startup("startup-ready", "a valid ready checkpoint", "restored without revision change"),
  humanTurn: startup(
    "startup-human-turn",
    "a valid human-turn checkpoint",
    "restored at player-turn",
  ),
  opponentTurn: startup(
    "startup-opponent-turn",
    "a valid opponent-turn checkpoint",
    "restored at opponent-turn",
  ),
  awaitingOpponent: startup(
    "startup-awaiting-opponent",
    "a valid awaiting-opponent checkpoint",
    "restored with its request context",
  ),
  paused: startup("startup-paused", "a valid paused checkpoint", "remains paused"),
  corrupted: startup(
    "startup-corrupted",
    "a corrupted repository record",
    "recovery-required without deletion",
  ),
  unsupported: startup(
    "startup-unsupported",
    "an unsupported checkpoint version",
    "recovery-required with a stable category",
  ),
  restorationRejected: startup(
    "startup-restoration-rejected",
    "a replay-inconsistent checkpoint",
    "recovery-required without repair",
  ),
  unavailable: startup(
    "startup-storage-unavailable",
    "an unavailable repository",
    "storage-unavailable rather than corruption",
  ),
  terminalInActive: startup(
    "startup-terminal-active",
    "a terminal session in the active slot",
    "explicit recovery is required",
  ),
} as const;

export const historyApplicationFixtures = {
  multipleGames: history(
    "history-multiple-games",
    "multiple completed-game summaries",
    "bounded immutable list items",
  ),
  pages: history("history-pages", "a page and stable cursor", "pagination metadata is preserved"),
  withReview: history(
    "history-with-review",
    "a completed game with review metadata",
    "review availability is projected",
  ),
  withoutReview: history(
    "history-without-review",
    "a completed game without review metadata",
    "the game remains available",
  ),
  corrupted: history(
    "history-corrupted",
    "a corrupted completed record",
    "safe corruption metadata is returned without deletion",
  ),
  cleanupFailure: history(
    "history-cleanup-failure",
    "a review cleanup failure after game deletion",
    "authoritative deletion succeeds with a warning",
  ),
  unsafeFilename: history(
    "history-unsafe-filename",
    "a PGN export identity requiring sanitization",
    "a filesystem-neutral descriptor uses a safe filename",
  ),
} as const;

function coordinator(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document coordinator autosave and retry behavior");
}

function startup(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document startup restoration and recovery behavior");
}

function history(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document history read and mutation behavior");
}

function fixture(
  id: string,
  description: string,
  expected: string,
  purpose: string,
): ApplicationPersistenceFixtureDocumentation {
  return Object.freeze({ description, expected, id, purpose });
}
