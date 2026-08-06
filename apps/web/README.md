# Caissa Web

Caissa Web is the browser-first React, TypeScript, Vite, React Router, and Tailwind CSS v4
application. The current play experience connects the verified chess domain and local persistence
services to an accessible startup gate, local-game setup flow, and playable local
human-versus-human shell.

## Application ownership

`createBrowserCaissaApplication` is the production composition root. One owned graph creates one
IndexedDB database, its repository adapters, application services, chess-rules factory, secure
game-ID generator, cross-navigation monotonic clock, and cleanup function. `CaissaAppProvider`
runs startup restoration once, owns the current coordinator privately, and exposes only immutable
session projections and bounded application actions. Feature components cannot access the
database, controller, rules adapter, or raw repositories.

Tests inject memory repositories, deterministic clocks, and deterministic identifiers through
`createCaissaApplication`; test factories are not exported from production entry points.

## Startup, recovery, and new games

Ordinary routes remain behind the startup gate until the active local slot has been checked. A
valid checkpoint is restored without starting or resuming it. Corrupted or unsupported data
produces a safe recovery experience with retry, continue-without-restoring, and confirmed
active-slot discard. Continue does not delete data, and discard never clears completed history,
reviews, preferences, or analysis cache.

`NewGameService` validates external setup values and supports only local human-versus-human play.
Approved controls are untimed, 3+2, five-minute sudden death, and ten-minute sudden death.
Creation builds a standard-position controller in `ready`, saves its first checkpoint, and never
starts the controller or clock. A save failure retains the in-memory game with an honest warning.

## Routes

- `/` - product home with setup or resume entry points
- `/play/new` - validated local-game setup
- `/play` - restored or newly created interactive game shell, or a safe empty state
- `/history` - explicit placeholder
- `/settings` - explicit placeholder
- unmatched routes - safe not-found screen

## Interactive game shell

A ready game starts only through the visible `Begin Game` action. Click, touch, drag, and keyboard
input all produce the same validated application move intent. Legal candidates come from the
private coordinator/controller boundary, never from UI reconstruction. Promotion pauses
submission until the player explicitly chooses Queen, Rook, Bishop, or Knight from candidates
that are actually legal.

`ChessBoardAdapter` is the only production module that imports `react-chessboard`. It translates
library callbacks, refuses speculative drop rendering, and stores neither legality nor position.
A semantic 8x8 keyboard grid provides roving focus, orientation-aware arrows, Enter/Space
activation, Escape cancellation, and piece/square labels. The promotion dialog traps and restores
focus.

Running-clock display uses the injected monotonic projection and a disposable presentation
ticker; it never mutates domain time or persistence. The browser clock uses integer
`performance.timeOrigin + performance.now()` so a restored running clock continues across
navigation without timestamp regression. Version 1 consumes elapsed closed-page time, displays
zero without mutating the game, and lets the next authoritative command adjudicate timeout.
Persistence warnings remain distinct from chess outcomes and retry durability without replaying
gameplay.

## Architecture boundaries

- Features depend on the provider/facade and immutable read models, not Dexie, IndexedDB,
  repositories, chess.js, browser crypto, or performance APIs.
- The setup feature asks `NewGameService` to create a game; it does not construct a controller.
- The game shell uses only bounded legal-read, explicit-start, human-move, and persistence-retry
  actions. It never receives the mutable coordinator.
- No Zustand or other global-state library is used.

## Commands

From the repository root:

```text
corepack pnpm --filter @caissa/web dev
corepack pnpm --filter @caissa/web typecheck
corepack pnpm --filter @caissa/web test:coverage
corepack pnpm --filter @caissa/web build
corepack pnpm test:e2e
```

Pause/resume, undo, restart, abandonment, resignation, draw offers, external-opponent execution,
Stockfish, Maia, guided review, authentication, multiplayer, analytics, cloud sync, and deployment
are not implemented.
