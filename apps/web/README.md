# Caissa Web

Caissa Web is the browser-first React, TypeScript, Vite, React Router, and Tailwind CSS v4 application. The current play-experience foundation connects the verified chess domain and local persistence services to an accessible startup gate, local-game setup flow, and read-only game shell.

## Application ownership

`createBrowserCaissaApplication` is the production composition root. One owned graph creates one IndexedDB database, its repository adapters, application services, chess-rules factory, secure game-ID generator, monotonic clock, and cleanup function. `CaissaAppProvider` runs startup restoration once, owns the current coordinator privately, and exposes only immutable session projections and bounded application actions. Feature components cannot access the database or raw repositories.

Tests inject memory repositories, deterministic clocks, and deterministic identifiers through `createCaissaApplication`; test factories are not exported from production entry points.

## Startup and recovery

Ordinary routes remain behind the startup gate until the active local slot has been checked. A valid checkpoint is restored without starting or resuming it. Corrupted or unsupported data produces a safe recovery experience with retry, continue-without-restoring, and confirmed active-slot discard. Continue does not delete data, and discard never clears completed history, reviews, preferences, or analysis cache. Storage unavailability and unexpected failure have distinct, non-technical fallbacks.

## New games

`NewGameService` validates external setup values and supports only local human-versus-human play. Approved controls are untimed, 3+2, five-minute sudden death, and ten-minute sudden death. Undo policy and White/Black orientation are stored explicitly. A valid existing game requires literal replacement confirmation; corrupted data is routed to recovery.

Creation builds a standard-position controller in `ready`, saves its first checkpoint, and returns a coordinator. It never starts the controller or clock. A save failure still returns the in-memory ready game as `created-unsaved`, with honest refresh-durability messaging and one bounded persistence retry.

## Routes

- `/` — product home with setup or resume entry points
- `/play/new` — validated local-game setup
- `/play` — restored or newly created read-only game shell, or a safe empty state
- `/history` — explicit placeholder
- `/settings` — explicit placeholder
- unmatched routes — safe not-found screen

## Read-only shell

The shell projects the authoritative FEN, lifecycle, participants, clocks, result, SAN history, and persistence state. `ChessBoardAdapter` is the only production module that imports react-chessboard. Dragging, drawing, and all move callbacks are disabled. A labeled board is paired with text position context and a piece listing so meaning is not conveyed only through the canvas-like visual board.

Running-clock display uses the injected monotonic-time projection and a disposable presentation ticker; it never mutates domain time. Paused and ready values stay fixed. Clean persistence is quiet, while unsaved and finalization-pending states are explicit and retryable without rerunning gameplay logic.

## Architecture boundaries

- Features depend on the provider/facade and immutable read models, not Dexie, IndexedDB, storage records, repositories, chess.js, browser crypto, or `performance.now`.
- The setup feature asks `NewGameService` to create a game; it does not construct `GameController`.
- The game shell may call only persistence retry. It has no start, move, opponent, pause, resume, undo, restart, or abandon path.
- The composition root is the only layer that wires application services to production adapters.
- No Zustand or other global-state library is used; provider-local state is sufficient for this slice.

## Commands

From the repository root:

```text
corepack pnpm --filter @caissa/web dev
corepack pnpm --filter @caissa/web typecheck
corepack pnpm --filter @caissa/web test:coverage
corepack pnpm --filter @caissa/web build
corepack pnpm test:e2e
```

Move interaction, game controls, Stockfish, Maia, guided review, authentication, multiplayer, analytics, cloud sync, and deployment are not implemented.
