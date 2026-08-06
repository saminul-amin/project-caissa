# Interactive Game Shell

The game shell renders immutable session and persistence projections from `CaissaAppProvider`.
It presents player panels, accessible clock text, SAN history, lifecycle/result status, the
authoritative board, and textual position context. A new game remains `ready` until the visible
`Begin Game` action succeeds; navigation, restoration, and board input never auto-start it.

## Interaction authority

`useActiveGameInteraction` is the bounded feature facade. It reads legal candidates through the
provider-owned coordinator and submits human moves with the current authoritative revision. The
provider obtains monotonic time from its injected infrastructure port. Transient selection,
feedback, and promotion choice live in React, but FEN, pieces, history, lifecycle, clock, result,
and revision do not. Selection clears after an authoritative revision, game, lifecycle, or
orientation change.

Input is enabled only for a valid `player-turn` whose side to move is human, with no submission,
promotion, terminal result, pause, or pending finalization. Click/tap source then destination,
drag/drop, and keyboard activation all enter the same `BoardMoveIntent` path. An invalid
destination clears selection with calm feedback. A different movable source replaces selection.
Promotion candidates come only from authoritative legal moves; cancellation returns to idle and
does not submit.

## Accessibility and adapter isolation

`components/ChessBoardAdapter.tsx` is the only production import of `react-chessboard`. It
validates library square strings and emits application intents, but stores no FEN and calculates
no legality. It returns `false` from the synchronous drop callback so the authoritative session
FEN remains the only rendered position.

The transparent semantic 8x8 grid exposes every piece, color, square, and empty square. It uses
one roving tab stop, orientation-aware arrow navigation, Enter/Space activation, and Escape to
clear. The promotion dialog has a name and description, explicit piece choices, Queen-first
focus, a focus trap, Escape/Cancel, and focus restoration. Source, quiet target, capture target,
last move, check, and keyboard focus use distinct token-based shapes or borders, not color alone.

## Clock and persistence policy

The display ticker only asks for a projection and cleans up on unmount; it never commands or
persists. Browser time uses integer `performance.timeOrigin + performance.now()`. Closed-page
time continues to count. A projected zero does not complete a game; the next authoritative
command adjudicates timeout. Applied chess state remains successful when autosave fails, and the
separate persistence warning can retry durability without replaying the move.

## Test

From the repository root:

```text
corepack pnpm --filter @caissa/web test:coverage
corepack pnpm test:e2e
```

Pause/resume, undo, restart, abandonment, resignation, draw offers, external-opponent execution,
Stockfish, Maia, and review controls are intentionally deferred.
