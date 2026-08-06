# Third-Party Notices

Caissa Phase 1 uses open-source development and runtime dependencies recorded in `package.json`, `pnpm-lock.yaml`, and `apps/maia-service/pyproject.toml`.

No Stockfish binary or source, Maia package or model, font file, sound, icon set, or image asset is distributed in this phase.

The local-persistence foundation adds:

- Dexie 4.4.4 (Apache-2.0) as the approved IndexedDB adapter.
- Zod 4.4.3 (MIT) for runtime validation of untrusted durable records.
- fake-indexeddb 6.2.5 (Apache-2.0), development-only, for deterministic repository tests.

The read-only play-experience foundation adds:

- react-chessboard 5.12.0 (MIT), from <https://github.com/Clariity/react-chessboard>, to render the approved visual chessboard behind Caissa's replaceable `ChessBoardAdapter` boundary.
- @dnd-kit/core 6.3.1, @dnd-kit/modifiers 9.0.0, @dnd-kit/utilities 3.2.2, and @dnd-kit/accessibility 3.1.1 (MIT), transitive dependencies of react-chessboard. Caissa disables dragging and drawing in this milestone and does not import these packages directly.
- tslib 2.8.1 (0BSD), a transitive TypeScript runtime helper used by the approved board dependency graph.

Before any third-party runtime artifact is distributed, this notice and `LICENSES/` must record its exact name, version or commit, upstream source, license, modifications, and corresponding-source obligations where applicable.

This file is a compliance inventory foundation and is not legal advice.
