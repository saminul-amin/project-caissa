# Test Fixtures

This package contains curated, versioned, framework-independent test data for Caissa.

The current chess-rules fixture module documents:

- Initial position
- Castling and castling through check
- Legal en passant and en passant that exposes the king
- Queen promotion and knight underpromotion
- Check, checkmate, and stalemate
- Insufficient material
- Threefold repetition
- Fifty-move rule

The clock fixture module documents:

- Untimed, five-minute sudden-death, and three-minute/two-second increment controls
- White and Black running clocks
- White and Black pause/resume ownership
- White and Black expiration
- Stopped-clock behavior

The game-lifecycle fixture module documents:

- Creation and ready phases
- Player, opponent, and awaiting-opponent phases
- Paused state with an approved resume target
- Degraded, failed, and recovery phases
- Completed and abandoned terminal phases

The game-controller fixture module documents:

- Human/human and human/external participant configurations
- Untimed, sudden-death, increment, and custom-FEN starts
- Ready, active, awaiting, paused, degraded, completed, and abandoned sessions
- Valid and stale external-opponent proposal contexts

The game-recovery fixture module documents:

- One- and two-ply undo, pending-request cancellation, completed-game reopening, and rejection
- Restart from active, paused, degraded, terminal, failure/recovery, and custom-FEN states
- Version 1 checkpoints for ready, active, waiting, paused, completed, and abandoned sessions
- Independently corrupted move, position, clock, lifecycle, result, request, and revision fields

The persistence fixture module documents:

- Active, completed, preferences, review-metadata, and analysis-cache records
- Version, checkpoint, identifier, revision, timestamp, result, PGN, status, and key corruption
- Safe recovery expectations without secrets, personal information, or generated review content

Future fixture categories include PGN games, Stockfish transcripts, Maia responses, persisted
migration databases, and guided-review evidence.

Every fixture records its purpose, expected behavior, and relevant source/provenance information. Fixtures must not import the chess-core implementation they verify.
