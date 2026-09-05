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
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

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
  return useMediaQuery(LIGHT_SCHEME_QUERY);
}

/**
 * Whether motion should be reduced right now: an explicit preference wins, and "system"
 * defers to the operating system. Components that drive animation from script (piece
 * movement, the board flip, smooth scrolling) read this; CSS reads the matching document
 * attribute and media query instead.
 */
export function resolveReducedMotion(
  preferences: UserPreferences,
  systemPrefersReduced: boolean,
): boolean {
  if (preferences.reducedMotion === "reduce") return true;
  if (preferences.reducedMotion === "no-preference") return false;
  return systemPrefersReduced;
}

export function useReducedMotion(preferences: UserPreferences): boolean {
  const systemPrefersReduced = useMediaQuery(REDUCED_MOTION_QUERY);
  return resolveReducedMotion(preferences, systemPrefersReduced);
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchesQuery(query));

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const list = matchMedia(query);
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    list.addEventListener("change", listener);
    return () => {
      list.removeEventListener("change", listener);
    };
  }, [query]);

  return matches;
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

function matchesQuery(query: string): boolean {
  if (typeof matchMedia !== "function") return false;
  try {
    return matchMedia(query).matches;
  } catch {
    return false;
  }
}
