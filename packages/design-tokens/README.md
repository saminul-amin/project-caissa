# Design Tokens

Framework-independent semantic CSS variables from `docs/03_design_system.md`. This package
contains foundation colours, typography, spacing, radii, shadows, and motion only; it
intentionally has no component styles.

Import the public stylesheet with:

```css
@import "@caissa/design-tokens/tokens.css";
```

## Typography

The stylesheet declares `@font-face` rules for the three product faces and ships them in
`./fonts` as latin-subset variable WOFF2 files, so the application never fetches type from
the network:

| Face           | Role                         | File                                     |
| -------------- | ---------------------------- | ---------------------------------------- |
| Source Serif 4 | display, verdicts, headlines | `source-serif-4-latin-wght-normal.woff2` |
| Manrope        | interface, controls, clocks  | `manrope-latin-wght-normal.woff2`        |
| JetBrains Mono | notation and diagnostics     | `jetbrains-mono-latin-wght-normal.woff2` |

All three are licensed under the SIL Open Font License 1.1; the licence texts are in
`LICENSES/` at the repository root and the provenance is in `THIRD_PARTY_NOTICES.md`.

## Runtime palettes

The dark palette in `tokens.css` paints the first frame. The light palette and the board
palettes are applied at runtime by `apps/web/src/app/theme-palettes.ts`, which must declare
every colour token that this file declares.
