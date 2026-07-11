# Chess Core

Framework-independent TypeScript domain boundary for Caissa's authoritative standard-chess rules.

## Public API

The package intentionally exports:

- Validated primitives and parsers for `Color`, `Square`, `Fen`, `Pgn`, `SanMove`, `UciMove`, `Ply`, `GameId`, and `RequestId`
- `ChessRulesPort`, immutable chess position and move contracts, terminal-state contracts, and discriminated move/undo results
- `moveInputFromUci` for safely converting external UCI text into a typed move request
- `ChessJsRulesAdapter`, the approved implementation of `ChessRulesPort`
- Typed `DomainValidationError` and `ChessRulesAdapterError` boundaries

## Architecture boundary

Only `src/adapters/chess-js-rules-adapter.ts` imports `chess.js`. Domain contracts and primitives do not depend on React, browser APIs, Zustand, Dexie, network clients, timers, engines, or application infrastructure. The adapter never exposes its mutable `chess.js` instance.

Illegal chess moves are normal discriminated results and preserve the prior FEN. Malformed external FEN, PGN, SAN, UCI, square, identifier, and ply values are rejected at runtime.

## Supported behavior

- Standard initial position and FEN loading
- Legal move discovery and application
- SAN and UCI move representations
- Castling, en passant, and explicit promotion
- Undo
- Check, checkmate, stalemate, insufficient material, threefold repetition, and fifty-move-rule detection
- PGN export and PGN loading for round-trip reconstruction

The curated regression data is exposed separately from `@caissa/test-fixtures/chess-rules` for tests only.

`chess.js` 1.4.0 is the sole production dependency. It is BSD-2-Clause licensed and is isolated behind the adapter so it can be upgraded or replaced without changing domain consumers.

## Test

From the repository root:

```text
pnpm --filter @caissa/chess-core test
```

The focused command runs deterministic Vitest coverage with measured package-level thresholds. The `GameController`, clocks, persistence, UI, Stockfish, and Maia are not implemented in this package yet.
