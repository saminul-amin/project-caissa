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

export const playLegalMoveInteractionFixtures = {
  initialPosition: interaction(
    "interaction-initial-position",
    "the standard initial position",
    "twenty authoritative legal moves are available only after start",
  ),
  quietMoves: interaction(
    "interaction-quiet-source",
    "a source has non-capturing moves",
    "quiet destinations use the legal-target marker",
  ),
  captures: interaction(
    "interaction-capture-source",
    "a source has a legal capture",
    "capture destinations use a distinct ring marker",
  ),
  noLegalMoves: interaction(
    "interaction-no-legal-moves",
    "a square has no legal move",
    "no command is submitted and calm feedback is shown",
  ),
  selectedSource: interaction(
    "interaction-selected-source",
    "a movable source is selected",
    "the source and unique authoritative targets are exposed",
  ),
  legalDestination: interaction(
    "interaction-legal-destination",
    "a selected destination matches a legal candidate",
    "one coordinator move command is submitted",
  ),
  illegalDestination: interaction(
    "interaction-illegal-destination",
    "a selected destination has no legal candidate",
    "the authoritative position is unchanged",
  ),
  inCheck: interaction(
    "interaction-in-check",
    "the side to move is checked",
    "the checked king remains distinct from legal targets",
  ),
  castling: interaction(
    "interaction-castling",
    "castling is legal in the authoritative position",
    "the king move candidate is submitted without UI legality logic",
  ),
  enPassant: interaction(
    "interaction-en-passant",
    "an en-passant capture is legal",
    "the candidate is treated as an authoritative capture target",
  ),
} as const;

export const playPromotionFixtures = {
  white: promotion(
    "promotion-white",
    "a White pawn reaches its promotion destination",
    "White Queen, Rook, Bishop, and Knight choices are presented",
  ),
  black: promotion(
    "promotion-black",
    "a Black pawn reaches its promotion destination",
    "Black piece presentation is used",
  ),
  queen: promotion(
    "promotion-queen",
    "Queen is explicitly selected",
    "the authoritative move includes Queen promotion",
  ),
  rook: promotion(
    "promotion-rook",
    "Rook underpromotion is explicitly selected",
    "the authoritative move includes Rook promotion",
  ),
  bishop: promotion(
    "promotion-bishop",
    "Bishop underpromotion is explicitly selected",
    "the authoritative move includes Bishop promotion",
  ),
  knight: promotion(
    "promotion-knight",
    "Knight underpromotion is explicitly selected",
    "the authoritative move includes Knight promotion",
  ),
  cancelled: promotion(
    "promotion-cancelled",
    "the promotion dialog is cancelled",
    "no command is submitted and revision is unchanged",
  ),
} as const;

export const playInteractiveSessionFixtures = {
  readyUntimed: session(
    "session-ready-untimed",
    "an untimed game awaits explicit start",
    "the board is a noninteractive preview",
  ),
  readyTimed: session(
    "session-ready-timed",
    "a timed game awaits explicit start",
    "both clocks retain equal initial time",
  ),
  activeWhite: session(
    "session-active-white",
    "an active White human turn",
    "White move input is enabled",
  ),
  activeBlack: session(
    "session-active-black",
    "an active Black human turn",
    "Black move input is enabled",
  ),
  submitting: session(
    "session-submitting",
    "a human move command is in flight",
    "duplicate board input is blocked",
  ),
  appliedSaved: session(
    "session-applied-saved",
    "a move is committed and durable",
    "the board, SAN history, revision, and turn refresh together",
  ),
  appliedUnsaved: session(
    "session-applied-unsaved",
    "a move is committed but autosave fails",
    "playable memory state remains authoritative with a warning",
  ),
  completedFinalized: session(
    "session-completed-finalized",
    "a terminal result is saved transactionally",
    "the board is read-only and the active slot is clear",
  ),
  completedPending: session(
    "session-completed-finalization-pending",
    "terminal history finalization fails",
    "the result stays authoritative and further input is blocked",
  ),
  paused: session(
    "session-paused-interaction",
    "a paused checkpoint restores",
    "the board remains read-only with no resume control",
  ),
  degraded: session(
    "session-degraded-interaction",
    "a degraded checkpoint restores",
    "the board remains read-only",
  ),
  abandoned: session(
    "session-abandoned-interaction",
    "an abandoned checkpoint restores",
    "the final position remains read-only",
  ),
} as const;

export const playClockContinuityFixtures = {
  runningBeforeReload: clock(
    "clock-running-before-reload",
    "a timed game persists a running clock",
    "the absolute monotonic-compatible timestamp is checkpointed",
  ),
  restoredLaterOrigin: clock(
    "clock-restored-later-origin",
    "a new document has a later performance time origin",
    "projected downtime is deducted without timestamp regression",
  ),
  exactTimeout: clock(
    "clock-exact-timeout",
    "elapsed time equals the remaining time",
    "display reaches zero without mutating the session",
  ),
  expiredBeforeMove: clock(
    "clock-expired-before-move",
    "the active clock expired while the page was not commanding",
    "the next authoritative command completes by timeout without the move",
  ),
} as const;

export const playPauseResumeFixtures = {
  activePause: control(
    "controls-pause-active",
    "an active timed game is paused",
    "elapsed time is charged once and neither clock remains active",
  ),
  pauseTimeout: control(
    "controls-pause-timeout",
    "the active clock reaches zero at the pause timestamp",
    "timeout completes and finalizes instead of producing a paused state",
  ),
  restoredPaused: control(
    "controls-pause-restored",
    "a paused checkpoint reloads",
    "the stored resume phase and remaining times restore without auto-resume",
  ),
  explicitResume: control(
    "controls-resume-explicit",
    "the user resumes a paused game",
    "the recorded side resumes from caller-supplied monotonic time",
  ),
  persistenceFailure: control(
    "controls-pause-unsaved",
    "pause succeeds while its active checkpoint save fails",
    "paused memory state remains authoritative with a retryable warning",
  ),
} as const;

export const playUndoControlFixtures = {
  onePly: control(
    "controls-undo-one-ply",
    "one active-game ply is undoable",
    "one authoritative move is removed immediately",
  ),
  twoPly: control(
    "controls-undo-two-plies",
    "two active-game plies are undoable",
    "both authoritative moves are removed as one command",
  ),
  completedConfirmation: control(
    "controls-undo-completed-confirmation",
    "a completed game has undoable history",
    "confirmation is required before the result is cleared and the game reopens",
  ),
  pausedUnavailable: control(
    "controls-undo-paused",
    "a paused game has history",
    "undo is unavailable with an instruction to resume first",
  ),
  disabledPolicy: control(
    "controls-undo-disabled-policy",
    "the immutable game configuration disables undo",
    "both undo choices remain unavailable",
  ),
  insufficientHistory: control(
    "controls-undo-insufficient-history",
    "fewer plies exist than requested",
    "the unavailable choice explains the history requirement",
  ),
} as const;

export const playRestartControlFixtures = {
  activeConfirmation: control(
    "controls-restart-active-confirmation",
    "an active game requests restart",
    "confirmation precedes a same-ID reset to ready",
  ),
  completedConfirmation: control(
    "controls-restart-completed-confirmation",
    "a completed game requests restart",
    "confirmation clears result, history, and clocks without auto-starting",
  ),
  pristineReady: control(
    "controls-restart-pristine-ready",
    "a game is already in its pristine ready state",
    "restart is unavailable with a calm explanation",
  ),
  unsaved: control(
    "controls-restart-unsaved",
    "restart applies while active persistence fails",
    "the fresh ready state remains active with a retryable warning",
  ),
} as const;

export const playAbandonControlFixtures = {
  confirmation: control(
    "controls-abandon-confirmation",
    "an active game requests abandonment",
    "a destructive confirmation explains that no winner is awarded",
  ),
  finalized: control(
    "controls-abandon-finalized",
    "abandonment finalization succeeds",
    "the current position and history move to completed storage with no winner",
  ),
  finalizationPending: control(
    "controls-abandon-finalization-pending",
    "abandonment is authoritative while finalization fails",
    "the result remains and reopening controls stay blocked until durable retry",
  ),
  retry: control(
    "controls-abandon-retry",
    "pending abandonment finalization is retried",
    "only the exact durable write repeats and the command revision does not change",
  ),
} as const;

export const playGameControlUiFixtures = {
  available: control(
    "controls-ui-available",
    "ordinary active play has no pending mutation",
    "pause, eligible undo, restart, and abandonment controls are explicit",
  ),
  pending: control(
    "controls-ui-pending",
    "one control mutation is in flight",
    "board input, promotion, and sibling controls are locked",
  ),
  unavailableReason: control(
    "controls-ui-unavailable-reason",
    "a lifecycle or policy makes a control unavailable",
    "the control exposes a stable accessible explanation",
  ),
  confirmation: control(
    "controls-ui-confirmation",
    "a destructive or completed-game action needs confirmation",
    "the named modal traps focus, starts safely, handles Escape, and restores focus",
  ),
  persistenceDistinction: control(
    "controls-ui-persistence-distinction",
    "a domain operation and its persistence have independent outcomes",
    "saved, unsaved, and finalization-pending feedback remain distinct",
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

function interaction(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document authoritative board interaction behavior");
}

function promotion(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document explicit promotion behavior");
}

function session(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document interactive session presentation");
}

function clock(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document cross-navigation clock behavior");
}

function control(id: string, description: string, expected: string) {
  return fixture(id, description, expected, "document bounded game-control behavior");
}

function fixture(
  id: string,
  description: string,
  expected: string,
  purpose: string,
): PlayExperienceFixtureDocumentation {
  return Object.freeze({ description, expected, id, purpose });
}
