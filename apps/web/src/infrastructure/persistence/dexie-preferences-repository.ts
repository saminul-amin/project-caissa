import {
  BOARD_ORIENTATION_PREFERENCES,
  BOARD_THEME_PREFERENCES,
  DEFAULT_OPPONENT_PREFERENCES,
  DEFAULT_TIME_CONTROL_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
  PIECE_SET_PREFERENCES,
  REDUCED_MOTION_PREFERENCES,
  THEME_PREFERENCES,
  parseEpochTimestampMs,
  parseUserPreferences,
  type PreferenceRecoveryField,
  type PreferencesReadResult,
  type PreferencesRepository,
  type PreferencesWriteResult,
  type UserPreferences,
  type WallClock,
} from "../../application/persistence";
import type { CaissaDatabase } from "./database";
import { mapPersistenceError, mapTransactionError } from "./error-mapper";
import {
  PREFERENCES_KEY,
  PREFERENCES_RECORD_VERSION,
  type PreferencesStorageRecord,
} from "./storage-records";
import { cloneForStorage } from "./validation";

const preferenceFields = Object.freeze([
  "boardOrientation",
  "boardTheme",
  "coordinatesVisible",
  "defaultOpponent",
  "defaultTimeControl",
  "moveSoundEnabled",
  "pieceSet",
  "reducedMotion",
  "soundEnabled",
  "theme",
] as const satisfies readonly (keyof UserPreferences)[]);

export class DexiePreferencesRepository implements PreferencesRepository {
  constructor(
    private readonly database: CaissaDatabase,
    private readonly wallClock: WallClock,
  ) {}

  async getPreferences(): Promise<PreferencesReadResult> {
    try {
      const stored: unknown = await this.database.preferences.get(PREFERENCES_KEY);
      if (stored === undefined) {
        return { preferences: DEFAULT_USER_PREFERENCES, status: "default" };
      }

      if (!isRecord(stored) || stored.recordVersion !== PREFERENCES_RECORD_VERSION) {
        return {
          preferences: DEFAULT_USER_PREFERENCES,
          recoveredFields: Object.freeze(["recordVersion", ...preferenceFields]),
          status: "recovered",
        };
      }
      if (
        stored.key !== PREFERENCES_KEY ||
        !isRecord(stored.values) ||
        !isValidTimestamp(stored.updatedAt)
      ) {
        return {
          preferences: DEFAULT_USER_PREFERENCES,
          recoveredFields: preferenceFields,
          status: "recovered",
        };
      }

      try {
        const preferences = parseUserPreferences(stored.values);
        return { preferences, status: "found" };
      } catch {
        const recovery = recoverPreferences(stored.values);
        return {
          preferences: recovery.preferences,
          recoveredFields: recovery.recoveredFields,
          status: "recovered",
        };
      }
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "preferences.read"), status: "failed" };
    }
  }

  async savePreferences(preferences: UserPreferences): Promise<PreferencesWriteResult> {
    try {
      const validated = parseUserPreferences(preferences);
      const record: PreferencesStorageRecord = cloneForStorage({
        key: PREFERENCES_KEY,
        recordVersion: PREFERENCES_RECORD_VERSION,
        updatedAt: this.wallClock.nowEpochMs(),
        values: { ...validated },
      });
      await this.database.transaction("rw", this.database.preferences, async () => {
        await this.database.preferences.put(record);
      });
      return { status: "saved" };
    } catch (error: unknown) {
      if (isPreferenceValidationError(error)) {
        return { reason: "validation-failed", status: "rejected" };
      }
      return { error: mapTransactionError(error, "preferences.save"), status: "failed" };
    }
  }

  async resetPreferences(): Promise<PreferencesWriteResult> {
    try {
      await this.database.preferences.delete(PREFERENCES_KEY);
      return { status: "saved" };
    } catch (error: unknown) {
      return { error: mapPersistenceError(error, "preferences.reset"), status: "failed" };
    }
  }
}

function recoverPreferences(values: Readonly<Record<string, unknown>>): {
  readonly preferences: UserPreferences;
  readonly recoveredFields: readonly PreferenceRecoveryField[];
} {
  const recoveredFields: PreferenceRecoveryField[] = [];
  const take = <Value>(
    field: keyof UserPreferences,
    value: unknown,
    isValid: (candidate: unknown) => candidate is Value,
    fallback: Value,
  ): Value => {
    if (isValid(value)) return value;
    recoveredFields.push(field);
    return fallback;
  };

  const preferences: UserPreferences = Object.freeze({
    boardOrientation: take(
      "boardOrientation",
      values.boardOrientation,
      isMember(BOARD_ORIENTATION_PREFERENCES),
      DEFAULT_USER_PREFERENCES.boardOrientation,
    ),
    boardTheme: take(
      "boardTheme",
      values.boardTheme,
      isMember(BOARD_THEME_PREFERENCES),
      DEFAULT_USER_PREFERENCES.boardTheme,
    ),
    coordinatesVisible: take(
      "coordinatesVisible",
      values.coordinatesVisible,
      isBoolean,
      DEFAULT_USER_PREFERENCES.coordinatesVisible,
    ),
    defaultOpponent: take(
      "defaultOpponent",
      values.defaultOpponent,
      isMember(DEFAULT_OPPONENT_PREFERENCES),
      DEFAULT_USER_PREFERENCES.defaultOpponent,
    ),
    defaultTimeControl: take(
      "defaultTimeControl",
      values.defaultTimeControl,
      isMember(DEFAULT_TIME_CONTROL_PREFERENCES),
      DEFAULT_USER_PREFERENCES.defaultTimeControl,
    ),
    moveSoundEnabled: take(
      "moveSoundEnabled",
      values.moveSoundEnabled,
      isBoolean,
      DEFAULT_USER_PREFERENCES.moveSoundEnabled,
    ),
    pieceSet: take(
      "pieceSet",
      values.pieceSet,
      isMember(PIECE_SET_PREFERENCES),
      DEFAULT_USER_PREFERENCES.pieceSet,
    ),
    reducedMotion: take(
      "reducedMotion",
      values.reducedMotion,
      isMember(REDUCED_MOTION_PREFERENCES),
      DEFAULT_USER_PREFERENCES.reducedMotion,
    ),
    soundEnabled: take(
      "soundEnabled",
      values.soundEnabled,
      isBoolean,
      DEFAULT_USER_PREFERENCES.soundEnabled,
    ),
    theme: take("theme", values.theme, isMember(THEME_PREFERENCES), DEFAULT_USER_PREFERENCES.theme),
  });

  return { preferences, recoveredFields: Object.freeze(recoveredFields) };
}

function isMember<const Values extends readonly string[]>(values: Values) {
  return (candidate: unknown): candidate is Values[number] =>
    typeof candidate === "string" && values.includes(candidate);
}

function isBoolean(candidate: unknown): candidate is boolean {
  return typeof candidate === "boolean";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTimestamp(value: unknown): boolean {
  try {
    parseEpochTimestampMs(value);
    return true;
  } catch {
    return false;
  }
}

function isPreferenceValidationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "ZodError" || error.name === "PersistenceValidationError")
  );
}
