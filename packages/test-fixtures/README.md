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

Future fixture categories include PGN games, Stockfish transcripts, Maia responses, persistence migrations, and guided-review evidence.

Every fixture records its purpose, expected behavior, and relevant source/provenance information. Fixtures must not import the chess-core implementation they verify.
