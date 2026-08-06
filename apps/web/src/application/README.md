# Web Application Services

The application layer coordinates chess-core authority with storage-independent persistence ports.
It imports neither Dexie nor browser storage APIs and contains no React, Zustand, route, engine,
network, or browser-lifecycle integration.

## Session coordinator

`GameSessionCoordinator` is the only service that couples gameplay commands to autosave. It
serializes mutations, delegates each accepted operation to `GameController`, preserves domain
events, and persists every applied revision. Rejected domain commands do not write.

Nonterminal sessions save an exact `GameSessionCheckpoint`. Completed and abandoned sessions are
converted to an application `CompletedGameRecord` using injected epoch time and authoritative
`GameController.exportPgn()`, then passed directly to transactional `finalizeGame`. A terminal
checkpoint is never written to the active slot first.

Domain success remains successful when storage fails. The coordinator retains the exact latest
active checkpoint or completed record as a private retry candidate, exposes an immutable
`SessionPersistenceState`, and retries only that durable operation. Retry never reruns chess
logic, increments a revision, or emits gameplay events. Commands and retries share a promise
queue so writes cannot overtake revisions; the queue recovers after rejected or failed work.

## New-game creation

`NewGameService` validates untrusted setup values, checks the active slot through `GameRepository`,
and creates only the approved standard-position local human-versus-human configuration. A valid
active record blocks replacement until the caller supplies the literal confirmation token;
corrupted data remains owned by the recovery flow. The service creates a ready controller, writes
its first checkpoint, and returns a coordinator without starting a turn or clock. Failed initial
persistence returns an honest in-memory `created-unsaved` result with the exact checkpoint retained
for bounded retry.

## Startup and recovery

`GameStartupService` reads the active slot through `GameRepository`, restores with a fresh rules
authority, and creates a coordinator only after replay validation succeeds. Restoration does not
rewrite, delete, start, resume, revise, or contact an opponent. Paused and awaiting-opponent state
remains exact.

Corruption, restoration rejection, unsupported checkpoints, and terminal sessions incorrectly
stored as active return safe `recovery-required` metadata. `ActiveGameRecoveryService` supports
retry, explicit typed discard, and continue-without-restoring. Only confirmed discard clears the
active slot; it never clears history, preferences, reviews, or analysis cache. The recovery read
model exposes stable message/action identifiers rather than UI elements or raw payloads.

## History

`GameHistoryService` maps bounded repository summaries and details into immutable application read
models. List items omit PGN, checkpoints, and full history. PGN export returns only a safe
filename, `application/x-chess-pgn`, and authoritative persisted PGN; no Blob, URL, download, or
filesystem operation occurs.

Deleting a game or clearing history requires a typed confirmation. Authoritative game deletion
happens first, followed by best-effort review cleanup. Optional cleanup failure returns an
explicit warning and does not restore deleted history. Active games, preferences, and analysis
cache remain untouched.

## Test

From the repository root:

```text
corepack pnpm --filter @caissa/web typecheck
corepack pnpm --filter @caissa/web test:coverage
```

React components/hooks, Zustand, route integration, browser lifecycle listeners, Stockfish, Maia,
guided review generation, authentication, multiplayer, analytics, cloud sync, HTTP, and deployment
are not implemented by these services.
