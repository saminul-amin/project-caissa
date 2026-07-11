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

Future fixture categories include PGN games, Stockfish transcripts, Maia responses, persistence migrations, and guided-review evidence.

Every fixture records its purpose, expected behavior, and relevant source/provenance information. Fixtures must not import the chess-core implementation they verify.
