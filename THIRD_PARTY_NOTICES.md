# Third-Party Notices

Caissa Phase 1 uses open-source development and runtime dependencies recorded in `package.json`, `pnpm-lock.yaml`, and `apps/maia-service/pyproject.toml`.

No Stockfish binary or source, Maia package or model, chessboard library, font file, sound, icon set, or image asset is distributed in this phase.

The local-persistence foundation adds:

- Dexie 4.4.4 (Apache-2.0) as the approved IndexedDB adapter.
- Zod 4.4.3 (MIT) for runtime validation of untrusted durable records.
- fake-indexeddb 6.2.5 (Apache-2.0), development-only, for deterministic repository tests.

Before any third-party runtime artifact is distributed, this notice and `LICENSES/` must record its exact name, version or commit, upstream source, license, modifications, and corresponding-source obligations where applicable.

This file is a compliance inventory foundation and is not legal advice.
