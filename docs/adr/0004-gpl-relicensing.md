# ADR-0004 — GPL-3.0-or-later for the Distributed Work

**Status:** Accepted
**Date:** 2026-08-19

## Context

Caissa distributes Stockfish (GPL-3.0-or-later) inside its published package. A combined
distributed work that includes GPL-licensed code must itself be offered under compatible
terms. The repository previously declared `UNLICENSED`, which is incompatible with shipping.

## Decision

Caissa is licensed GPL-3.0-or-later. `LICENSE` carries the full text, `LICENSES/GPL-3.0.txt`
carries the engine's copy, and `THIRD_PARTY_NOTICES.md` records the exact engine build,
upstream, version, and digests. The Settings screen discloses the engine and its licence to
players, and the repository URL is the corresponding-source offer.

## Alternatives

- Keep the source closed and load the engine from a third-party CDN: rejected; the combined
  work is still distributed together, and it would add a runtime dependency on someone
  else's hosting.
- Ship no engine: rejected; see ADR-0002 and ADR-0003.

## Consequences

- Anyone who receives the package is entitled to the corresponding source.
- Future dependencies must remain GPL-compatible; the licence gate keeps the permissive
  allowlist for npm packages so a copyleft dependency cannot enter unnoticed.
- Closed-source distribution or monetisation would require replacing the engine first.
