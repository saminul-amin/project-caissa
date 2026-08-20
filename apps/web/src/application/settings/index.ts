/**
 * Settings vocabulary for the interface.
 *
 * Preference values are declared next to their storage schema, but screens must not import
 * repository ports. This module re-exports only the value types and option lists a settings
 * screen legitimately needs.
 */
export {
  BOARD_ORIENTATION_PREFERENCES,
  BOARD_THEME_PREFERENCES,
  DEFAULT_OPPONENT_PREFERENCES,
  DEFAULT_TIME_CONTROL_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
  PIECE_SET_PREFERENCES,
  REDUCED_MOTION_PREFERENCES,
  THEME_PREFERENCES,
  type BoardOrientationPreference,
  type BoardThemePreference,
  type DefaultOpponentPreference,
  type DefaultTimeControlPreference,
  type PieceSetPreference,
  type ReducedMotionPreference,
  type ThemePreference,
  type UserPreferences,
} from "../persistence/preferences-repository";
