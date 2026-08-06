# Game Setup Feature

This feature renders the approved local two-player setup catalog and delegates validation and creation to `NewGameService` through `CaissaAppProvider`. It owns only transient form, submission, error-summary, and replacement-dialog state.

It does not construct a game controller, inspect persistence, or start a created game. Existing valid games require explicit replacement confirmation; corrupted records are handled by the startup recovery gate.
