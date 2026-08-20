/**
 * Opponent profile catalogue.
 *
 * Profiles are the only supported way to express opponent strength. Engine internals
 * are never exposed directly in the interface, and no profile claims to match a human
 * rating exactly: the labels describe an experience, and the copy says so plainly.
 */

export const OPPONENT_PROFILE_IDS = [
  "newcomer",
  "casual",
  "club",
  "strong",
  "expert",
  "maximum",
] as const;

export type OpponentProfileId = (typeof OPPONENT_PROFILE_IDS)[number];

export interface OpponentStrengthSettings {
  /** Stockfish `UCI_Elo`. Omitted when the profile plays at full strength. */
  readonly limitStrengthElo?: number;
  readonly moveTimeMs: number;
  /** Stockfish `Skill Level`, 0 to 20. */
  readonly skillLevel: number;
  readonly searchDepth?: number;
}

export interface OpponentThinkTime {
  readonly maximumMs: number;
  readonly minimumMs: number;
}

export interface OpponentProfile {
  readonly description: string;
  readonly id: OpponentProfileId;
  readonly label: string;
  readonly strength: OpponentStrengthSettings;
  readonly thinkTime: OpponentThinkTime;
}

function profile(
  id: OpponentProfileId,
  label: string,
  description: string,
  strength: OpponentStrengthSettings,
  thinkTime: OpponentThinkTime,
): OpponentProfile {
  return Object.freeze({
    description,
    id,
    label,
    strength: Object.freeze(strength),
    thinkTime: Object.freeze(thinkTime),
  });
}

export const OPPONENT_PROFILES: readonly OpponentProfile[] = Object.freeze([
  profile(
    "newcomer",
    "Newcomer",
    "Plays quickly and misses tactics. A calm place to learn the pieces.",
    { limitStrengthElo: 1320, moveTimeMs: 250, skillLevel: 1 },
    { maximumMs: 900, minimumMs: 350 },
  ),
  profile(
    "casual",
    "Casual",
    "Sees short tactics but still leaves openings. Good for relaxed games.",
    { limitStrengthElo: 1550, moveTimeMs: 350, skillLevel: 4 },
    { maximumMs: 1_200, minimumMs: 450 },
  ),
  profile(
    "club",
    "Club",
    "Punishes loose pieces and simple tactics. A real fight for most players.",
    { limitStrengthElo: 1850, moveTimeMs: 500, skillLevel: 9 },
    { maximumMs: 1_600, minimumMs: 550 },
  ),
  profile(
    "strong",
    "Strong",
    "Plays accurate, purposeful chess and rarely gives material away.",
    { limitStrengthElo: 2200, moveTimeMs: 700, skillLevel: 14 },
    { maximumMs: 2_000, minimumMs: 700 },
  ),
  profile(
    "expert",
    "Expert",
    "Very hard to outplay. Expect precise defence and sharp counterplay.",
    { limitStrengthElo: 2600, moveTimeMs: 900, skillLevel: 18 },
    { maximumMs: 2_400, minimumMs: 800 },
  ),
  profile(
    "maximum",
    "Maximum",
    "No strength limit at all. The engine plays as well as this device allows.",
    { moveTimeMs: 1_500, skillLevel: 20 },
    { maximumMs: 2_600, minimumMs: 900 },
  ),
]);

export const DEFAULT_OPPONENT_PROFILE_ID: OpponentProfileId = "club";

/**
 * Shown wherever a profile is chosen. Strength labels describe engine settings, not
 * measured human ratings, and the interface must keep saying so.
 */
export const OPPONENT_STRENGTH_DISCLOSURE =
  "Strength names describe engine settings, not human ratings. Caissa never claims an exact rating match.";

export function isOpponentProfileId(value: unknown): value is OpponentProfileId {
  return typeof value === "string" && OPPONENT_PROFILE_IDS.includes(value as OpponentProfileId);
}

export function findOpponentProfile(id: OpponentProfileId): OpponentProfile {
  const found = OPPONENT_PROFILES.find((candidate) => candidate.id === id);
  if (!found) throw new Error("Unknown opponent profile identifier.");
  return found;
}
