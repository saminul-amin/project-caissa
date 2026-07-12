export interface GameControllerFixtureDocumentation {
  readonly description: string;
  readonly expected: string;
  readonly id: string;
  readonly purpose: string;
}

const standardPosition = { kind: "standard" } as const;
const untimed = { kind: "untimed" } as const;
const human = { kind: "human" } as const;
const externalOpponent = { kind: "external-opponent" } as const;

export const gameConfigurationFixtures = {
  humanWhiteExternalBlack: {
    id: "human-white-external-black",
    purpose: "Verify routing from a local White turn to an external Black turn.",
    description:
      "White is human-controlled and Black is represented by a generic external opponent.",
    expected: "The game starts in player-turn and enters opponent-turn after White commits.",
    configuration: {
      allowUndo: false,
      gameId: "fixture-human-white-external-black",
      initialPosition: standardPosition,
      participants: { black: externalOpponent, white: human },
      timeControl: untimed,
    },
  },
  externalWhiteHumanBlack: {
    id: "external-white-human-black",
    purpose: "Verify that an external White participant can move before a local Black participant.",
    description: "White is a generic external opponent and Black is human-controlled.",
    expected: "The game starts in opponent-turn and routes to player-turn after a valid proposal.",
    configuration: {
      allowUndo: false,
      gameId: "fixture-external-white-human-black",
      initialPosition: standardPosition,
      participants: { black: human, white: externalOpponent },
      timeControl: untimed,
    },
  },
  humanVersusHuman: {
    id: "human-versus-human",
    purpose: "Verify framework-independent local human-versus-human routing.",
    description: "Both colors are human-controlled without accounts or UI state.",
    expected: "Every normal turn uses the player-turn lifecycle phase.",
    configuration: {
      allowUndo: false,
      gameId: "fixture-human-versus-human",
      initialPosition: standardPosition,
      participants: { black: human, white: human },
      timeControl: untimed,
    },
  },
  untimed: {
    id: "controller-untimed",
    purpose: "Verify controller lifecycle behavior without time consumption.",
    description: "A local game whose clock remains explicitly untimed.",
    expected: "Moves and lifecycle commands work without remaining-time balances or expiration.",
    configuration: {
      allowUndo: false,
      gameId: "fixture-untimed",
      initialPosition: standardPosition,
      participants: { black: human, white: human },
      timeControl: untimed,
    },
  },
  suddenDeath: {
    id: "controller-sudden-death",
    purpose: "Verify authoritative elapsed-time charging without increment.",
    description: "Both colors receive five minutes of sudden-death time.",
    expected: "The mover is charged elapsed time and receives no increment.",
    configuration: {
      allowUndo: false,
      gameId: "fixture-sudden-death",
      initialPosition: standardPosition,
      participants: { black: human, white: human },
      timeControl: { initialMs: 300_000, kind: "sudden-death" },
    },
  },
  increment: {
    id: "controller-increment",
    purpose: "Verify Fischer increment after a successful authoritative move.",
    description: "Both colors receive three minutes plus two seconds per committed move.",
    expected: "Elapsed time is charged before a non-expired mover receives 2000 ms.",
    configuration: {
      allowUndo: false,
      gameId: "fixture-increment",
      initialPosition: standardPosition,
      participants: { black: human, white: human },
      timeControl: { incrementMs: 2_000, initialMs: 180_000, kind: "increment" },
    },
  },
  customFen: {
    id: "controller-custom-fen",
    purpose: "Verify a validated custom position starts at session-relative ply zero.",
    description: "A non-terminal king-and-pawn position with White to move.",
    expected:
      "The snapshot preserves the FEN and records ply zero regardless of its fullmove field.",
    configuration: {
      allowUndo: false,
      gameId: "fixture-custom-fen",
      initialPosition: { fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 20", kind: "fen" },
      participants: { black: human, white: human },
      timeControl: untimed,
    },
  },
} as const satisfies Readonly<
  Record<string, GameControllerFixtureDocumentation & { readonly configuration: unknown }>
>;

export const gameSessionFixtures = {
  newlyCreated: sessionFixture(
    "newly-created",
    "creating",
    "Document the construction boundary before creation succeeds.",
  ),
  ready: sessionFixture("ready", "ready", "Represent a validated position waiting for start."),
  humanTurn: sessionFixture(
    "human-turn",
    "player-turn",
    "Represent a human-controlled side to move.",
  ),
  opponentTurn: sessionFixture(
    "opponent-turn",
    "opponent-turn",
    "Represent an external-controlled side before requesting a move.",
  ),
  awaitingOpponent: sessionFixture(
    "awaiting-opponent",
    "awaiting-opponent",
    "Represent one active request with captured stale-response context.",
  ),
  paused: sessionFixture(
    "paused",
    "paused",
    "Represent a game that records its exact resumable phase.",
  ),
  degraded: sessionFixture(
    "degraded",
    "degraded",
    "Represent a preserved game after a typed provider failure.",
  ),
  completedByCheckmate: sessionFixture(
    "completed-checkmate",
    "completed",
    "Represent a decisive chess terminal result and final move history.",
  ),
  completedByDraw: sessionFixture(
    "completed-draw",
    "completed",
    "Represent a chess-rules draw with a 1/2-1/2 result token.",
  ),
  completedByTimeout: sessionFixture(
    "completed-timeout",
    "completed",
    "Represent an expired clock and deterministic Version 1 winner.",
  ),
  abandoned: sessionFixture(
    "abandoned",
    "abandoned",
    "Represent a terminal game with no inferred winner.",
  ),
} as const;

export const opponentProposalFixtures = {
  valid: proposalFixture(
    "valid-proposal",
    "All request context matches and e2e4 is legal.",
    "The controller commits exactly one move and clears the request.",
  ),
  staleRequestId: proposalFixture(
    "stale-request-id",
    "The proposal carries a different request ID.",
    "The exact prior session and rules state are preserved.",
  ),
  staleFen: proposalFixture(
    "stale-fen",
    "The expected FEN differs from the request or current position.",
    "The proposal is rejected as position-mismatch.",
  ),
  stalePly: proposalFixture(
    "stale-ply",
    "The expected session-relative ply differs.",
    "The proposal is rejected as ply-mismatch.",
  ),
  staleRevision: proposalFixture(
    "stale-revision",
    "The revision differs from the value captured for the request.",
    "The proposal is rejected as stale-revision.",
  ),
  wrongColor: proposalFixture(
    "wrong-color",
    "The requested color differs from the request and rules turn.",
    "The proposal is rejected as request-color-mismatch.",
  ),
  illegalMove: proposalFixture(
    "illegal-move",
    "The context matches but e2e5 is illegal from the initial position.",
    "No replacement move is generated and every authority remains unchanged.",
  ),
} as const;

function sessionFixture(id: string, phase: string, purpose: string) {
  return {
    description: `A documented ${phase} GameSession scenario.`,
    expected:
      "The snapshot is readonly and satisfies lifecycle, clock, result, history, and request invariants.",
    id,
    phase,
    purpose,
  } as const;
}

function proposalFixture(id: string, description: string, expected: string) {
  return {
    description,
    expected,
    id,
    purpose: "Verify opponent proposals are bound to the request that produced them.",
  } as const;
}
