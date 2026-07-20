import { z } from "zod";

import type { PersistenceError } from "./errors";
import type { PersistenceWriteResult } from "./results";

export const THEME_PREFERENCES = ["system", "dark", "light"] as const;
export const BOARD_THEME_PREFERENCES = ["caissa-classic", "linen"] as const;
export const PIECE_SET_PREFERENCES = ["caissa-staunton"] as const;
export const BOARD_ORIENTATION_PREFERENCES = ["player", "white", "black"] as const;
export const REDUCED_MOTION_PREFERENCES = ["system", "reduce", "no-preference"] as const;
export const DEFAULT_TIME_CONTROL_PREFERENCES = ["untimed", "3+2", "5+0", "10+0", "15+10"] as const;
export const DEFAULT_OPPONENT_PREFERENCES = ["human", "external-opponent"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type BoardThemePreference = (typeof BOARD_THEME_PREFERENCES)[number];
export type PieceSetPreference = (typeof PIECE_SET_PREFERENCES)[number];
export type BoardOrientationPreference = (typeof BOARD_ORIENTATION_PREFERENCES)[number];
export type ReducedMotionPreference = (typeof REDUCED_MOTION_PREFERENCES)[number];
export type DefaultTimeControlPreference = (typeof DEFAULT_TIME_CONTROL_PREFERENCES)[number];
export type DefaultOpponentPreference = (typeof DEFAULT_OPPONENT_PREFERENCES)[number];

export interface UserPreferences {
  readonly boardOrientation: BoardOrientationPreference;
  readonly boardTheme: BoardThemePreference;
  readonly coordinatesVisible: boolean;
  readonly defaultOpponent: DefaultOpponentPreference;
  readonly defaultTimeControl: DefaultTimeControlPreference;
  readonly moveSoundEnabled: boolean;
  readonly pieceSet: PieceSetPreference;
  readonly reducedMotion: ReducedMotionPreference;
  readonly soundEnabled: boolean;
  readonly theme: ThemePreference;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = Object.freeze({
  boardOrientation: "player",
  boardTheme: "caissa-classic",
  coordinatesVisible: true,
  defaultOpponent: "external-opponent",
  defaultTimeControl: "5+0",
  moveSoundEnabled: true,
  pieceSet: "caissa-staunton",
  reducedMotion: "system",
  soundEnabled: true,
  theme: "system",
});

const preferencesSchema = z
  .object({
    boardOrientation: z.enum(BOARD_ORIENTATION_PREFERENCES),
    boardTheme: z.enum(BOARD_THEME_PREFERENCES),
    coordinatesVisible: z.boolean(),
    defaultOpponent: z.enum(DEFAULT_OPPONENT_PREFERENCES),
    defaultTimeControl: z.enum(DEFAULT_TIME_CONTROL_PREFERENCES),
    moveSoundEnabled: z.boolean(),
    pieceSet: z.enum(PIECE_SET_PREFERENCES),
    reducedMotion: z.enum(REDUCED_MOTION_PREFERENCES),
    soundEnabled: z.boolean(),
    theme: z.enum(THEME_PREFERENCES),
  })
  .strict();

export type PreferenceRecoveryField = keyof UserPreferences | "recordVersion";

export type PreferencesReadResult =
  | {
      readonly preferences: UserPreferences;
      readonly status: "default" | "found";
    }
  | {
      readonly preferences: UserPreferences;
      readonly recoveredFields: readonly PreferenceRecoveryField[];
      readonly status: "recovered";
    }
  | { readonly error: PersistenceError; readonly status: "failed" };

export type PreferencesWriteResult = PersistenceWriteResult;

export interface PreferencesRepository {
  getPreferences(): Promise<PreferencesReadResult>;
  savePreferences(preferences: UserPreferences): Promise<PreferencesWriteResult>;
  resetPreferences(): Promise<PreferencesWriteResult>;
}

export function parseUserPreferences(value: unknown): UserPreferences {
  const parsed = preferencesSchema.parse(value);
  return Object.freeze(parsed);
}
