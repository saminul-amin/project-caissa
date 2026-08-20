# ADR-0002 — Bundled Single-Threaded Stockfish

**Status:** Accepted
**Date:** 2026-08-19

## Context

Caissa needs an opponent and an analysis engine that work inside an itch.io iframe.
Threaded WebAssembly needs `SharedArrayBuffer`, which needs cross-origin isolation, which
the embedding page controls rather than the game. Technical specification §11.5 already
requires that the itch.io build not assume those headers.

## Decision

Vendor `stockfish-18-lite-single` (Stockfish.js 18.0.8) into `apps/web/public/engine/` and
run it in a classic Web Worker. The build is single-threaded and needs WebAssembly SIMD but
not `SharedArrayBuffer`. The exact bytes are pinned by SHA-256 in
`scripts/check-engine-assets.mjs` and verified in the quality gate.

`apps/web/src/infrastructure/engine` owns the worker lifecycle, the UCI protocol, request
identity, cancellation, and capability detection. Nothing above that boundary parses engine
text.

## Alternatives

- Threaded `stockfish.wasm`: rejected; unusable without cross-origin isolation.
- Downloading the engine at build time: rejected; makes builds depend on a network fetch.
- Full-size NNUE build: rejected; 113 MB is unreasonable for a web download.

## Consequences

- The engine adds about 7.3 MB to the package and is fetched once per visit.
- Browsers without WebAssembly SIMD cannot use engine features; Caissa detects this and
  disables engine games instead of failing silently.
- Distributing Stockfish makes the whole distributed work GPL-3.0-or-later. See ADR-0004.
