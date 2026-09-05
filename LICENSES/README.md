# Third-Party Licenses

License texts for artifacts distributed inside a Caissa release package.

| File                         | Applies to                                                         |
| ---------------------------- | ------------------------------------------------------------------ |
| `GPL-3.0.txt`                | Stockfish.js 18.0.8 (`apps/web/public/engine/`), and Caissa itself |
| `OFL-1.1-source-serif-4.txt` | Source Serif 4 (`packages/design-tokens/fonts/`)                   |
| `OFL-1.1-manrope.txt`        | Manrope (`packages/design-tokens/fonts/`)                          |
| `OFL-1.1-jetbrains-mono.txt` | JetBrains Mono (`packages/design-tokens/fonts/`)                   |

Caissa is licensed GPL-3.0-or-later because it distributes Stockfish. The project-level
copy of the same text is in `LICENSE` at the repository root.

Provenance, exact versions, digests, and corresponding-source obligations are recorded in
`THIRD_PARTY_NOTICES.md`. `pnpm engine:check` verifies the pinned digests on every run of
the quality gate.

Caissa distributes three font files under the SIL Open Font License 1.1, listed above.
It distributes no image, sound, or model files. Licence texts for any further asset must be
added here before it is introduced.
