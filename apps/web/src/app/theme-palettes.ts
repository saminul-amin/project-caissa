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
  "--color-accent-contrast": "#0d0c0a",
  "--color-accent-hover": "#4eac98",
  "--color-accent-pressed": "#2f7f70",
  "--color-accent-soft": "rgb(62 157 137 / 14%)",
  "--color-bg-app": "#0d0c0a",
  "--color-bg-elevated": "#211e1a",
  "--color-bg-hover": "#29251f",
  "--color-bg-raised": "#1a1815",
  "--color-bg-surface": "#14120f",
  "--color-board-frame": "#1a1815",
  "--color-border-strong": "#423b32",
  "--color-border-subtle": "#2c2822",
  "--color-focus": "#9ed4c6",
  "--color-status-error": "#d3766f",
  "--color-status-success": "#5aa57f",
  "--color-status-warning": "#d1a04a",
  "--color-text-disabled": "#7a7166",
  "--color-text-muted": "#a2978a",
  "--color-text-primary": "#f5efe4",
  "--color-text-secondary": "#cfc5b5",
  "--shadow-board": "0 24px 56px rgb(20 14 6 / 46%), 0 2px 6px rgb(20 14 6 / 30%)",
  "--shadow-md": "0 12px 32px rgb(20 14 6 / 36%)",
  "--shadow-piece": "drop-shadow(0 8px 10px rgb(20 14 6 / 45%))",
  "--shadow-sm": "0 2px 8px rgb(20 14 6 / 28%)",
});

const LIGHT_PALETTE: ThemeVariables = Object.freeze({
  "--color-accent": "#276b5f",
  "--color-accent-contrast": "#f3eee4",
  "--color-accent-hover": "#22594f",
  "--color-accent-pressed": "#1c4a42",
  "--color-accent-soft": "rgb(39 107 95 / 12%)",
  "--color-bg-app": "#f3eee4",
  "--color-bg-elevated": "#ece5d8",
  "--color-bg-hover": "#e4dccd",
  "--color-bg-raised": "#f6f1e7",
  "--color-bg-surface": "#fbf8f2",
  "--color-board-frame": "#e2d9c8",
  "--color-border-strong": "#bfb39f",
  "--color-border-subtle": "#ddd4c4",
  "--color-focus": "#1f5449",
  "--color-status-error": "#9c3f3a",
  "--color-status-success": "#2a6a4b",
  "--color-status-warning": "#7a5811",
  "--color-text-disabled": "#9a9286",
  "--color-text-muted": "#645d53",
  "--color-text-primary": "#1c1915",
  "--color-text-secondary": "#4b453d",
  "--shadow-board": "0 24px 56px rgb(76 58 30 / 22%), 0 2px 6px rgb(76 58 30 / 14%)",
  "--shadow-md": "0 12px 32px rgb(76 58 30 / 14%)",
  "--shadow-piece": "drop-shadow(0 8px 10px rgb(76 58 30 / 30%))",
  "--shadow-sm": "0 2px 8px rgb(76 58 30 / 10%)",
});

const BOARD_PALETTES: Readonly<Record<BoardThemePreference, ThemeVariables>> = Object.freeze({
  "caissa-classic": Object.freeze({
    "--color-board-capture": "rgb(16 19 22 / 40%)",
    "--color-board-check": "#a85e59",
    "--color-board-dark-square": "#586b62",
    "--color-board-hint": "rgb(16 19 22 / 26%)",
    "--color-board-last-move-dark": "#7e8d62",
    "--color-board-last-move-light": "#b8b67e",
    "--color-board-light-square": "#cfc4af",
    "--color-board-selected": "#79a895",
  }),
  linen: Object.freeze({
    "--color-board-capture": "rgb(16 19 22 / 40%)",
    "--color-board-check": "#b96a63",
    "--color-board-dark-square": "#8a7b66",
    "--color-board-hint": "rgb(16 19 22 / 26%)",
    "--color-board-last-move-dark": "#9c8f63",
    "--color-board-last-move-light": "#d8cf94",
    "--color-board-light-square": "#ece3d2",
    "--color-board-selected": "#7fa995",
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
