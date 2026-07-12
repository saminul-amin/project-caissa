# Chess Core

Framework-independent TypeScript domain foundation for Caissa's authoritative chess rules,
deterministic clocks, controlled lifecycle phases, and game-session authority.

## Public API

The package intentionally exports four domain boundaries.

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

### Game session and controller

- Immutable `GameConfiguration`, participant, position-snapshot, move-record, result, request,
  and `GameSession` models
- `createGameController` and the injected, framework-independent `GameController` boundary
- Commands for start, human moves, external-opponent requests and proposals, typed opponent
  failure, pause, resume, and abandonment
- Discriminated command results with stable rejection reasons and immutable domain events
- A non-negative session revision incremented exactly once per applied state change

The controller is the sole writer of session state. Human moves and external-opponent proposals
share one private authoritative commit path: validate context, settle the clock, apply through
`ChessRulesPort`, commit the clock, refresh position/history, adjudicate terminal state, route the
next participant, increment the revision once, and publish safe event data. If integration fails
after the rules authority applies a move, the controller rolls it back through the approved
`undo` boundary and preserves its prior session.

External proposals are bound to the request ID, expected FEN, session-relative ply, captured
revision, and requested color. A mismatch rejects the proposal without changing rules, clock,
lifecycle, history, result, revision, or request state. An awaiting request is preserved across
pause/resume; proposals are rejected while paused and may be committed after the exact
awaiting-opponent phase is restored, provided the captured context still matches.

Version 1 timeout policy awards the win to the non-expired color. This is intentionally isolated
in `createTimeoutGameResult`; the current rules boundary does not expose reliable per-color
possible-mating-material adjudication, so this package does not claim full FIDE dead-position
handling for timeout results.

## Architecture boundary

Only `src/adapters/chess-js-rules-adapter.ts` imports `chess.js`. Domain contracts, clocks,
lifecycle logic, sessions, and the controller do not depend on React, browser APIs, Zustand,
Dexie, network clients, persistence, timers, engines, or application infrastructure. The adapter
and controller never expose the mutable `chess.js` instance.

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
- Authoritative immutable sessions, continuous move history, stale-response protection, clock
  timeout, chess terminal adjudication, pause/resume, degraded mode, and abandonment
- Typed domain events as return data without an event bus, persistence, network publication, or
  telemetry transport

Curated data is exposed separately through `@caissa/test-fixtures/chess-rules`,
`@caissa/test-fixtures/clocks`, `@caissa/test-fixtures/game-lifecycle`, and
`@caissa/test-fixtures/game-controller` for tests only.

`chess.js` 1.4.0 remains the sole production dependency. It is BSD-2-Clause licensed and is
isolated behind the adapter.

## Test

From the repository root:

```text
pnpm --filter @caissa/chess-core test
```

The command runs deterministic Vitest coverage with measured package-level thresholds.

Persistence, UI, public undo, Stockfish, Maia, provider communication, and the review system are
not implemented in this package. The rules adapter's `undo` operation is used only for private
rollback after an unexpected failed controller commit.
