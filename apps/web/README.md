# Caissa Web

React, TypeScript, Vite, React Router, and Tailwind CSS v4 foundation for the Caissa browser application.

The current app contains an accessible shell, explicit placeholder routes, and a local-persistence
foundation. It has no chessboard, gameplay integration, global state, Stockfish, Maia client,
analytics, or production UI.

Persistence provides storage-independent repository ports, an injectable Version 1 Dexie
database, corruption-safe adapters, and deterministic `fake-indexeddb` tests. It is not connected
to React, autosave, or bootstrap restoration.

## Commands

From the repository root:

```text
pnpm --filter @caissa/web dev
pnpm --filter @caissa/web typecheck
pnpm --filter @caissa/web test:coverage
pnpm --filter @caissa/web build
```
