# Chess Core

Framework-independent TypeScript boundary for Caissa chess-domain code.

Phase 1 exports only `CHESS_CORE_VERSION`. Chess rules, game state, clocks, PGN/FEN handling, Stockfish, and Maia are intentionally absent.

This package must never depend on React, Zustand, Dexie, browser APIs, FastAPI, or application infrastructure.
