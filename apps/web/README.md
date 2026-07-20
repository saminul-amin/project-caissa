# Caissa Web

React, TypeScript, Vite, React Router, and Tailwind CSS v4 foundation for the Caissa browser application.

The current app contains an accessible shell, explicit placeholder routes, local persistence, and
framework-independent application services for session autosave, startup restoration, explicit
recovery, completed-game history, and PGN export descriptors. These services are not connected to
React or routes. The app has no chessboard, global state, Stockfish, Maia client, analytics, or
production UI.

Persistence provides storage-independent repository ports, an injectable Version 1 Dexie
database, corruption-safe adapters, and deterministic `fake-indexeddb` tests. Application services
consume only repository ports and chess-core APIs; React, Zustand, and browser lifecycle handling
remain deferred.

## Commands

From the repository root:

```text
pnpm --filter @caissa/web dev
pnpm --filter @caissa/web typecheck
pnpm --filter @caissa/web test:coverage
pnpm --filter @caissa/web build
```
