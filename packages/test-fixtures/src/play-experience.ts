export interface PlayExperienceFixtureDocumentation {
  readonly description: string;
  readonly expected: string;
  readonly id: string;
  readonly purpose: string;
}

export const playStartupFixtures = {
  restoring: startup(
    "startup-restoring-ui",
    "startup restoration is pending",
    "ordinary routes remain gated",
  ),
  noActiveGame: startup(
    "startup-empty-ui",
    "the active slot is empty",
    "the home route becomes available",
  ),
  restoredReady: startup(
    "startup-restored-ready-ui",
    "a ready checkpoint restores",
    "the ready shell is available without starting",
  ),
  restoredHumanTurn: startup(
    "startup-restored-human-turn-ui",
    "an active human turn restores",
    "the immutable turn state is displayed",
  ),
  restoredPaused: startup(
    "startup-restored-paused-ui",
    "a paused checkpoint restores",
    "stored clock values remain paused",
  ),
  recoveryRequired: startup(
    "startup-recovery-ui",
    "stored data cannot be restored safely",
    "safe recovery actions replace ordinary routes",
  ),
  storageUnavailable: startup(
    "startup-storage-unavailable-ui",
    "browser storage is unavailable",
    "a distinct retry-or-continue state is shown",
  ),
  failed: startup(
    "startup-failed-ui",
    "startup fails unexpectedly",
    "a safe fallback contains no raw error details",
  ),
} as const;

export const playSetupFixtures = {
  default: setup(
    "setup-default",
    "the initial local-game form",
    "local two-player, untimed, undo, and White are selected",
  ),
  untimed: setup("setup-untimed", "the untimed option", "an untimed ready game is requested"),
  threePlusTwo: setup(
    "setup-three-plus-two",
    "the 3+2 option",
    "an increment ready game is requested",
  ),
  fiveMinutes: setup(
    "setup-five-minutes",
    "the five-minute option",
    "a sudden-death ready game is requested",
  ),
  tenMinutes: setup(
    "setup-ten-minutes",
    "the ten-minute option",
    "a sudden-death ready game is requested",
  ),
  undoEnabled: setup(
    "setup-undo-enabled",
    "undo is selected",
    "the immutable configuration allows undo",
  ),
  undoDisabled: setup(
    "setup-undo-disabled",
    "undo is cleared",
    "the immutable configuration disables undo",
  ),
  whiteOrientation: setup(
    "setup-white-orientation",
    "White orientation is selected",
    "the board is projected from White's side",
  ),
  blackOrientation: setup(
    "setup-black-orientation",
    "Black orientation is selected",
    "the board is projected from Black's side",
  ),
  existingActive: setup(
    "setup-existing-active",
    "a valid active game exists",
    "creation waits for explicit replacement confirmation",
  ),
  corruptedActive: setup(
    "setup-corrupted-active",
    "the active record is corrupted",
    "the recovery gate owns the decision",
  ),
  invalid: setup(
    "setup-invalid",
    "external setup values fail validation",
    "stable field errors are returned",
  ),
  storageFailure: setup(
    "setup-storage-failure",
    "the repository read fails",
    "creation does not claim success",
  ),
  persistedCreation: setup(
    "setup-created-persisted",
    "the ready checkpoint saves",
    "the read-only shell receives a durable coordinator",
  ),
  unsavedCreation: setup(
    "setup-created-unsaved",
    "the ready checkpoint cannot save",
    "the in-memory game opens with an honest warning",
  ),
} as const;

export const playGameShellFixtures = {
  readyUntimed: shell(
    "shell-ready-untimed",
    "a ready untimed session",
    "the board and Untimed labels render",
  ),
  readyTimed: shell(
    "shell-ready-timed",
    "a ready timed session",
    "equal initial clock values render without consuming time",
  ),
  humanTurn: shell("shell-human-turn", "an active human turn", "the side to move is indicated"),
  paused: shell(
    "shell-paused",
    "a paused session",
    "stored remaining values render without ticking",
  ),
  awaitingOpponent: shell(
    "shell-awaiting-opponent",
    "an awaiting-opponent session",
    "a calm waiting status renders",
  ),
  degraded: shell("shell-degraded", "a degraded session", "an unavailable-opponent status renders"),
  completedCheckmate: shell(
    "shell-completed-checkmate",
    "a checkmate result",
    "the winner and checkmate reason render",
  ),
  completedDraw: shell("shell-completed-draw", "a draw result", "the draw reason renders"),
  abandoned: shell("shell-abandoned", "an abandoned session", "a terminal abandoned label renders"),
  unsaved: shell(
    "shell-unsaved",
    "active persistence is unsaved",
    "a retryable refresh-durability warning renders",
  ),
  finalizationPending: shell(
    "shell-finalization-pending",
    "history finalization is pending",
    "a history-save warning renders without changing the result",
  ),
  emptyHistory: shell(
    "shell-empty-history",
    "no moves are recorded",
    "a ready empty-state message renders",
  ),
  multiMoveHistory: shell(
    "shell-multi-move-history",
    "multiple SAN records exist",
    "numbered White and Black moves render",
  ),
} as const;

function startup(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document startup-gate presentation");
}

function setup(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document validated new-game setup behavior");
}

function shell(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document read-only game-shell presentation");
}

function fixture(
  id: string,
  description: string,
  expected: string,
  purpose: string,
): PlayExperienceFixtureDocumentation {
  return Object.freeze({ description, expected, id, purpose });
}
