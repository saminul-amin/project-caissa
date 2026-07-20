import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_USER_PREFERENCES, type UserPreferences } from "../../application/persistence";
import { PREFERENCES_KEY, PREFERENCES_RECORD_VERSION } from "./storage-records";
import {
  createPersistenceTestContext,
  destroyPersistenceTestContext,
  type PersistenceTestContext,
} from "../../test/persistence-test-kit";

describe("DexiePreferencesRepository", () => {
  let context: PersistenceTestContext | undefined;

  afterEach(async () => {
    if (context) await destroyPersistenceTestContext(context.database);
    context = undefined;
  });

  async function setup(): Promise<PersistenceTestContext> {
    context = await createPersistenceTestContext();
    return context;
  }

  it("returns immutable defaults when preferences are missing", async () => {
    const { preferencesRepository } = await setup();

    expect(await preferencesRepository.getPreferences()).toEqual({
      preferences: DEFAULT_USER_PREFERENCES,
      status: "default",
    });
    expect(Object.isFrozen(DEFAULT_USER_PREFERENCES)).toBe(true);
  });

  it("saves valid supported preferences", async () => {
    const { database, preferencesRepository } = await setup();

    expect(await preferencesRepository.savePreferences(customPreferences())).toEqual({
      status: "saved",
    });
    expect(await database.preferences.count()).toBe(1);
  });

  it("reads previously saved preferences", async () => {
    const { preferencesRepository } = await setup();
    const preferences = customPreferences();
    await preferencesRepository.savePreferences(preferences);

    expect(await preferencesRepository.getPreferences()).toEqual({
      preferences,
      status: "found",
    });
  });

  it("resets preferences to the missing-record default behavior", async () => {
    const { preferencesRepository } = await setup();
    await preferencesRepository.savePreferences(customPreferences());

    expect(await preferencesRepository.resetPreferences()).toEqual({ status: "saved" });
    expect((await preferencesRepository.getPreferences()).status).toBe("default");
  });

  it("preserves valid fields during field-level corruption recovery", async () => {
    const { database, preferencesRepository } = await setup();
    await putPreferences(database, {
      ...customPreferences(),
      boardTheme: "unsupported-board",
      moveSoundEnabled: "yes",
    });

    const result = await preferencesRepository.getPreferences();

    expect(result.status).toBe("recovered");
    if (result.status === "recovered") {
      expect(result.preferences.theme).toBe("dark");
      expect(result.preferences.coordinatesVisible).toBe(false);
    }
  });

  it("falls invalid fields back to their individual defaults", async () => {
    const { database, preferencesRepository } = await setup();
    await putPreferences(database, {
      ...customPreferences(),
      boardTheme: "unsupported-board",
      moveSoundEnabled: "yes",
    });

    const result = await preferencesRepository.getPreferences();

    expect(result.status).toBe("recovered");
    if (result.status === "recovered") {
      expect(result.preferences.boardTheme).toBe(DEFAULT_USER_PREFERENCES.boardTheme);
      expect(result.preferences.moveSoundEnabled).toBe(DEFAULT_USER_PREFERENCES.moveSoundEnabled);
    }
  });

  it("returns an explicit recovery indication naming invalid fields", async () => {
    const { database, preferencesRepository } = await setup();
    await putPreferences(database, { ...customPreferences(), theme: "future-theme" });

    const result = await preferencesRepository.getPreferences();

    expect(result).toMatchObject({ recoveredFields: ["theme"], status: "recovered" });
  });

  it("does not let an unknown enum value escape runtime validation", async () => {
    const { database, preferencesRepository } = await setup();
    await putPreferences(database, { ...customPreferences(), defaultTimeControl: "99+99" });

    const result = await preferencesRepository.getPreferences();

    expect(result.status).toBe("recovered");
    if (result.status === "recovered") {
      expect(result.preferences.defaultTimeControl).toBe(
        DEFAULT_USER_PREFERENCES.defaultTimeControl,
      );
    }
  });

  it("isolates stored preferences from caller mutation", async () => {
    const { preferencesRepository } = await setup();
    const mutable = { ...customPreferences() };
    await preferencesRepository.savePreferences(mutable);
    mutable.theme = "light";

    const result = await preferencesRepository.getPreferences();

    expect(result.status).toBe("found");
    if (result.status === "found") expect(result.preferences.theme).toBe("dark");
  });

  it("validates the preferences record version and keeps the raw record", async () => {
    const { database, preferencesRepository } = await setup();
    await database.table<unknown, string>("preferences").put({
      key: PREFERENCES_KEY,
      recordVersion: 99,
      updatedAt: 1_000,
      values: customPreferences(),
    });

    const result = await preferencesRepository.getPreferences();

    expect(result).toMatchObject({ status: "recovered" });
    if (result.status === "recovered") expect(result.recoveredFields).toContain("recordVersion");
    expect(await database.preferences.count()).toBe(1);
  });
});

function customPreferences(): UserPreferences {
  return {
    boardOrientation: "black",
    boardTheme: "linen",
    coordinatesVisible: false,
    defaultOpponent: "human",
    defaultTimeControl: "3+2",
    moveSoundEnabled: false,
    pieceSet: "caissa-staunton",
    reducedMotion: "reduce",
    soundEnabled: false,
    theme: "dark",
  };
}

async function putPreferences(
  database: PersistenceTestContext["database"],
  values: Readonly<Record<string, unknown>>,
): Promise<void> {
  await database.table<unknown, string>("preferences").put({
    key: PREFERENCES_KEY,
    recordVersion: PREFERENCES_RECORD_VERSION,
    updatedAt: 1_000,
    values,
  });
}
