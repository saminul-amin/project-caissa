# Read-Only Game Shell

The game shell renders immutable session and persistence projections from `CaissaAppProvider`. It presents player panels, unformatted domain clock values as accessible clock text, SAN move history, lifecycle/result status, a labeled board, and textual position context.

`components/ChessBoardAdapter.tsx` is the only production import boundary for react-chessboard. The adapter accepts application-owned FEN and orientation and disables interaction, drawing, and animation. No external board-library types escape the adapter.

The shell cannot start, move, pause, resume, undo, restart, abandon, or contact an opponent. Its only coordinator-backed action is a bounded `retryPersistence` request when the facade reports a retryable warning.
