export interface RecoveryFixtureDocumentation {
  readonly description: string;
  readonly expected: string;
  readonly id: string;
  readonly purpose: string;
}

export const undoFixtures = {
  onePlyHuman: fixture(
    "undo-one-human-ply",
    "A human-versus-human game with one committed move.",
    "Exactly one record is removed and the original mover regains the turn.",
  ),
  twoPlyExternal: fixture(
    "undo-two-practice-plies",
    "A human move followed by an external-opponent reply.",
    "Both records are removed atomically and control returns to the same human.",
  ),
  awaitingOpponent: fixture(
    "undo-awaiting-opponent",
    "A pending request exists after the latest human move.",
    "The request is cancelled, the move is removed, and its proposal becomes stale.",
  ),
  degraded: fixture(
    "undo-degraded",
    "An external request failed after the latest move.",
    "The preserved game returns to its reconstructed active participant phase.",
  ),
  checkmate: fixture(
    "undo-checkmate",
    "The latest recorded move delivered checkmate.",
    "The result is cleared and game-reopened is emitted.",
  ),
  draw: fixture(
    "undo-draw",
    "The latest recorded move produced a rules-authority draw.",
    "The draw is removed and the prior ongoing position is restored.",
  ),
  timeoutWithHistory: fixture(
    "undo-timeout-history",
    "Timeout occurred after at least one earlier committed move.",
    "A historical move is removed and its pre-move clock is rebased.",
  ),
  disabled: fixture(
    "undo-disabled",
    "The immutable configuration has allowUndo false.",
    "Undo is rejected without touching any authority.",
  ),
  insufficientHistory: fixture(
    "undo-insufficient-history",
    "Fewer records exist than the requested one or two plies.",
    "Undo is rejected with the exact prior session.",
  ),
} as const;

export const restartFixtures = {
  activeTimed: fixture(
    "restart-active-timed",
    "A timed game is actively consuming the side-to-move clock.",
    "Rules, history, result, and clock reset to a fresh ready game.",
  ),
  awaitingOpponent: fixture(
    "restart-awaiting",
    "An external-opponent request is pending.",
    "The request is cleared and its captured context is invalidated.",
  ),
  paused: fixture(
    "restart-paused",
    "A game is paused with historical remaining time.",
    "A fresh idle clock replaces the paused clock.",
  ),
  completed: fixture(
    "restart-completed",
    "A game has a final result.",
    "The result and history clear while game identity and configuration remain.",
  ),
  abandoned: fixture(
    "restart-abandoned",
    "A game is terminal by abandonment.",
    "The same game identity returns to a pristine ready phase.",
  ),
  failedRecovery: fixture(
    "restart-failed-recovery",
    "A reconstructed game carries safe failed or recovery metadata.",
    "Restart clears failure metadata and returns ready.",
  ),
  customFen: fixture(
    "restart-custom-fen",
    "The configured start is a validated custom FEN.",
    "Restart restores that FEN at session-relative ply zero.",
  ),
} as const;

export const checkpointFixtures = {
  ready: checkpoint("checkpoint-ready", "ready"),
  humanTurn: checkpoint("checkpoint-human-turn", "active human turn"),
  opponentTurn: checkpoint("checkpoint-opponent-turn", "active external-opponent turn"),
  awaitingOpponent: checkpoint("checkpoint-awaiting", "awaiting external-opponent response"),
  paused: checkpoint("checkpoint-paused", "paused game"),
  checkmate: checkpoint("checkpoint-checkmate", "completed checkmate"),
  draw: checkpoint("checkpoint-draw", "completed draw"),
  timeout: checkpoint("checkpoint-timeout", "completed timeout"),
  abandoned: checkpoint("checkpoint-abandoned", "abandoned game"),
  customFen: checkpoint("checkpoint-custom-fen", "custom-FEN game"),
} as const;

export const corruptedCheckpointFixtures = {
  unsupportedVersion: corruption("corrupt-version", "Unsupported checkpoint version is rejected."),
  modifiedSan: corruption("corrupt-san", "SAN differs from authoritative replay."),
  modifiedUci: corruption("corrupt-uci", "UCI differs or is illegal during replay."),
  modifiedFenBefore: corruption("corrupt-fen-before", "FEN-before does not connect to replay."),
  modifiedFenAfter: corruption("corrupt-fen-after", "FEN-after differs from replay."),
  missingPly: corruption("corrupt-ply", "Ply sequence is missing or non-continuous."),
  wrongMover: corruption("corrupt-mover", "Mover differs from the rules-authority turn."),
  wrongActor: corruption("corrupt-actor", "Actor differs from configured participant kind."),
  invalidClockChain: corruption(
    "corrupt-clock-chain",
    "Move clocks are not historically continuous.",
  ),
  incorrectPosition: corruption("corrupt-position", "Final snapshot differs from replayed rules."),
  resultLifecycleMismatch: corruption(
    "corrupt-result-lifecycle",
    "Lifecycle and final result contradict each other.",
  ),
  invalidRequest: corruption(
    "corrupt-request",
    "Pending request does not match FEN, ply, revision, or color.",
  ),
  invalidRevision: corruption(
    "corrupt-revision",
    "Revision is invalid or lower than committed history.",
  ),
} as const;

function fixture(id: string, description: string, expected: string): RecoveryFixtureDocumentation {
  return {
    description,
    expected,
    id,
    purpose: "Document deterministic recoverable-domain behavior.",
  };
}

function checkpoint(id: string, description: string): RecoveryFixtureDocumentation {
  return fixture(
    id,
    `A version 1 checkpoint for a ${description}.`,
    "Fresh-rules replay reproduces an immutable domain-equivalent controller session.",
  );
}

function corruption(id: string, expected: string): RecoveryFixtureDocumentation {
  return fixture(
    id,
    "One checkpoint field is independently corrupted at the storage trust boundary.",
    expected,
  );
}
