# Caissa — UX Specification

**Document ID:** CAISSA-UXS-001  
**Document Type:** User Experience Specification  
**Version:** 1.0  
**Status:** Approved for Design and Technical Planning  
**Product:** Caissa  
**Product Slogan:** Beyond the Best Move  
**Prepared:** July 2026  
**Owner:** Md. Saminul Amin  
**Primary Audience:** Product, UX/UI, Frontend, AI, QA, and Codex-assisted development

---

## 1. Purpose

This document defines how users should experience Caissa across the full product journey.

It translates the Product Identity and Product Requirements Document into concrete interaction rules, screen behavior, navigation, responsive layouts, accessibility requirements, feedback patterns, and user-facing states.

This specification answers:

- What screens exist?
- How do users move through the product?
- How should the chessboard behave?
- What information appears during play?
- How should game review work?
- What should users feel at each stage?
- How should the application respond on desktop, tablet, and mobile?
- How are loading, error, offline, and engine states communicated?
- Which interaction details are required before implementation is considered complete?

This document does not define source-code architecture, API design, model-serving infrastructure, or database schemas. Those decisions belong to later technical documents.

---

## 2. Related Documents

This specification should be read alongside:

- `00_product_identity.md`
- `01_prd.md`
- `03_design_system.md` — planned
- `04_technical_specification.md` — planned
- `05_architecture_design.md` — planned
- `06_ai_architecture.md` — planned

When documents conflict, the following priority applies:

1. Chess rules and gameplay correctness
2. Product identity and philosophy
3. This UX specification
4. Visual design system
5. Technical implementation preference

---

## 3. Product Experience Statement

Caissa should feel like a calm, thoughtful chess environment that respects both the player and the game.

The product must not feel like:

- A generic online chess clone
- A dense engine dashboard
- A noisy gaming portal
- A technical demonstration with weak usability
- A collection of disconnected features

The intended experience is:

> A premium chess space where every interaction is clear, every visual element has purpose, and every post-game insight helps the player understand rather than feel judged.

---

## 4. UX Goals

### 4.1 Primary Goals

The experience must:

1. Make starting a game effortless.
2. Make board interactions feel immediate and satisfying.
3. Present game information without distracting from the board.
4. Support both casual play and deeper analysis.
5. Explain chess decisions in human-centered language.
6. Encourage reflection without overwhelming the player.
7. Look polished enough to function as a flagship portfolio product.
8. Work reliably on common desktop, tablet, and mobile screens.

### 4.2 Secondary Goals

The experience should:

- Encourage replay through value, not manipulation.
- Help users notice patterns in their own play.
- Make AI opponents feel understandable and believable.
- Allow advanced details without forcing them on every user.
- Remain usable without an account in the initial release.
- Support browser and itch.io distribution consistently.

### 4.3 Non-Goals for Initial Release

The first release will not prioritize:

- Real-time online multiplayer
- Social feeds
- Chat systems
- Large community features
- Complex account management
- Tournament administration
- Monetization flows
- Extensive gamification
- Public ratings or leaderboards

---

## 5. Experience Principles

### 5.1 Board First

During a game, the chessboard is always the primary focus.

Supporting information must not compete visually with:

- Piece positions
- Legal move indicators
- Clocks
- Current turn
- Check state
- Game result

### 5.2 Progressive Disclosure

The interface should show the minimum information needed for the current decision.

Advanced information such as engine lines, centipawn evaluations, move classifications, and alternate variations should be available progressively.

### 5.3 Human Language Before Engine Language

Default feedback should describe ideas, threats, plans, and missed opportunities in understandable terms.

Raw engine notation may be shown as an optional advanced layer.

### 5.4 Calm Feedback

The interface must avoid exaggerated failure feedback.

A blunder can be important without being presented as humiliation.

### 5.5 Consistency Across Input Methods

The core experience must work with:

- Mouse
- Trackpad
- Touch
- Keyboard

No essential function may depend only on hover.

### 5.6 Motion With Meaning

Animations should clarify state changes, preserve spatial continuity, and make interaction feel polished.

Motion must never delay important actions or reduce clarity.

### 5.7 No Dead Ends

Every major state must provide a clear next action.

Examples:

- From game over: review, rematch, or return home
- From an engine error: retry, continue without engine, or return
- From an empty history: start a game
- From a lost connection: continue locally when possible

---

## 6. Target Users

### 6.1 Casual Player

**Profile**

- Plays occasionally
- Understands basic rules
- Wants a beautiful, low-friction game
- May not understand engine terminology

**Needs**

- Fast setup
- Clear controls
- Understandable difficulty selection
- Friendly post-game feedback
- Minimal configuration

### 6.2 Improving Player

**Profile**

- Plays regularly
- Wants to reduce mistakes
- Values review and pattern recognition
- May know openings and tactical terms

**Needs**

- Meaningful game review
- Move explanations
- Evaluation changes
- Alternative moves
- Difficulty aligned with skill level

### 6.3 Chess Enthusiast

**Profile**

- Comfortable with notation and analysis
- Wants deeper insight
- Interested in human-like AI behavior

**Needs**

- Optional advanced engine data
- Variations
- board navigation
- analysis controls
- Maia-style opponent selection

### 6.4 Developer or AI Enthusiast

**Profile**

- Interested in the product as an AI and engineering project
- May inspect opponent behavior or model details

**Needs**

- Clear AI identity
- Explainable opponent settings
- Transparent product behavior
- Credible presentation

---

## 7. Core User Journeys

### 7.1 First-Time User

```text
Landing
  ↓
Understand product promise
  ↓
Choose "Play a Game"
  ↓
Select side, opponent, and time control
  ↓
Start game
  ↓
Complete or exit game
  ↓
See result summary
  ↓
Review one key lesson
  ↓
Choose rematch, deeper review, or home
```

### 7.2 Returning User

```text
Landing or Play Setup
  ↓
Use recent configuration
  ↓
Start game
  ↓
Play
  ↓
Review
  ↓
Play again
```

### 7.3 Post-Game Learning Journey

```text
Game concludes
  ↓
Result acknowledged
  ↓
High-level summary
  ↓
Most important turning point
  ↓
Optional guided review
  ↓
Optional advanced analysis
  ↓
Actionable lesson
  ↓
Play again
```

### 7.4 Interrupted Game Journey

```text
Game in progress
  ↓
User closes or refreshes application
  ↓
Local game state restored
  ↓
User chooses Resume or Abandon
```

---

## 8. Information Architecture

### 8.1 Primary Navigation

Initial release navigation:

- Home
- Play
- Review
- History
- Settings
- About

### 8.2 Navigation Rules

- “Play” is the primary action.
- Review is contextual and should open the latest completed game by default.
- History may be hidden or simplified when no saved games exist.
- Settings must be available both globally and during play.
- The user must be able to return home without losing an active game accidentally.
- Navigation during a live game should be visually quieter than the normal application shell.

### 8.3 Recommended Route Model

```text
/
  Home

/play
  Game setup

/play/game
  Active game

/review/:gameId
  Post-game review

/history
  Saved games

/settings
  Preferences

/about
  Product philosophy and AI information
```

Route names are conceptual. Technical route implementation may differ.

---

## 9. Global Application Shell

### 9.1 Desktop Shell

The desktop shell contains:

- Brand mark and product name
- Primary navigation
- Contextual primary action
- Theme or settings access
- Optional engine status indicator

The shell must not reduce the usable board size excessively.

### 9.2 Mobile Shell

The mobile shell should use:

- Compact top bar
- Collapsible navigation drawer or bottom navigation
- Persistent access to Play
- Minimal brand footprint during a game

### 9.3 Global Status Communication

Global statuses may include:

- Engine loading
- Engine ready
- Offline mode
- Game restored
- Preferences saved
- Analysis unavailable

Status messages should be concise and non-blocking unless action is required.

---

## 10. Home Screen

### 10.1 Purpose

The Home screen introduces Caissa’s philosophy and provides the fastest path into a game.

### 10.2 Required Content

- Product name
- Primary slogan: **Beyond the Best Move**
- Short product promise
- Primary CTA: **Play a Game**
- Secondary CTA: **Discover Human-Like AI**
- Optional preview of the chess experience
- Recent game card when local history exists
- Compact explanation of how Caissa differs

### 10.3 Hero Copy

**Heading**

> Play Chess Beyond the Best Move

**Supporting Copy**

> Face human-like opponents, understand the decisions behind your games, and improve through analysis designed for people—not machines.

### 10.4 Interaction Rules

- The primary CTA must be visible without scrolling on standard desktop and mobile screens.
- The user should reach game setup in one action.
- The Home screen must not become a dashboard full of statistics.
- Returning users may see “Resume Game” above “Play a Game” when an unfinished game exists.

### 10.5 Empty and Returning States

**First visit**

- Show product promise
- Show play action
- Explain human-like AI briefly

**Returning visit**

- Show resume option when applicable
- Show last result or lesson
- Keep play action primary

---

## 11. Game Setup Screen

### 11.1 Purpose

Allow the user to start a game with minimal but meaningful configuration.

### 11.2 Required Controls

- Opponent type
- Opponent strength
- Player color
- Time control
- Optional board theme preview
- Start game button

### 11.3 Opponent Type

Initial options may include:

- Practice AI
- Stockfish-based AI
- Human-like AI — when Maia integration is available
- Local two-player — optional in initial release

### 11.4 Difficulty Presentation

Difficulty should be presented in human terms first.

Preferred examples:

- Beginner
- Developing
- Club Player
- Strong Club Player
- Advanced

A rating value may be shown as supporting information:

```text
Club Player
Approximately 1400 strength
```

Avoid presenting only raw depth, nodes, or engine levels.

### 11.5 Player Color

Options:

- White
- Black
- Random

The selected state must be obvious and keyboard accessible.

### 11.6 Time Controls

Recommended presets:

- No Clock
- 3 + 2
- 5 + 0
- 10 + 0
- 15 + 10
- Custom — future or advanced option

### 11.7 Start Game Behavior

When “Start Game” is selected:

1. Validate settings.
2. Begin loading the selected opponent if needed.
3. Show concise loading state.
4. Enter game screen only when required local systems are ready.
5. If AI loading fails, provide retry or fallback options.

### 11.8 Setup Persistence

The most recently used configuration should be remembered locally.

The interface may offer:

> Play again with previous settings

---

## 12. Active Game Screen

### 12.1 Layout Priority

The required hierarchy is:

1. Chessboard
2. Clocks and current turn
3. Essential game controls
4. Move history
5. Captured pieces
6. Optional engine or evaluation information

### 12.2 Desktop Layout

Recommended structure:

```text
┌─────────────────────────────────────────────────────┐
│ Compact application header                          │
├───────────────┬──────────────────────┬──────────────┤
│ Opponent info │                      │ Move history │
│ Captures      │      Chessboard      │ Game controls│
│ Evaluation    │                      │ Notes/status │
├───────────────┴──────────────────────┴──────────────┤
│ Contextual footer or hidden utility controls        │
└─────────────────────────────────────────────────────┘
```

The exact side allocation may change based on screen width.

### 12.3 Tablet Layout

Recommended structure:

- Board centered
- Player and opponent information above and below board
- Move history in collapsible panel
- Game controls in bottom action row

### 12.4 Mobile Layout

Recommended structure:

```text
Opponent identity and clock
Captured pieces
Chessboard
Player identity and clock
Primary controls
Collapsible move history / analysis drawer
```

On mobile, the board should use the maximum safe width without horizontal scrolling.

---

## 13. Chessboard Interaction Specification

### 13.1 Supported Move Input

Users must be able to move pieces using:

- Drag and drop
- Click piece, then click destination
- Tap piece, then tap destination
- Keyboard selection — accessibility requirement

### 13.2 Selection Behavior

When a piece is selected:

- Highlight its square
- Highlight legal destination squares
- Distinguish capture destinations from empty destinations
- Keep the selected state until:
  - a legal move is made,
  - another movable piece is selected,
  - the user clicks outside the board,
  - the game state changes.

### 13.3 Drag Behavior

- The piece should visually follow the pointer.
- The source square must remain identifiable.
- Legal target feedback should remain visible.
- Invalid drops return the piece smoothly to the source square.
- Dragging must not select page text or trigger browser image dragging.
- Touch dragging must prevent unwanted page scrolling only while interacting with the board.

### 13.4 Legal Move Feedback

Legal moves should be communicated visually without obscuring pieces.

Recommended distinction:

- Empty legal square: subtle centered marker
- Capturable piece: ring or edge emphasis
- Selected square: clear surface highlight
- Last move: separate persistent highlight
- Check: high-priority king-square indication

The design system will define colors and opacity.

### 13.5 Move Animation

- Normal piece movement should be animated.
- Animation duration should be short enough to preserve speed.
- User moves may appear near-instant with spatial continuity.
- AI moves may include a brief thinking-to-move transition.
- Castling should animate both king and rook.
- Promotion should animate only after the user chooses a piece.
- Animation must be reducible or disabled through accessibility settings.

### 13.6 Illegal Moves

The system must prevent illegal moves.

Feedback should be subtle:

- Return piece to source
- Optional soft audio cue
- Optional brief legal-move hint
- No intrusive modal
- No punitive wording

### 13.7 Promotion

When a pawn reaches the final rank:

- Open a promotion chooser adjacent to the promotion square when space permits.
- On mobile, use a compact bottom sheet or overlay.
- Present queen, rook, bishop, and knight.
- Queen may be visually primary but must not be automatically selected without user preference.
- The board is temporarily locked until a choice is made.
- Keyboard users must be able to choose a piece.

### 13.8 Castling

- The king’s legal destination is used as the input target.
- The rook moves automatically.
- Both pieces animate in one coherent transition.

### 13.9 En Passant

- Treat as a normal legal capture.
- Animate the capturing pawn and remove the captured pawn in a clear sequence.
- Move history must record standard notation correctly.

### 13.10 Board Orientation

- By default, the player’s side appears at the bottom.
- Users may flip the board at any time.
- Flipping must not alter game state.
- Coordinates update with orientation.
- Orientation change should animate or crossfade without disorienting the player.

### 13.11 Coordinates

- File and rank coordinates are enabled by default.
- Users may disable them in settings.
- Coordinates must remain legible but visually secondary.

### 13.12 Right-Click Arrows and Highlights

These may be added after the initial release.

When implemented:

- Right-drag draws arrows.
- Right-click toggles square highlights.
- An easy clear action must exist.
- Touch alternatives must be considered before enabling on mobile.

### 13.13 Premove

Premove is not required for the initial AI-focused release.

If later added:

- It must be visually distinct.
- It should execute only when legal after the opponent’s move.
- It must be cancellable.

---

## 14. Player and Opponent Presentation

### 14.1 Required Information

For each side:

- Display name
- Side color
- Difficulty or opponent identity
- Clock
- Captured material summary
- Current turn indicator

### 14.2 AI Identity

AI opponents should not be presented as anonymous technical engines only.

Preferred pattern:

```text
Maia — Club Player
Human-like AI · Approx. 1400
```

Stockfish-based practice may appear as:

```text
Caissa Practice Engine
Balanced · Level 4
```

### 14.3 Thinking State

When the AI is calculating:

- Show a subtle thinking indicator near the opponent identity.
- Do not block the whole interface.
- The board remains visible.
- The user should understand that input is temporarily disabled if it is not their turn.
- Avoid fake prolonged delays unless realistic timing is an intentional mode.

---

## 15. Clocks and Time Controls

### 15.1 Clock Display

Clocks must be:

- Large enough to scan instantly
- Visually associated with the correct player
- High contrast
- Updated smoothly without excessive re-rendering

### 15.2 Active Clock

The active clock must be clearly distinguished.

Do not rely on color alone.

Possible supporting signals:

- Subtle pulse
- Elevated surface
- Active label
- Motion indicator

### 15.3 Low-Time State

When time becomes critical:

- Increase urgency carefully
- Avoid distracting animations
- Optional soft warning sound
- Preserve board focus

### 15.4 Timeout

When a clock reaches zero:

- Stop both clocks immediately.
- Lock board input.
- Determine result correctly.
- Show result transition.
- Preserve final board position.

---

## 16. Move History

### 16.1 Required Behavior

Move history must:

- Display numbered moves
- Use standard algebraic notation
- Mark the current viewed move
- Allow review navigation after the game
- Auto-scroll to the latest move during live play
- Stop auto-scrolling if the user manually browses history

### 16.2 Live Game Behavior

During a live game:

- Current position is the latest position.
- Browsing earlier moves may be disabled initially to avoid confusion.
- If enabled later, a clear “Return to live position” action is required.

### 16.3 Mobile Behavior

Move history should open in:

- Expandable bottom sheet
- Drawer
- Compact horizontal notation strip

The board must remain easy to return to.

---

## 17. Captured Pieces and Material

### 17.1 Display

Captured pieces may be shown near each player.

The interface may also show material advantage:

```text
+2
```

### 17.2 Clarity

- Captured pieces must not be mistaken for active pieces.
- Material score should be optional or visually secondary.
- Do not overemphasize material during casual play.

---

## 18. Evaluation During Play

### 18.1 Default Behavior

Live evaluation should be disabled by default during standard play.

Reason:

- It distracts from independent decision-making.
- It encourages engine-following rather than learning.
- It conflicts with the human-centered product philosophy.

### 18.2 Optional Modes

Live evaluation may be enabled in:

- Analysis mode
- Guided practice mode
- Explicit assisted mode

### 18.3 Evaluation Presentation

When shown:

- Use a clear advantage indicator
- Include textual interpretation
- Keep raw values secondary

Example:

```text
White has a small advantage
+0.7
```

---

## 19. In-Game Controls

### 19.1 Required Controls

- Resign
- Offer or claim draw where applicable
- Restart — for casual/practice modes
- Undo — according to mode
- Flip board
- Sound toggle
- Settings
- Exit game

### 19.2 Control Priority

Primary visible controls during play:

- Undo — when allowed
- Flip board
- Settings or sound
- More menu

Destructive or disruptive actions should not dominate.

### 19.3 Confirmation Rules

Require confirmation for:

- Resign
- Abandon active game
- Restart active game
- Delete saved game

Do not require confirmation for:

- Flip board
- Toggle sound
- Open settings
- Undo in unrestricted practice mode

### 19.4 Confirmation Copy

Preferred:

> Resign this game?

> Your current position will be saved if you leave.

Avoid:

> Are you absolutely sure?

> Warning! You will lose everything!

---

## 20. Undo Behavior

### 20.1 Practice Mode

Undo may be enabled.

For AI games, undo should normally revert:

- The player’s previous move
- The AI’s reply

This returns the user to their last decision point.

### 20.2 Rated or Challenge Modes

Undo should be disabled if such modes are introduced.

### 20.3 Feedback

When undo occurs:

- Move history updates
- Board animates back clearly
- Clocks restore correctly
- Analysis state is invalidated or recalculated

---

## 21. Game Completion Experience

### 21.1 Completion Triggers

- Checkmate
- Stalemate
- Insufficient material
- Threefold repetition
- Fifty-move rule
- Timeout
- Resignation
- Agreed draw
- Abandonment where applicable

### 21.2 Immediate Result State

When the game ends:

1. Stop clocks.
2. Disable move input.
3. Preserve final position.
4. Present a calm result overlay or panel.
5. State the result and reason.
6. Offer next actions.

### 21.3 Result Copy Examples

**Win**

> You won by checkmate.

**Loss**

> Maia won by checkmate.

**Draw**

> The game ended in a draw by repetition.

### 21.4 Primary Next Actions

- Review Game
- Play Again
- Return Home

### 21.5 Secondary Information

May include:

- Duration
- Move count
- Selected opponent
- Time control

Avoid showing a large amount of analysis before the user chooses to review.

---

## 22. Post-Game Summary

### 22.1 Purpose

Provide immediate value without overwhelming the player.

### 22.2 Required Sections

- Result
- One-sentence performance summary
- Most important turning point
- One actionable lesson
- Review Game action
- Play Again action

### 22.3 Example

```text
You created strong pressure on the kingside, but the game turned when
your central pawn became undefended.

Key lesson:
Before beginning an attack, check whether your opponent has a forcing
move in the center.
```

### 22.4 Tone

The summary must be:

- Specific
- Respectful
- Constructive
- Brief
- Honest about uncertainty

---

## 23. Game Review Experience

### 23.1 Review Modes

The review experience should support two layers:

1. Guided Review
2. Advanced Analysis

### 23.2 Guided Review

The default mode for most users.

It should show:

- Critical moments
- Human-readable explanations
- Better alternatives
- Board position
- Minimal engine data
- A final lesson

### 23.3 Advanced Analysis

Optional deeper mode containing:

- Engine evaluation
- Principal variation
- Multiple candidate moves
- Move-by-move navigation
- Raw notation
- Evaluation graph

### 23.4 Review Layout

Desktop:

```text
┌────────────────────────────────────────────────────┐
│ Review summary / progress                          │
├──────────────────────┬─────────────────────────────┤
│                      │ Explanation                 │
│      Chessboard      │ Candidate moves             │
│                      │ Evaluation / lesson          │
├──────────────────────┴─────────────────────────────┤
│ Move timeline / graph / navigation                 │
└────────────────────────────────────────────────────┘
```

Mobile:

- Board first
- Explanation card below
- Swipe or buttons for move navigation
- Advanced details in expandable sections

### 23.5 Move Navigation

Required controls:

- First move
- Previous move
- Next move
- Last move
- Play through moves automatically — optional
- Jump from move list or graph

Keyboard shortcuts should be supported.

### 23.6 Move Classification

Possible classifications:

- Best
- Strong
- Good
- Inaccuracy
- Mistake
- Blunder
- Missed opportunity
- Forced

Use classifications carefully.

The user-facing explanation is more important than the label.

### 23.7 “Brilliant” Classification

Do not use “Brilliant” merely as visual reward.

If included later, it must follow a defensible chess criterion and should not be overused.

### 23.8 Turning Points

A turning point should be selected based on meaningful evaluation change and instructional value.

The review should not simply list every mistake.

Recommended default:

- 1 to 3 key moments for short games
- 3 to 5 key moments for longer games

### 23.9 Alternative Move Presentation

For each critical moment:

- Show the recommended move
- Explain the underlying idea
- Optionally show a short variation
- Allow the user to try the move on the board

Example:

> **Better:** 18. Re1  
> This protects the e-pawn and prepares to challenge the open file.

### 23.10 Try-the-Move Interaction

In review mode, the user may explore alternatives.

The interface must distinguish:

- Actual game line
- Recommended line
- User exploration line

A clear reset action is required.

---

## 24. Human-Like AI Experience

### 24.1 UX Objective

Human-like AI should feel like playing a believable person at a chosen skill level, not a perfect engine with artificial random mistakes.

### 24.2 Opponent Selection

Users should understand:

- Approximate strength
- Expected style
- Whether the opponent is human-like or engine-oriented

Example:

```text
Maia 1200
Makes realistic decisions based on patterns from players near this level.
```

### 24.3 Explainability

The product may explain after a game:

- Why the opponent’s move was common at that rating
- Which alternatives stronger players prefer
- Whether the player’s move was typical for their level

Avoid claiming certainty where the model provides probability rather than intent.

### 24.4 AI Disclaimer

A concise information section should state:

- AI predictions are probabilistic
- Explanations may combine model output and engine analysis
- The product does not literally know a player’s thoughts

---

## 25. History Screen

### 25.1 Purpose

Help users revisit completed games and lessons.

### 25.2 Required Information Per Game

- Result
- Opponent
- Date and time
- Time control
- Player color
- Move count
- Review status
- Optional key lesson

### 25.3 Sorting and Filtering

Initial release may provide:

- Most recent first
- Wins
- Losses
- Draws
- Opponent level

### 25.4 Empty State

```text
No games yet.

Play your first game to begin building your chess history.
[Play a Game]
```

### 25.5 Local Storage Transparency

If data is stored locally:

> Your game history is currently saved on this device.

---

## 26. Settings Experience

### 26.1 Categories

Recommended categories:

- Appearance
- Board
- Gameplay
- Sound
- Accessibility
- Data
- About AI

### 26.2 Appearance

- Theme
- Interface density
- Animation level
- Reduced motion
- High contrast

### 26.3 Board

- Board theme
- Piece set
- Coordinates
- Legal move indicators
- Last move highlight
- Board animation

### 26.4 Gameplay

- Default color
- Default opponent
- Default difficulty
- Default time control
- Confirm resignation
- Undo behavior

### 26.5 Sound

- Master sound
- Move sound
- Capture sound
- Check sound
- Game-end sound
- Clock warning

### 26.6 Accessibility

- Reduced motion
- High-contrast mode
- Colorblind-friendly move indicators
- Keyboard board controls
- Screen-reader verbosity
- Larger notation text

### 26.7 Data

- Export games
- Clear local history
- Restore defaults

### 26.8 Save Behavior

Settings should save immediately unless the change requires explicit confirmation.

A small non-blocking message may confirm:

> Preference saved

---

## 27. Responsive Behavior

### 27.1 Breakpoint Philosophy

Breakpoints should follow content needs rather than device labels alone.

The board and controls must remain usable at all supported widths.

### 27.2 Desktop

Target behavior:

- Full board and side panels visible
- Minimal scrolling
- Advanced review details available
- Keyboard shortcuts enabled

### 27.3 Tablet

Target behavior:

- Board remains primary
- Side panels become tabs, drawers, or stacked sections
- Touch targets increase
- No essential hover behavior

### 27.4 Mobile

Target behavior:

- Board occupies available width
- Important actions remain reachable with one hand where possible
- Secondary information collapses
- Modals become sheets when appropriate
- Text remains readable without zoom
- No horizontal page scrolling

### 27.5 Landscape Mobile

- Allow larger board
- Move controls to a side rail where space permits
- Avoid browser chrome conflicts
- Preserve clock visibility

### 27.6 Ultrawide

- Do not stretch content excessively
- Keep board and analysis grouped
- Use whitespace intentionally
- Apply maximum content width

---

## 28. Accessibility Requirements

### 28.1 Compliance Target

The product should target WCAG 2.2 AA for applicable web interface requirements.

### 28.2 Keyboard Navigation

Required:

- Navigate primary application controls
- Select and move pieces
- Open promotion chooser
- Navigate move history
- Control review playback
- Open and close dialogs
- Activate primary actions

### 28.3 Suggested Keyboard Board Model

Possible interaction:

1. Focus board.
2. Use arrow keys to move square focus.
3. Press Enter or Space to select a piece.
4. Move focus to destination.
5. Press Enter or Space to complete move.
6. Escape cancels selection.

The final model must be tested for usability.

### 28.4 Screen Readers

The board should expose:

- Current square
- Piece identity
- Side to move
- Legal destinations on request
- Last move
- Check status
- Game result

Example announcement:

> White knight on f3 selected. Legal moves: d4, e5, g5, h4.

### 28.5 Color Use

Color must not be the only way to communicate:

- Legal moves
- Captures
- Check
- Active clock
- Move classification
- Errors

### 28.6 Motion

Users must be able to reduce non-essential motion.

Reduced-motion mode should:

- Remove decorative transitions
- Shorten or remove board flip animation
- Reduce pulses
- Preserve essential spatial feedback

### 28.7 Touch Targets

Interactive controls should meet recommended minimum target sizes.

Board squares are naturally size-constrained, but promotion and utility controls must remain comfortable to tap.

### 28.8 Focus States

All interactive elements require visible focus indication.

---

## 29. Motion Specification

### 29.1 Motion Principles

Motion should communicate:

- Cause and effect
- Spatial continuity
- Change of state
- Hierarchy
- Completion

### 29.2 Motion Categories

**Micro-interactions**

- Button press
- Toggle change
- Piece selection
- Legal move feedback

**Gameplay motion**

- Piece movement
- Capture
- Castling
- Promotion
- Board flip

**Navigation motion**

- Page transition
- Drawer
- Modal
- Review panel

### 29.3 Timing Guidance

Exact values will be defined in the design system.

General guidance:

- Immediate feedback: very fast
- Piece movement: fast
- Panel transition: moderate
- Page transition: restrained
- Celebratory motion: brief and optional

### 29.4 Game Result Motion

A result may use:

- Subtle board dimming
- Focused result card
- Gentle highlight
- Minimal celebratory effect for wins

Avoid excessive confetti as a default. If used, it must be optional and short.

---

## 30. Sound Experience

### 30.1 Sound Principles

Sound should:

- Reinforce moves and state changes
- Never be required for understanding
- Be easy to disable
- Avoid overlapping aggressively
- Remain subtle

### 30.2 Recommended Sounds

- Normal move
- Capture
- Check
- Castling
- Promotion
- Game win
- Game loss
- Draw
- Low clock warning
- Invalid action — optional

### 30.3 Sound Defaults

Sound may be enabled by default at a restrained level, subject to browser policies.

Music should not be required and is not recommended for the initial release.

---

## 31. Loading States

### 31.1 Application Loading

Use a lightweight branded loading state.

Avoid long splash screens.

### 31.2 Engine Loading

Show:

- What is loading
- Whether the user can continue
- Retry or fallback when needed

Example:

> Preparing your opponent…

### 31.3 Review Generation

Analysis may take longer than normal navigation.

Show progress in meaningful stages when possible:

```text
Reviewing key moments…
Evaluating alternatives…
Preparing your lesson…
```

Do not present fake exact percentages unless real progress is measurable.

### 31.4 Skeletons

Use skeletons only where they match the final layout.

Do not use board skeletons once the last known position can be shown.

---

## 32. Error States

### 32.1 Error Principles

Errors should explain:

- What happened
- What the user can do
- Whether game data is safe

### 32.2 Engine Failure

Example:

> The chess engine could not start.

Actions:

- Try Again
- Continue Without Analysis
- Return to Setup

### 32.3 AI Move Failure

If the AI fails during a game:

- Preserve the position.
- Retry automatically once if safe.
- Offer manual retry.
- Offer switch to fallback engine when possible.
- Never silently make a random move without disclosure.

### 32.4 Save Failure

Example:

> The game finished, but Caissa could not save it on this device.

Actions:

- Retry
- Export PGN
- Continue

### 32.5 Invalid Restored State

Example:

> This saved game could not be restored safely.

Actions:

- View available game record
- Discard saved state
- Return Home

---

## 33. Offline Experience

### 33.1 Offline-First Scope

Where technically feasible, the following should work offline after initial loading:

- Local chess gameplay
- Rules validation
- Saved settings
- Local history
- Locally bundled Stockfish
- Previously available assets

### 33.2 Network-Dependent Features

Potentially unavailable offline:

- Remote Maia inference
- Cloud synchronization
- Online opening databases
- Remote analytics

### 33.3 Offline Message

> You’re offline. Local play is still available, but human-like AI and cloud features may be limited.

---

## 34. Dialogs, Drawers, and Overlays

### 34.1 Dialog Usage

Use dialogs for:

- Destructive confirmation
- Promotion when contextual placement is impossible
- Critical engine or data errors
- Game result when screen space is limited

### 34.2 Drawer Usage

Use drawers for:

- Mobile navigation
- Move history
- In-game settings
- Advanced analysis
- Secondary information

### 34.3 Overlay Rules

- Trap keyboard focus where appropriate.
- Escape closes non-critical overlays.
- Background content should not remain interactable.
- Game-critical overlays must preserve visible board context when useful.

---

## 35. Content and Microcopy

### 35.1 Voice

Caissa’s voice is:

- Calm
- Intelligent
- Clear
- Encouraging
- Precise
- Non-judgmental

### 35.2 Writing Rules

- Prefer short sentences.
- Explain chess ideas before numbers.
- Avoid unnecessary jargon.
- Define technical terms when first used.
- Avoid anthropomorphizing AI beyond what is honest.
- Do not claim certainty about player intent.

### 35.3 Preferred Examples

> This move was natural, but it left your knight without enough protection.

> Your position was still playable here. Trading queens would have reduced the pressure.

### 35.4 Avoided Examples

> Horrible blunder!

> The engine hates this.

> You completely missed an obvious tactic.

---

## 36. Privacy and Trust UX

### 36.1 Initial Data Model

If the initial release stores data locally:

- State this clearly.
- Do not imply cloud backup.
- Allow export and deletion.

### 36.2 AI Transparency

The About AI section should distinguish:

- Chess rule engine
- Stockfish analysis
- Human-like move model
- Generated explanation layer, if used

### 36.3 User Control

Users should be able to:

- Disable optional analytics
- Clear local data
- Export games
- Continue without advanced AI when possible

---

## 37. Analytics and Product Measurement

Analytics are optional and must respect privacy.

Recommended event categories:

- Game setup completed
- Game started
- Game completed
- Game abandoned
- Review opened
- Review completed
- Play again selected
- Difficulty changed
- Engine error
- AI fallback used

Do not record full board history or personal data remotely without explicit product and privacy decisions.

Analytics must never delay gameplay.

---

## 38. First-Time Onboarding

### 38.1 Philosophy

Onboarding should be short and contextual.

Avoid a long tutorial before the user can play.

### 38.2 Recommended Onboarding

First game setup may contain three brief callouts:

1. Choose an opponent level.
2. Play normally using drag or click.
3. Review the key lesson after the game.

### 38.3 Contextual Education

Teach features when relevant:

- Explain review controls when review opens.
- Explain advanced analysis only when expanded.
- Explain human-like AI when selected.

---

## 39. Game Restoration

### 39.1 Auto-Save

Active games should be saved locally after each committed move.

### 39.2 Resume Prompt

When an unfinished game exists:

> Resume your game against Maia 1200?

Actions:

- Resume
- Start New Game
- View Position

### 39.3 Version Compatibility

If saved game format changes:

- Attempt safe migration.
- Preserve PGN when possible.
- Inform the user if full restoration is unavailable.

---

## 40. UX Acceptance Criteria

The UX is ready for implementation when:

- All primary flows are represented in wireframes.
- Desktop, tablet, and mobile game layouts are defined.
- Board interactions are specified for pointer, touch, and keyboard.
- Promotion, castling, check, game over, undo, and restart flows are resolved.
- Loading, error, offline, and empty states have approved copy.
- Guided review and advanced analysis are clearly separated.
- Accessibility requirements are represented in component behavior.
- Navigation contains no dead ends.
- The design supports the product philosophy.
- No screen depends on undefined critical behavior.

---

## 41. Release-Level UX Acceptance Criteria

Version 1.0 should not be released unless:

### Gameplay

- Every legal chess rule is represented correctly in the UI.
- Illegal move feedback is clear and non-disruptive.
- Clocks, move history, results, and board state remain synchronized.
- Game restoration works for normal interruption cases.

### Usability

- A first-time user can start a game without instruction.
- A user can complete a game using only click/tap interaction.
- A keyboard user can complete a game.
- Mobile layout has no horizontal page overflow.
- Critical controls are discoverable.

### Review

- The post-game summary gives at least one useful insight.
- Review navigation is understandable.
- Actual and alternative lines are distinguishable.
- Engine failure does not destroy the completed game record.

### Quality

- Motion does not interfere with rapid play.
- Reduced motion is respected.
- Sound can be disabled immediately.
- Text remains readable at supported widths.
- Loading and error states are branded and actionable.

---

## 42. UX Risks and Mitigation

### Risk: Too Much Information During Play

**Mitigation**

- Keep live evaluation off by default.
- Collapse secondary panels.
- Prioritize board and clocks.

### Risk: Review Feels Like a Chess.com Clone

**Mitigation**

- Focus on human explanations and turning points.
- Avoid copying labels, layout, and visual hierarchy directly.
- Emphasize lessons rather than scores.

### Risk: Human-Like AI Claims Feel Misleading

**Mitigation**

- Explain model behavior accurately.
- Use probabilistic language.
- Avoid pretending the model understands emotions or intent.

### Risk: Mobile Board Becomes Too Small

**Mitigation**

- Collapse secondary content.
- Use full safe width.
- Move utilities into drawers.
- Test on narrow screens early.

### Risk: Excessive Visual Polish Delays Gameplay

**Mitigation**

- Implement functional interactions before decorative motion.
- Treat motion and sound as layered enhancements.
- Preserve milestone-based delivery.

### Risk: Accessibility Added Too Late

**Mitigation**

- Include semantics and keyboard behavior in component definitions from the beginning.
- Test focus order during each milestone.
- Maintain reduced-motion support from the first polished build.

---

## 43. Locked UX Decisions

The following decisions are approved for the initial direction:

1. The board is the primary focus during play.
2. Live evaluation is off by default.
3. Post-game review starts with a concise guided experience.
4. Advanced engine data is optional.
5. Human-like AI is presented by skill level and behavior, not only technical model name.
6. The product uses calm, non-judgmental feedback.
7. Mobile secondary information is collapsible.
8. Game state is saved locally after each move.
9. The product must support drag, click, touch, and keyboard move input.
10. The first release avoids social and multiplayer complexity.
11. The primary CTA is “Play a Game.”
12. The official slogan is “Beyond the Best Move.”

---

## 44. Open Product Decisions

These do not block UX design but must be resolved before technical implementation of the related feature:

1. Whether local two-player mode is included in v1.0.
2. Whether Stockfish is bundled locally or loaded separately.
3. Whether Maia inference runs locally, remotely, or through a hybrid approach.
4. Whether game review is generated fully client-side.
5. Whether anonymous analytics are included.
6. Whether the first release supports installable PWA behavior.
7. Whether custom time controls are included in v1.0.
8. Which chess piece and board themes ship at launch.
9. Whether advanced board annotations ship in v1.0.
10. Whether the game supports premoves in later online modes only.

These questions will be addressed in the Technical Specification and AI Architecture documents.

---

## 45. Screen Inventory

### Required for Initial Design

1. Home
2. Game Setup
3. Active Game — desktop
4. Active Game — mobile
5. Promotion
6. Pause or in-game menu
7. Resign confirmation
8. Game result
9. Post-game summary
10. Guided review
11. Advanced analysis
12. History
13. Empty history
14. Settings
15. Engine loading
16. Engine failure
17. Offline state
18. Resume game
19. About Caissa
20. About Human-Like AI

### Future

- Puzzle mode
- Opening explorer
- Account onboarding
- Cloud synchronization
- Multiplayer lobby
- Tournament mode
- Personal training plan

---

## 46. Recommended Wireframe Order

Wireframes should be created in this sequence:

1. Active Game — desktop
2. Active Game — mobile
3. Game Setup
4. Game Result
5. Guided Review
6. Advanced Analysis
7. Home
8. Settings
9. History
10. Error and loading states

This order prioritizes the product’s most important interaction: playing and understanding a game.

---

## 47. Final UX Direction

Caissa must not compete by having the largest number of chess features.

It should compete through coherence.

The complete experience should communicate one idea:

> Chess software can be powerful without being cold, and intelligent without making the player feel small.

The user should enter Caissa to play a game and leave with a clearer understanding of one decision, one pattern, or one lesson.

That is the standard against which every screen and interaction should be evaluated.
