# Third-Party Licenses

License texts for artifacts distributed inside a Caissa release package.

| File          | Applies to                                                         |
| ------------- | ------------------------------------------------------------------ |
| `GPL-3.0.txt` | Stockfish.js 18.0.8 (`apps/web/public/engine/`), and Caissa itself |

Caissa is licensed GPL-3.0-or-later because it distributes Stockfish. The project-level
copy of the same text is in `LICENSE` at the repository root.

Provenance, exact versions, digests, and corresponding-source obligations are recorded in
`THIRD_PARTY_NOTICES.md`. `pnpm engine:check` verifies the pinned digests on every run of
the quality gate.

Caissa distributes no font, image, sound, or model files. Licence texts for such assets
must be added here before any of them is introduced.
