import type { BoardThemePreference } from "../application";

/** A theme that has been resolved to a concrete palette; never "system". */
export type ResolvedTheme = "dark" | "light";

/**
 * Runtime palettes.
 *
 * The dark palette in `@caissa/design-tokens` is the stylesheet default and paints the
 * first frame. Switching themes at runtime then writes the chosen palette onto the root as
 * inline custom properties.
 *
 * This is deliberate rather than incidental: overriding the tokens with an attribute-scoped
 * rule does not reliably re-resolve `var()` in elements that already exist, which showed up
 * as a half-themed page after a theme change. An inline write always invalidates.
 */
export type ThemeVariables = Readonly<Record<string, string>>;

const DARK_PALETTE: ThemeVariables = Object.freeze({
  "--color-accent": "#3e9d89",
  "--color-accent-hover": "#4eac98",
  "--color-accent-pressed": "#2f7f70",
  "--color-accent-soft": "rgb(62 157 137 / 14%)",
  "--color-bg-app": "#0b0d0f",
  "--color-bg-elevated": "#1b2025",
  "--color-bg-hover": "#22282e",
  "--color-bg-raised": "#15191d",
  "--color-bg-surface": "#101316",
  "--color-border-strong": "#3c454e",
  "--color-border-subtle": "#2a3138",
  "--color-focus": "#9ed4c6",
  "--color-status-error": "#c66d67",
  "--color-status-success": "#4f9c76",
  "--color-status-warning": "#c7963e",
  "--color-text-disabled": "#817a71",
  "--color-text-muted": "#afa79b",
  "--color-text-primary": "#faf8f2",
  "--color-text-secondary": "#cfc7b9",
  "--shadow-board": "0 18px 44px rgb(0 0 0 / 34%)",
  "--shadow-md": "0 10px 30px rgb(0 0 0 / 30%)",
  "--shadow-sm": "0 4px 12px rgb(0 0 0 / 24%)",
});

const LIGHT_PALETTE: ThemeVariables = Object.freeze({
  "--color-accent": "#2f7f70",
  "--color-accent-hover": "#276b5f",
  "--color-accent-pressed": "#1f5449",
  "--color-accent-soft": "rgb(47 127 112 / 12%)",
  "--color-bg-app": "#f6f3ec",
  "--color-bg-elevated": "#eae3d5",
  "--color-bg-hover": "#e2d9c8",
  "--color-bg-raised": "#f1ece1",
  "--color-bg-surface": "#fffdf8",
  "--color-border-strong": "#c2b8a4",
  "--color-border-subtle": "#ded6c6",
  "--color-focus": "#1f5449",
  "--color-status-error": "#a5453f",
  "--color-status-success": "#2f7a55",
  "--color-status-warning": "#9a6f1c",
  "--color-text-disabled": "#9b958a",
  "--color-text-muted": "#6c665c",
  "--color-text-primary": "#1b1a17",
  "--color-text-secondary": "#4a463f",
  "--shadow-board": "0 18px 44px rgb(27 26 23 / 16%)",
  "--shadow-md": "0 10px 30px rgb(27 26 23 / 12%)",
  "--shadow-sm": "0 4px 12px rgb(27 26 23 / 10%)",
});

const BOARD_PALETTES: Readonly<Record<BoardThemePreference, ThemeVariables>> = Object.freeze({
  "caissa-classic": Object.freeze({
    "--color-board-check": "#a85e59",
    "--color-board-dark-square": "#586b62",
    "--color-board-last-move-dark": "#7e8d62",
    "--color-board-last-move-light": "#b8b67e",
    "--color-board-light-square": "#cfc4af",
  }),
  linen: Object.freeze({
    "--color-board-check": "#b96a63",
    "--color-board-dark-square": "#8a7b66",
    "--color-board-last-move-dark": "#9c8f63",
    "--color-board-last-move-light": "#d8cf94",
    "--color-board-light-square": "#ece3d2",
  }),
});

export interface PaletteSelection {
  readonly boardTheme: BoardThemePreference;
  readonly theme: ResolvedTheme;
}

export function selectThemeVariables(selection: PaletteSelection): ThemeVariables {
  return Object.freeze({
    ...(selection.theme === "light" ? LIGHT_PALETTE : DARK_PALETTE),
    ...BOARD_PALETTES[selection.boardTheme],
  });
}

export function applyThemePalette(root: HTMLElement, selection: PaletteSelection): void {
  for (const [name, value] of Object.entries(selectThemeVariables(selection))) {
    root.style.setProperty(name, value);
  }
  root.style.setProperty("color-scheme", selection.theme);
}
