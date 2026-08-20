# Third-Party Notices

Caissa is distributed under the GNU General Public License version 3 or later. The full
text is in `LICENSE`. This file records every third-party artifact that ships inside a
Caissa release package, and the obligations attached to it.

## Distributed runtime artifacts

### Stockfish

- **Artifact:** `apps/web/public/engine/stockfish-18-lite-single.js` and
  `apps/web/public/engine/stockfish-18-lite-single.wasm`
- **Distribution:** Stockfish.js 18.0.8, published to npm as `stockfish@18.0.8`
- **Upstream:** <https://github.com/nmrugg/stockfish.js>
- **Engine upstream:** <https://github.com/official-stockfish/Stockfish>
- **Neural network:** small NNUE net by Linmiao Xu, as bundled in the `lite-single` build
- **License:** GPL-3.0-or-later (`LICENSES/GPL-3.0.txt`)
- **Modifications:** none; the files are byte-identical to the published artifacts
- **Integrity:**
  - `stockfish-18-lite-single.js` — SHA-256
    `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391`
  - `stockfish-18-lite-single.wasm` — SHA-256
    `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1`
- **Verification:** `pnpm engine:check` fails the build if either file changes
- **Corresponding source:** distributing Caissa distributes Stockfish. The complete
  corresponding source for both is the project repository together with the upstream
  repositories named above. See `docs/adr/0004-gpl-relicensing.md`.
- **Endorsement:** the Stockfish project does not endorse Caissa.

## Bundled JavaScript dependencies

Runtime dependencies are recorded in `package.json` and `pnpm-lock.yaml` and are gated by
`pnpm licenses:check`, which accepts only 0BSD, MIT, Apache-2.0, BSD-2-Clause,
BSD-3-Clause, and ISC. Notable direct runtime dependencies:

- chess.js 1.4.0 (BSD-2-Clause) — the authoritative rules implementation behind
  `ChessRulesPort`.
- react 19.2.7 and react-dom 19.2.7 (MIT).
- react-router-dom 7.18.1 (MIT).
- react-chessboard 5.12.0 (MIT), from <https://github.com/Clariity/react-chessboard>,
  rendered only behind Caissa's replaceable `ChessBoardAdapter` boundary.
- @dnd-kit/core 6.3.1, @dnd-kit/modifiers 9.0.0, @dnd-kit/utilities 3.2.2, and
  @dnd-kit/accessibility 3.1.1 (MIT) — transitive dependencies of react-chessboard.
- dexie 4.4.4 (Apache-2.0) — the approved IndexedDB adapter.
- zod 4.4.3 (MIT) — runtime validation of untrusted durable records.
- tslib 2.8.1 (0BSD) — TypeScript runtime helpers.

## Assets

Caissa ships no font files, image files, sound files, or piece-image sets.

- Typography uses locally available families with system fallbacks; no webfont is
  downloaded or redistributed.
- Chess pieces are rendered by react-chessboard's built-in vector set.
- Sound effects are synthesised at runtime with the Web Audio API
  (`apps/web/src/infrastructure/audio`). No audio file is distributed.

## Not distributed

No Maia model, Maia package, or remote AI service artifact is distributed. See
`docs/adr/0003-engine-opponent-profiles-replace-maia-in-v1.md`.

This file is a compliance inventory. It is not legal advice.
