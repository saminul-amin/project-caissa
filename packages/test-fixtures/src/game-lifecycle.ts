export interface GameLifecycleFixture {
  readonly description: string;
  readonly expected: string;
  readonly id: string;
  readonly purpose: string;
  readonly state: Readonly<Record<string, unknown>>;
}

export const gameLifecycleFixtures = {
  creating: {
    id: "lifecycle-creating",
    purpose: "Verify the lifecycle's single initial phase.",
    description: "A game whose domain setup has not completed.",
    expected: "Creation may succeed into ready or fail with a safe failure code.",
    state: { phase: "creating" },
  },
  ready: {
    id: "lifecycle-ready",
    purpose: "Verify turn selection after successful creation.",
    description: "A fully created game waiting for its first turn assignment.",
    expected: "The lifecycle may begin the player turn, begin the opponent turn, or abandon.",
    state: { phase: "ready" },
  },
  playerTurn: {
    id: "lifecycle-player-turn",
    purpose: "Verify transitions while local player input is permitted.",
    description: "The player owns the current game turn.",
    expected: "The lifecycle may commit, pause, complete, abandon, or fail.",
    state: { phase: "player-turn" },
  },
  opponentTurn: {
    id: "lifecycle-opponent-turn",
    purpose: "Verify the handoff before requesting an opponent move.",
    description: "The opponent owns the turn, but no request has started.",
    expected: "Requesting a move enters awaiting-opponent; lifecycle exits remain controlled.",
    state: { phase: "opponent-turn" },
  },
  awaitingOpponent: {
    id: "lifecycle-awaiting-opponent",
    purpose: "Verify behavior while an opponent proposal is outstanding.",
    description: "The lifecycle is waiting for an opponent move proposal.",
    expected: "The lifecycle may commit a proposal, degrade, pause, complete, abandon, or fail.",
    state: { phase: "awaiting-opponent" },
  },
  paused: {
    id: "lifecycle-paused-player-turn",
    purpose: "Verify that pause records an exact, valid resume target.",
    description: "A paused player turn with no active lifecycle progress.",
    expected: "Resume restores player-turn; abandonment and failure remain possible.",
    state: { phase: "paused", resumePhase: "player-turn" },
  },
  degraded: {
    id: "lifecycle-degraded",
    purpose: "Verify recoverable loss of an opponent provider capability.",
    description: "The game remains valid while opponent capability is degraded.",
    expected: "Provider recovery returns to awaiting-opponent without reopening unrelated phases.",
    state: { phase: "degraded" },
  },
  failed: {
    id: "lifecycle-failed",
    purpose: "Verify safe failure metadata and explicit recovery entry.",
    description: "The lifecycle stopped after a typed opponent-provider failure.",
    expected: "Recovery may begin with the safe failure code preserved, or the game may abandon.",
    state: {
      phase: "failed",
      failure: { code: "opponent-provider-failed" },
    },
  },
  recovery: {
    id: "lifecycle-recovery",
    purpose: "Verify controlled restoration after failure.",
    description: "Recovery is underway for a prior opponent-provider failure.",
    expected: "Recovery may restore only an approved live phase, fail again, or abandon.",
    state: {
      phase: "recovery",
      failure: { code: "opponent-provider-failed" },
    },
  },
  completed: {
    id: "lifecycle-completed",
    purpose: "Verify permanent completion terminality.",
    description: "The game lifecycle has completed.",
    expected: "Every further lifecycle event is rejected without changing this state.",
    state: { phase: "completed" },
  },
  abandoned: {
    id: "lifecycle-abandoned",
    purpose: "Verify permanent abandonment terminality.",
    description: "The game lifecycle has been abandoned.",
    expected: "Every further lifecycle event is rejected without changing this state.",
    state: { phase: "abandoned" },
  },
} as const satisfies Record<string, GameLifecycleFixture>;
