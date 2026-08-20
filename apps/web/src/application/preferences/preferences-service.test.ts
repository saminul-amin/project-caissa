import { describe, expect, it, vi } from "vitest";

import { DEFAULT_USER_PREFERENCES, type PreferencesRepository } from "../persistence";
import { createPreferencesService } from "./preferences-service";

const stored = Object.freeze({ ...DEFAULT_USER_PREFERENCES, theme: "dark" as const });

function createSubject(repository: Partial<PreferencesRepository> = {}) {
  const preferencesRepository: PreferencesRepository = {
    getPreferences: vi.fn(() =>
      Promise.resolve({ preferences: DEFAULT_USER_PREFERENCES, status: "default" as const }),
    ),
    resetPreferences: vi.fn(() => Promise.resolve({ status: "saved" as const })),
    savePreferences: vi.fn(() => Promise.resolve({ status: "saved" as const })),
    ...repository,
  };
  return { preferencesRepository, service: createPreferencesService({ preferencesRepository }) };
}

describe("PreferencesService load", () => {
  it("loads stored preferences", async () => {
    const { service } = createSubject({
      getPreferences: () => Promise.resolve({ preferences: stored, status: "found" }),
    });
    await expect(service.load()).resolves.toEqual({ preferences: stored, status: "loaded" });
  });

  it("treats defaults as a successful load", async () => {
    const { service } = createSubject();
    await expect(service.load()).resolves.toEqual({
      preferences: DEFAULT_USER_PREFERENCES,
      status: "loaded",
    });
  });

  it("reports which fields were recovered", async () => {
    const { service } = createSubject({
      getPreferences: () =>
        Promise.resolve({
          preferences: stored,
          recoveredFields: ["theme", "boardTheme"],
          status: "recovered",
        }),
    });
    await expect(service.load()).resolves.toEqual({
      preferences: stored,
      recoveredFields: ["theme", "boardTheme"],
      status: "recovered",
    });
  });

  it("falls back to defaults when storage fails", async () => {
    const { service } = createSubject({
      getPreferences: () =>
        Promise.resolve({
          error: { code: "storage-unavailable", operation: "preferences.read", retryable: false },
          status: "failed",
        }),
    });
    await expect(service.load()).resolves.toEqual({
      preferences: DEFAULT_USER_PREFERENCES,
      status: "unavailable",
    });
  });

  it("falls back to defaults when the repository throws", async () => {
    const { service } = createSubject({
      getPreferences: () => Promise.reject(new Error("private storage detail")),
    });
    await expect(service.load()).resolves.toMatchObject({ status: "unavailable" });
  });
});

describe("PreferencesService save", () => {
  it("returns the saved preferences", async () => {
    const savePreferences = vi.fn(() => Promise.resolve({ status: "saved" as const }));
    const { service } = createSubject({ savePreferences });
    await expect(service.save(stored)).resolves.toEqual({ preferences: stored, status: "saved" });
    expect(savePreferences).toHaveBeenCalledExactlyOnceWith(stored);
  });

  it("reports a rejected write distinctly from an unavailable store", async () => {
    const rejected = createSubject({
      savePreferences: () => Promise.resolve({ reason: "validation-failed", status: "rejected" }),
    });
    await expect(rejected.service.save(stored)).resolves.toEqual({ status: "rejected" });

    const failed = createSubject({
      savePreferences: () =>
        Promise.resolve({
          error: { code: "quota-exceeded", operation: "preferences.save", retryable: true },
          status: "failed",
        }),
    });
    await expect(failed.service.save(stored)).resolves.toEqual({ status: "unavailable" });
  });

  it("survives a throwing repository", async () => {
    const { service } = createSubject({
      savePreferences: () => Promise.reject(new Error("private storage detail")),
    });
    await expect(service.save(stored)).resolves.toEqual({ status: "unavailable" });
  });
});

describe("PreferencesService reset", () => {
  it("returns the defaults after a successful reset", async () => {
    const { service } = createSubject();
    await expect(service.reset()).resolves.toEqual({
      preferences: DEFAULT_USER_PREFERENCES,
      status: "saved",
    });
  });

  it("reports a failed reset", async () => {
    const { service } = createSubject({
      resetPreferences: () =>
        Promise.resolve({
          error: { code: "unknown-storage-error", operation: "preferences.reset", retryable: true },
          status: "failed",
        }),
    });
    await expect(service.reset()).resolves.toEqual({ status: "unavailable" });
  });

  it("survives a throwing repository", async () => {
    const { service } = createSubject({
      resetPreferences: () => Promise.reject(new Error("private storage detail")),
    });
    await expect(service.reset()).resolves.toEqual({ status: "unavailable" });
  });
});
