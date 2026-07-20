# Local Persistence

Caissa persistence follows an application-port / infrastructure-adapter boundary:

```text
application repository ports
        ↑
Dexie repositories
        ↑
versioned IndexedDB tables
```

React and feature modules consume repository ports only. They do not import `CaissaDatabase`,
Dexie, table names, storage records, or migration functions.

## Version 1 tables

- `activeGames`: singleton `active` slot containing a versioned domain checkpoint
- `completedGames`: completed or abandoned checkpoints, final result, and PGN
- `preferences`: singleton preferences record with field-level recovery
- `reviews`: review-generation metadata only; detailed review payloads are deferred
- `analysisCache`: disposable, versioned analysis payloads keyed by full analysis identity

The database schema and every durable record have independent named Version 1 constants. Future
Dexie versions must add named migration functions and preserve authoritative PGN whenever richer
optional data cannot migrate.

## Trust and corruption policy

IndexedDB data is untrusted. Storage envelopes are validated with Zod, then game checkpoints are
validated by `restoreGameController` using a fresh `ChessJsRulesAdapter`. The repository returns
the validated checkpoint, never a constructed controller. Bootstrap restoration remains a future
application-service responsibility.

Corrupted active/completed records are retained and reported with safe metadata only. Preferences
recover valid fields and substitute defaults for invalid fields without rewriting the record.
Cache records are disposable: expired entries are removed lazily, while malformed entries are
isolated and can be cleared without touching games.

## Transactions and ordering

Active-game replacement is atomic. Completed-game finalization saves the completed record and
clears a matching active slot in one Dexie transaction. An older revision cannot overwrite a newer
completed record; equal or newer revisions upsert. History is bounded (25 by default, 100 maximum),
newest-first by default, and uses `(completedAt, gameId)` for stable cursor ordering.

## Tests

From the repository root:

```text
corepack pnpm --filter @caissa/web test
corepack pnpm --filter @caissa/web test:coverage
```

Tests use isolated `fake-indexeddb` factories and injected wall clocks. Application autosave,
React/Zustand integration, and bootstrap controller restoration are not implemented yet.
