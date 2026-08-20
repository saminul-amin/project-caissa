import { useEffect, useState } from "react";

import type { UserPreferences } from "../application";
import { applyThemePalette, type ResolvedTheme } from "./theme-palettes";

export type { ResolvedTheme };

export interface PreferenceDocumentAttributes {
  readonly "data-board-theme": string;
  readonly "data-coordinates": string;
  readonly "data-motion": string;
  readonly "data-piece-set": string;
  /** Always a concrete theme; "system" is resolved before it reaches the document. */
  readonly "data-theme": ResolvedTheme;
}

const LIGHT_SCHEME_QUERY = "(prefers-color-scheme: light)";

/**
 * Preferences become document attributes rather than component props so that board,
 * layout, and motion styling stay in CSS and never need to thread through the tree.
 *
 * The system theme is resolved here rather than with a `prefers-color-scheme` media query,
 * because a CSS media block that also carries the palette can be hoisted by the production
 * minifier and leak one palette into the other. One concrete attribute cannot.
 */
export function projectPreferenceAttributes(
  preferences: UserPreferences,
  prefersLight: boolean,
): PreferenceDocumentAttributes {
  return Object.freeze({
    "data-board-theme": preferences.boardTheme,
    "data-coordinates": preferences.coordinatesVisible ? "visible" : "hidden",
    "data-motion": preferences.reducedMotion,
    "data-piece-set": preferences.pieceSet,
    "data-theme": resolveTheme(preferences, prefersLight),
  });
}

export function resolveTheme(preferences: UserPreferences, prefersLight: boolean): ResolvedTheme {
  if (preferences.theme === "light") return "light";
  if (preferences.theme === "dark") return "dark";
  return prefersLight ? "light" : "dark";
}

export function usePrefersLightScheme(): boolean {
  const [prefersLight, setPrefersLight] = useState(() => matchesLightScheme());

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia(LIGHT_SCHEME_QUERY);
    const listener = (event: MediaQueryListEvent) => {
      setPrefersLight(event.matches);
    };
    query.addEventListener("change", listener);
    return () => {
      query.removeEventListener("change", listener);
    };
  }, []);

  return prefersLight;
}

export function usePreferenceEffects(preferences: UserPreferences): void {
  const prefersLight = usePrefersLightScheme();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const attributes = projectPreferenceAttributes(preferences, prefersLight);
    root.setAttribute("data-board-theme", attributes["data-board-theme"]);
    root.setAttribute("data-coordinates", attributes["data-coordinates"]);
    root.setAttribute("data-motion", attributes["data-motion"]);
    root.setAttribute("data-piece-set", attributes["data-piece-set"]);
    root.setAttribute("data-theme", attributes["data-theme"]);
    applyThemePalette(root, {
      boardTheme: preferences.boardTheme,
      theme: attributes["data-theme"],
    });
  }, [preferences, prefersLight]);
}

function matchesLightScheme(): boolean {
  if (typeof matchMedia !== "function") return false;
  try {
    return matchMedia(LIGHT_SCHEME_QUERY).matches;
  } catch {
    return false;
  }
}
