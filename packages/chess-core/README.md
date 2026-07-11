# Chess Core

Framework-independent TypeScript domain foundation for Caissa's authoritative chess rules,
deterministic clocks, and controlled game lifecycle phases.

## Public API

The package intentionally exports three domain boundaries.

### Chess rules

- Validated primitives and parsers for `Color`, `Square`, `Fen`, `Pgn`, `SanMove`, `UciMove`,
  `Ply`, `GameId`, and `RequestId`
- `ChessRulesPort`, immutable position and move contracts, terminal-state contracts, and
  discriminated move/undo results
- `moveInputFromUci` for converting external UCI text into a typed move request
- `ChessJsRulesAdapter`, the approved implementation of `ChessRulesPort`
- Typed `DomainValidationError` and `ChessRulesAdapterError` boundaries

### Deterministic clocks

- Validated `ClockDurationMs`, `ClockIncrementMs`, and `MonotonicTimestampMs` primitives
- `TimeControl` modes for `untimed`, `sudden-death`, and Fischer `increment`
- Discriminated `ClockState` values for untimed, idle, running, paused, stopped, and expired
  clocks
- Pure `createClock`, `startClock`, `snapshotClock`, `commitClockMove`, `pauseClock`,
  `resumeClock`, and `stopClock` operations
- `projectClockDisplay` for producing unformatted read-only clock values
- Discriminated applied, expired, and rejected transition results

Every clock calculation receives a caller-supplied `MonotonicTimestampMs`. The domain never
calls `Date.now()`, `performance.now()`, timer callbacks, animation frames, or another ambient
time source. Delayed snapshots charge the complete elapsed interval, timestamps may not move
backward, and remaining time is clamped at zero.

### Game lifecycle

- `GamePhase` and the discriminated `GameLifecycleState` union
- Typed `GameLifecycleEvent` values rather than arbitrary target-state mutation
- `createGameLifecycleState` and `transitionGameLifecycle`
- Safe failure codes and recovery context without raw exception objects
- Permanent completed and abandoned terminal phases

Pause records the exact approved phase to resume. Invalid lifecycle events return the exact
current state with a stable rejection reason.

## Architecture boundary

Only `src/adapters/chess-js-rules-adapter.ts` imports `chess.js`. Domain contracts, clocks, and
lifecycle logic do not depend on React, browser APIs, Zustand, Dexie, network clients,
persistence, timers, engines, or application infrastructure. The adapter never exposes its
mutable `chess.js` instance.

Illegal chess moves and invalid clock/lifecycle transitions are normal discriminated results
that preserve the prior state. Malformed external values are rejected by runtime parsers.

## Supported behavior

- Standard chess position loading, legal moves, special moves, undo, terminal-state detection,
  and PGN/FEN round trips
- Untimed, sudden-death, and increment clocks
- Exact elapsed-time charging independent of callback frequency
- Exact-boundary expiration, increment, pause/resume, stop, snapshot, and display projection
- Event-driven creation, turns, opponent waiting, commit, pause, degradation, failure, recovery,
  completion, and abandonment lifecycle phases

Curated data is exposed separately through `@caissa/test-fixtures/chess-rules`,
`@caissa/test-fixtures/clocks`, and `@caissa/test-fixtures/game-lifecycle` for tests only.

`chess.js` 1.4.0 remains the sole production dependency. It is BSD-2-Clause licensed and is
isolated behind the adapter.

## Test

From the repository root:

```text
pnpm --filter @caissa/chess-core test
```

The command runs deterministic Vitest coverage with measured package-level thresholds. The
`GameController`, persistence, UI, Stockfish, Maia, and review system are not implemented in
this package. Clock and lifecycle services are foundations for the future `GameController`, not
an implementation of it.
