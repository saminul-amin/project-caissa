import {
  DEFAULT_USER_PREFERENCES,
  type PreferencesRepository,
  type UserPreferences,
} from "../persistence";

export type PreferencesLoadResult =
  | { readonly preferences: UserPreferences; readonly status: "loaded" }
  | {
      readonly preferences: UserPreferences;
      readonly recoveredFields: readonly string[];
      readonly status: "recovered";
    }
  | { readonly preferences: UserPreferences; readonly status: "unavailable" };

export type PreferencesSaveResult =
  | { readonly preferences: UserPreferences; readonly status: "saved" }
  | { readonly status: "rejected" }
  | { readonly status: "unavailable" };

export interface PreferencesService {
  load(): Promise<PreferencesLoadResult>;
  reset(): Promise<PreferencesSaveResult>;
  save(preferences: UserPreferences): Promise<PreferencesSaveResult>;
}

export interface CreatePreferencesServiceOptions {
  readonly preferencesRepository: PreferencesRepository;
}

/**
 * Preferences never block play.
 *
 * When storage is unavailable the product continues with defaults and says so, rather
 * than failing a screen the player only opened to change a board colour.
 */
export function createPreferencesService(
  options: CreatePreferencesServiceOptions,
): PreferencesService {
  return Object.freeze({
    async load(): Promise<PreferencesLoadResult> {
      let read: Awaited<ReturnType<PreferencesRepository["getPreferences"]>>;
      try {
        read = await options.preferencesRepository.getPreferences();
      } catch {
        return unavailableLoad();
      }

      switch (read.status) {
        case "found":
        case "default":
          return Object.freeze({ preferences: read.preferences, status: "loaded" as const });
        case "recovered":
          return Object.freeze({
            preferences: read.preferences,
            recoveredFields: Object.freeze([...read.recoveredFields].map(String)),
            status: "recovered" as const,
          });
        case "failed":
          return unavailableLoad();
      }
    },

    async reset(): Promise<PreferencesSaveResult> {
      try {
        const written = await options.preferencesRepository.resetPreferences();
        return mapWrite(written, DEFAULT_USER_PREFERENCES);
      } catch {
        return Object.freeze({ status: "unavailable" as const });
      }
    },

    async save(preferences: UserPreferences): Promise<PreferencesSaveResult> {
      try {
        const written = await options.preferencesRepository.savePreferences(preferences);
        return mapWrite(written, preferences);
      } catch {
        return Object.freeze({ status: "unavailable" as const });
      }
    },
  });
}

function mapWrite(
  result: Awaited<ReturnType<PreferencesRepository["savePreferences"]>>,
  preferences: UserPreferences,
): PreferencesSaveResult {
  switch (result.status) {
    case "saved":
      return Object.freeze({ preferences, status: "saved" as const });
    case "rejected":
      return Object.freeze({ status: "rejected" as const });
    case "failed":
      return Object.freeze({ status: "unavailable" as const });
  }
}

function unavailableLoad(): PreferencesLoadResult {
  return Object.freeze({
    preferences: DEFAULT_USER_PREFERENCES,
    status: "unavailable" as const,
  });
}
