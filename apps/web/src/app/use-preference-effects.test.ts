import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_USER_PREFERENCES } from "../application/settings";
import {
  projectPreferenceAttributes,
  resolveReducedMotion,
  resolveTheme,
  usePreferenceEffects,
  useReducedMotion,
} from "./use-preference-effects";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubColorScheme(prefersLight: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: prefersLight,
      removeEventListener: vi.fn(),
    })),
  );
}

function stubMediaQueries(matching: readonly string[]) {
  const listeners = new Map<string, (event: { readonly matches: boolean }) => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      addEventListener: (
        _type: string,
        listener: (event: { readonly matches: boolean }) => void,
      ) => {
        listeners.set(query, listener);
      },
      matches: matching.includes(query),
      removeEventListener: vi.fn(),
    })),
  );
  return listeners;
}

describe("resolveReducedMotion", () => {
  it("honours an explicit choice regardless of the system preference", () => {
    expect(
      resolveReducedMotion({ ...DEFAULT_USER_PREFERENCES, reducedMotion: "reduce" }, false),
    ).toBe(true);
    expect(
      resolveReducedMotion({ ...DEFAULT_USER_PREFERENCES, reducedMotion: "no-preference" }, true),
    ).toBe(false);
  });

  it("follows the system preference only when the player chose to", () => {
    expect(
      resolveReducedMotion({ ...DEFAULT_USER_PREFERENCES, reducedMotion: "system" }, true),
    ).toBe(true);
    expect(
      resolveReducedMotion({ ...DEFAULT_USER_PREFERENCES, reducedMotion: "system" }, false),
    ).toBe(false);
  });
});

describe("useReducedMotion", () => {
  it("reads the system reduced-motion query and follows later changes", () => {
    const listeners = stubMediaQueries(["(prefers-reduced-motion: reduce)"]);
    const { result } = renderHook(() =>
      useReducedMotion({ ...DEFAULT_USER_PREFERENCES, reducedMotion: "system" }),
    );

    expect(result.current).toBe(true);
    act(() => {
      listeners.get("(prefers-reduced-motion: reduce)")?.({ matches: false });
    });
    expect(result.current).toBe(false);
  });

  it("treats a runtime without media queries as full motion unless the player reduced it", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(
      renderHook(() => useReducedMotion({ ...DEFAULT_USER_PREFERENCES, reducedMotion: "system" }))
        .result.current,
    ).toBe(false);
    expect(
      renderHook(() => useReducedMotion({ ...DEFAULT_USER_PREFERENCES, reducedMotion: "reduce" }))
        .result.current,
    ).toBe(true);
  });
});

describe("resolveTheme", () => {
  it("honours an explicit choice regardless of the system preference", () => {
    expect(resolveTheme({ ...DEFAULT_USER_PREFERENCES, theme: "light" }, false)).toBe("light");
    expect(resolveTheme({ ...DEFAULT_USER_PREFERENCES, theme: "dark" }, true)).toBe("dark");
  });

  it("follows the system preference only when the player chose to", () => {
    expect(resolveTheme({ ...DEFAULT_USER_PREFERENCES, theme: "system" }, true)).toBe("light");
    expect(resolveTheme({ ...DEFAULT_USER_PREFERENCES, theme: "system" }, false)).toBe("dark");
  });
});

describe("projectPreferenceAttributes", () => {
  it("maps every visual preference to a document attribute", () => {
    expect(projectPreferenceAttributes(DEFAULT_USER_PREFERENCES, false)).toEqual({
      "data-board-theme": "caissa-classic",
      "data-coordinates": "visible",
      "data-motion": "system",
      "data-piece-set": "caissa-staunton",
      "data-theme": "dark",
    });
  });

  it("never emits the system value, so no palette depends on a media query", () => {
    expect(
      projectPreferenceAttributes({ ...DEFAULT_USER_PREFERENCES, theme: "system" }, true)[
        "data-theme"
      ],
    ).toBe("light");
  });

  it("expresses hidden coordinates explicitly rather than by omission", () => {
    expect(
      projectPreferenceAttributes(
        { ...DEFAULT_USER_PREFERENCES, coordinatesVisible: false },
        false,
      )["data-coordinates"],
    ).toBe("hidden");
  });
});

describe("usePreferenceEffects", () => {
  it("applies the attributes to the document root", () => {
    stubColorScheme(false);
    renderHook(() => {
      usePreferenceEffects({
        ...DEFAULT_USER_PREFERENCES,
        boardTheme: "linen",
        reducedMotion: "reduce",
        theme: "dark",
      });
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-board-theme")).toBe("linen");
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduce");
  });

  it("updates the document when preferences change", () => {
    stubColorScheme(false);
    const { rerender } = renderHook(
      (preferences) => {
        usePreferenceEffects(preferences);
      },
      { initialProps: DEFAULT_USER_PREFERENCES },
    );

    rerender({ ...DEFAULT_USER_PREFERENCES, theme: "light" });

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("resolves a system preference of light to a concrete light theme", () => {
    stubColorScheme(true);
    renderHook(() => {
      usePreferenceEffects({ ...DEFAULT_USER_PREFERENCES, theme: "system" });
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("falls back to dark in a runtime without media queries", () => {
    vi.stubGlobal("matchMedia", undefined);
    renderHook(() => {
      usePreferenceEffects({ ...DEFAULT_USER_PREFERENCES, theme: "system" });
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
