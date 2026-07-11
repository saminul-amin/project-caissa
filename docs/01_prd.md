# Caissa — Product Requirements Document

**Document ID:** CAISSA-PRD-001  
**Document Type:** Product Requirements Document  
**Version:** 1.0  
**Status:** Approved for Implementation Planning  
**Product:** Caissa  
**Primary Slogan:** Beyond the Best Move  
**Supporting Tagline:** Human-like chess. Meaningful improvement.  
**Prepared:** July 2026  
**Owner:** Md. Saminul Amin  
**Primary Audience:** Product, Design, Frontend Engineering, Backend Engineering, AI Engineering, QA, DevOps, Technical Reviewers, and Codex-assisted development

---

## 1. Purpose

This Product Requirements Document defines what Caissa must deliver, why it should exist, who it serves, which capabilities belong in Version 1, and how product success will be evaluated.

It is the authoritative source for:

- Product goals
- User problems
- Target users
- Version 1 scope
- Functional requirements
- Non-functional requirements
- User journeys
- Product constraints
- Acceptance criteria
- Success measures
- Explicitly deferred capabilities

The documents that follow this PRD explain how the approved requirements should be designed, engineered, tested, secured, deployed, and delivered.

This PRD intentionally avoids low-level implementation detail unless a technical constraint materially affects the product requirement.

---

## 2. Document Authority and Related Documents

This PRD must remain consistent with:

- `00_product_identity.md`
- `02_ux_specification.md`
- `03_design_system.md`
- `04_technical_specification.md`
- `05_architecture_design.md`
- `06_ai_architecture.md`
- `07_testing_strategy.md`
- `08_deployment_and_release.md`
- `09_coding_guidelines.md`
- `10_security_and_privacy.md`
- `11_project_roadmap.md`

When documents conflict, use this order:

1. Chess correctness and game-state integrity
2. Security, privacy, and data preservation
3. This Product Requirements Document
4. Product Identity and Philosophy
5. UX Specification
6. Technical and Architecture documents
7. Implementation convenience

A change to Version 1 scope requires an explicit PRD revision.

---

# 3. Product Summary

Caissa is a premium, browser-first chess application built around realistic AI play, understandable analysis, and thoughtful improvement.

Traditional chess engines are optimized to identify objectively strong moves. They are valuable, but their feedback often feels mechanical, overly technical, or disconnected from how people actually make decisions.

Caissa combines:

- Complete legal chess gameplay
- A polished and calm playing experience
- Local Stockfish-powered objective analysis
- Maia-powered human-like opponents
- Guided post-game review
- Evidence-backed explanations
- Local-first game storage
- Browser and itch.io distribution

The defining product idea is:

> Caissa should not only show what the best move was. It should help the player understand why their move was natural, what it overlooked, and what lesson can be carried into the next game.

---

# 4. Product Vision

> Create the most thoughtful and beautifully designed human-centered chess experience.

Caissa should become a place where players can:

- Enjoy a focused game of chess
- Face opponents that behave believably
- Understand the important decisions in their games
- Learn without feeling judged
- Return because the experience is calm, useful, and satisfying

---

# 5. Product Mission

Build a premium chess experience that combines:

- Human-like artificial intelligence
- Reliable objective analysis
- Clear educational feedback
- Elegant visual design
- Smooth interaction
- Respect for the player’s time and attention

---

# 6. Core Product Promise

Every meaningful Caissa session should help the player do at least one of the following:

1. Enjoy the game
2. Understand a decision
3. Recognize a pattern
4. Learn from a mistake
5. Feel motivated to play again

A feature that contributes to none of these outcomes should not be prioritized.

---

# 7. Problem Statement

## 7.1 Player Problem

Many chess applications provide strong engines, evaluation bars, move classifications, and long variations. However, they often fail to answer the questions an improving player actually has:

- Why was my move tempting?
- What danger did I overlook?
- Was this a natural mistake for my level?
- What should I notice in similar positions?
- Which moments actually decided the game?

Players frequently leave analysis knowing that a move was bad without understanding the reusable lesson behind it.

## 7.2 Opponent Problem

Weak computer opponents are often created by artificially limiting a strong engine or introducing random inaccuracies. These opponents may:

- Play strong moves followed by unnatural blunders
- Repeat predictable patterns
- Feel mechanical
- Fail to resemble a human at the selected level

This reduces immersion and learning value.

## 7.3 Experience Problem

Many chess platforms are designed as large portals containing:

- Competitive networks
- Social systems
- News
- Videos
- Puzzles
- Events
- Advertisements
- Notifications
- Multiple dashboards

Caissa needs a narrower, calmer, more intentional experience centered on play and reflection.

---

# 8. Product Opportunity

Caissa can differentiate itself by combining three capabilities into one coherent loop:

```text
Polished play
  +
Believable human-like opposition
  +
Understandable post-game learning
```

The opportunity is not to compete immediately with full chess ecosystems.

The opportunity is to create a smaller product that feels more thoughtful, more human, and more focused than a conventional engine interface.

---

# 9. Product Positioning

Caissa is positioned as:

> A premium, human-centered chess application where realistic AI opponents and understandable analysis help players enjoy and improve at chess.

Caissa is not intended to be:

- A clone of Chess.com
- A replacement interface for Stockfish
- A large competitive chess network at launch
- A collection of disconnected chess utilities
- A generic AI chatbot attached to a board
- A platform that overwhelms players with engine information

---

# 10. Primary Differentiator

Most chess applications ask:

> What was the best move?

Caissa must also ask:

> Why did this move make sense to the player, what did it overlook, and what can be learned from it?

This distinction must influence:

- Opponent behavior
- Analysis structure
- Move classifications
- Explanations
- Interface hierarchy
- Product copy
- Feature prioritization

---

# 11. Product Principles

## 11.1 Human Before Engine

Engine output should support understanding rather than dominate the experience.

## 11.2 Clarity Before Complexity

One important idea explained clearly is more valuable than ten simultaneous statistics.

## 11.3 Guidance Without Judgment

Feedback must be respectful, specific, and encouraging.

## 11.4 Realistic Opposition

Human-like opponents should model plausible decisions rather than behave like randomly weakened engines.

## 11.5 Beauty With Purpose

Visual quality is a core product capability, but readability and interaction always take priority.

## 11.6 Respect for Attention

Caissa should avoid manipulative engagement patterns, clutter, unnecessary notifications, and artificial urgency.

## 11.7 Reflection After Play

The end of a game should naturally lead into understanding, one key lesson, and an optional deeper review.

---

# 12. Target Users

## 12.1 Primary Persona — Improving Player

### Description

A beginner-to-intermediate player who understands basic chess and wants to improve without being overwhelmed by technical engine analysis.

### Needs

- A believable practice opponent
- Clear feedback
- A small number of important lessons
- A calm interface
- Simple difficulty selection
- Confidence that the analysis is accurate

### Pain Points

- Evaluation bars without explanation
- Long engine variations
- Harsh move labels
- Weak bots that make random mistakes
- Too many unrelated features

### Primary Value

Caissa helps this player understand why decisions worked or failed.

---

## 12.2 Secondary Persona — Casual Player

### Description

A player who wants an enjoyable solo game with a polished board and an opponent that feels more human than a conventional bot.

### Needs

- Fast game setup
- Attractive visuals
- Adjustable challenge
- Smooth board interaction
- Minimal friction

### Primary Value

Caissa provides a satisfying standalone chess experience without requiring an account or competitive pressure.

---

## 12.3 Secondary Persona — Chess Enthusiast

### Description

A more experienced player interested in the relationship between objective engine analysis and likely human decisions.

### Needs

- Advanced analysis access
- Candidate moves
- Human-likelihood context
- Model transparency
- PGN export

### Primary Value

Caissa presents human and objective perspectives without confusing them.

---

## 12.4 Secondary Persona — Developer or AI Enthusiast

### Description

A technically curious user interested in Maia, Stockfish, browser engines, and human-move modeling.

### Needs

- Model identity
- Honest AI explanation
- Technical transparency
- Reproducible behavior where appropriate

### Primary Value

Caissa demonstrates a careful, credible human-centered AI architecture.

---

# 13. User Needs

Users need to be able to:

- Start a game quickly
- Choose an opponent and approximate difficulty
- Play complete legal chess
- Use mouse, touch, or keyboard
- See clear turn, clock, and game-state information
- Recover an interrupted game
- Finish and understand the result
- Review important decisions
- Explore better alternatives
- Export their game
- Continue without creating an account
- Continue local play when remote AI is unavailable

---

# 14. Jobs to Be Done

## 14.1 Play Job

> When I want to play chess alone, I want a polished opponent that behaves believably so the game feels worthwhile.

## 14.2 Improvement Job

> After I finish a game, I want to understand the few decisions that mattered most so I know what to improve next.

## 14.3 Confidence Job

> When the system criticizes a move, I want evidence and understandable reasoning so I can trust the feedback.

## 14.4 Low-Friction Job

> When I have a short amount of time, I want to start and resume a game without creating an account or configuring a complex platform.

## 14.5 Exploration Job

> When I am curious about a position, I want to compare the human-looking choice with the objectively strongest choice.

---

# 15. Core User Journey

The primary Version 1 journey is:

```text
Open Caissa
  ↓
Understand the product promise
  ↓
Select opponent, difficulty, color, and time control
  ↓
Play a complete game
  ↓
See the result and concise summary
  ↓
Review critical moments
  ↓
Understand one reusable lesson
  ↓
Explore deeper analysis or play again
```

The product is incomplete if this loop does not feel coherent.

---

# 16. Product Goals

## 16.1 Version 1 Goals

Caissa Version 1 must:

1. Deliver a polished browser-based chess experience.
2. Support complete and correct standard chess.
3. Provide a local Stockfish opponent.
4. Provide a Maia-powered human-like opponent.
5. Offer difficulty profiles that are approximate, understandable, and honestly described.
6. Preserve games locally and restore interrupted play.
7. Generate a guided review of important moments.
8. Explain mistakes with evidence-backed, respectful language.
9. Support desktop and mobile browsers.
10. Be distributable through itch.io and controlled web hosting.
11. Require no user account.
12. Remain usable when Maia is unavailable.

## 16.2 Business and Portfolio Goals

The project should:

- Demonstrate strong product thinking
- Demonstrate professional software architecture
- Demonstrate meaningful AI integration
- Be credible as a portfolio centerpiece
- Be visually impressive enough to share publicly
- Establish a foundation for future expansion

---

# 17. Non-Goals for Version 1

Version 1 will not include:

- Online multiplayer
- User accounts
- Cloud synchronization
- Public profiles
- Leaderboards
- Social features
- Messaging
- Tournaments
- Payment processing
- Subscription plans
- Advertising
- User-generated public content
- Full personalized coaching
- Training models on private user games
- General-purpose LLM commentary
- Native mobile applications
- A complete puzzle platform
- Opening-course marketplace

These exclusions protect focus and reduce security, privacy, and operational complexity.

---

# 18. Version 1 Scope

## 18.1 Required Product Capabilities

Version 1 must include:

- Premium landing and setup experience
- Complete legal standard chess
- Local two-player mode or an approved local practice equivalent
- Local Stockfish opponent
- Maia-powered human-like opponent
- Approximate difficulty profiles
- Mouse drag-and-drop
- Click-to-move
- Touch interaction
- Keyboard board interaction
- Board orientation
- Legal move indicators
- Last-move and check states
- Promotion selection
- Time controls
- Move history
- Undo in approved practice modes
- Resign and restart
- Complete result handling
- Active-game persistence
- Local game history
- PGN copy and export
- Guided post-game review
- Basic advanced analysis
- Settings
- Accessibility baseline
- Responsive desktop and mobile layouts
- Browser distribution
- itch.io distribution
- AI and model transparency
- Degraded operation when remote services fail

## 18.2 Optional Version 1 Capabilities

These may ship if they do not delay the core loop:

- Multiple board themes
- Fullscreen control
- Installable PWA
- Additional sounds
- Local opening-name display
- Basic statistics from local history
- Additional Maia profiles
- Threaded Stockfish on controlled hosting

## 18.3 Deferred Capabilities

Deferred until after Version 1:

- Accounts and sync
- Personalized coaching profiles
- Game-derived puzzles
- Opening repertoire guidance
- Multiplayer
- Social or sharing network
- LLM-refined explanations
- Larger Maia production tiers
- Native desktop packaging
- Native mobile applications

---

# 19. Functional Requirements

Requirements use the following priority:

- **P0:** Required for product integrity or stable release
- **P1:** Required for the core Version 1 promise
- **P2:** Valuable enhancement; may be deferred if release quality is at risk

---

## 19.1 Application Entry and Home

### FR-HOME-001 — Product Introduction — P1

The home screen must communicate:

- Product name
- Primary slogan
- Human-like opponent value
- Meaningful review value
- Primary action to start a game

### FR-HOME-002 — Returning Player — P1

When an active game exists, the application must offer a clear resume action.

### FR-HOME-003 — No Account Requirement — P0

A player must be able to use all core Version 1 local features without creating an account.

### FR-HOME-004 — Navigation — P1

The product must provide clear access to:

- Play
- Review/history
- Settings
- Product/model information

---

## 19.2 Game Setup

### FR-SETUP-001 — Opponent Type — P1

The player must be able to choose among approved opponent types, including:

- Stockfish practice opponent
- Human-like Maia opponent
- Local mode if included in the final launch scope

### FR-SETUP-002 — Difficulty — P1

The player must be able to choose a clear difficulty/profile.

Difficulty labels must not claim exact guaranteed human rating.

### FR-SETUP-003 — Player Color — P1

The player must be able to select:

- White
- Black
- Random

### FR-SETUP-004 — Time Control — P1

The player must be able to choose approved time controls, including a no-clock practice option.

### FR-SETUP-005 — Persisted Defaults — P2

The application should remember recent setup preferences locally.

### FR-SETUP-006 — Capability Communication — P1

If a selected opponent is unavailable, the setup screen must explain the limitation and present an alternative.

---

## 19.3 Chess Gameplay

### FR-GAME-001 — Standard Chess Rules — P0

The application must correctly implement standard chess, including:

- Legal moves
- Check
- Checkmate
- Stalemate
- Castling
- En passant
- Promotion
- Repetition handling
- Fifty-move handling
- Insufficient material

### FR-GAME-002 — Authoritative Validation — P0

Every user or engine move must be validated against the authoritative browser game state before commit.

### FR-GAME-003 — Input Methods — P1

The board must support:

- Drag-and-drop
- Click-to-move
- Touch interaction
- Keyboard interaction

### FR-GAME-004 — Legal Move Feedback — P1

The interface must clearly communicate:

- Selected square
- Legal destinations
- Captures
- Last move
- Check
- Disabled input state

### FR-GAME-005 — Promotion — P0

The player must be able to choose queen, rook, bishop, or knight during promotion.

### FR-GAME-006 — Move History — P1

The interface must show move history using standard notation.

### FR-GAME-007 — Clocks — P1

Clocked games must display accurate remaining time and active side.

### FR-GAME-008 — In-Game Controls — P1

Approved game controls must include:

- Undo where permitted
- Resign
- Restart/new game
- Settings or sound access

### FR-GAME-009 — No Live Evaluation by Default — P1

Live objective evaluation must be disabled by default during ordinary play.

### FR-GAME-010 — Board Orientation — P1

The board must orient correctly for the player’s chosen side and support an approved flip action.

---

## 19.4 Game Persistence and Recovery

### FR-DATA-001 — Active-Game Save — P0

The application must save the active game locally after committed moves and other critical state changes.

### FR-DATA-002 — Resume — P0

The application must restore a valid interrupted game after refresh or reopening.

### FR-DATA-003 — Completed-Game History — P1

Completed games must be stored locally and available in history.

### FR-DATA-004 — PGN Export — P0

The player must be able to copy and download the game PGN.

### FR-DATA-005 — Local Deletion — P1

The player must be able to delete individual games and clear local history.

### FR-DATA-006 — Recovery Mode — P0

If optional metadata is corrupted but PGN remains valid, the application must preserve and expose the recoverable game.

### FR-DATA-007 — Storage Transparency — P1

The product must explain that Version 1 game history is stored locally on the current browser/device.

---

## 19.5 Stockfish Opponent and Analysis

### FR-SF-001 — Local Engine Execution — P1

Stockfish must run outside the browser main thread.

### FR-SF-002 — Practice Profiles — P1

The application must offer understandable Stockfish practice difficulty profiles.

### FR-SF-003 — Search Cancellation — P0

Obsolete searches must be cancellable or safely ignored.

### FR-SF-004 — Worker Recovery — P0

A Stockfish worker failure must not corrupt the game and should be recoverable.

### FR-SF-005 — itch.io Compatibility — P1

The itch.io build must support a single-thread Stockfish mode when threaded WebAssembly is unavailable.

### FR-SF-006 — Objective Analysis — P1

Stockfish must provide objective post-game analysis and candidate lines for review.

---

## 19.6 Maia Human-Like Opponent

### FR-MAIA-001 — Human-Like Opponent — P1

The player must be able to play a complete game against an approved Maia-powered opponent profile.

### FR-MAIA-002 — Profile Selection — P1

The player must select a product-facing difficulty profile rather than raw model parameters.

### FR-MAIA-003 — Request Validation — P0

The Maia service must validate position, history, rating/profile, and request bounds.

### FR-MAIA-004 — Local Move Validation — P0

Every returned Maia move must be revalidated against the current browser position before commit.

### FR-MAIA-005 — Stale Response Protection — P0

A Maia response must be rejected if the game position, ply, phase, or request identity has changed.

### FR-MAIA-006 — Failure Handling — P0

If Maia is unavailable, the application must preserve the game and offer an approved, disclosed fallback.

### FR-MAIA-007 — Model Transparency — P1

The product must provide clear information that Maia models likely human moves and does not replace objective Stockfish analysis.

### FR-MAIA-008 — Approximate Skill Language — P1

Profile labels must be described as approximate styles or decision levels rather than guaranteed ratings.

### FR-MAIA-009 — Human-Like Variation — P1

Opponent profiles should support controlled variation among plausible moves without introducing arbitrary random blunders.

---

## 19.7 Game Completion

### FR-RESULT-001 — Result Detection — P0

The application must correctly detect and display:

- Checkmate
- Stalemate
- Draw
- Timeout
- Resignation
- Other approved completion reasons

### FR-RESULT-002 — Immediate Summary — P1

The result state must show:

- Outcome
- Reason
- Concise respectful message
- Primary next action

### FR-RESULT-003 — Next Actions — P1

The player must be able to:

- Review the game
- Play again
- Return home
- Export PGN

---

## 19.8 Guided Review

### FR-REVIEW-001 — Review Availability — P1

A completed game must be eligible for post-game review.

### FR-REVIEW-002 — Progressive Generation — P1

The product should display the summary and first useful insight before all deeper analysis is complete.

### FR-REVIEW-003 — Critical Moments — P1

Guided review must focus on a small set of meaningful turning points rather than giving equal emphasis to every move.

### FR-REVIEW-004 — Objective Evidence — P0

Recommended moves and tactical claims must be based on legal, validated analysis.

### FR-REVIEW-005 — Human Context — P1

Where Maia data is available, the review should explain when a move was humanly plausible despite being objectively inaccurate.

### FR-REVIEW-006 — Respectful Explanation — P1

Explanations must avoid insulting, humiliating, or psychologically speculative language.

### FR-REVIEW-007 — Better Move — P1

Important review moments should present a better alternative and a concise reason.

### FR-REVIEW-008 — Reusable Lesson — P1

A critical moment should provide a lesson that can transfer to future games when evidence supports one.

### FR-REVIEW-009 — Try-the-Move — P2

The player should be able to explore an alternative move from a selected position.

### FR-REVIEW-010 — Advanced Analysis — P1

The product must provide a deeper review mode with move navigation, objective evaluation, and candidate lines.

### FR-REVIEW-011 — Partial Review — P0

If full review generation fails, completed analysis must remain accessible and the game must remain exportable.

### FR-REVIEW-012 — Review Persistence — P1

Generated review results should be stored locally and reopened later.

---

## 19.9 Explanation and AI Trust

### FR-TRUST-001 — Evidence Mapping — P0

Every factual explanation must map to structured evidence.

### FR-TRUST-002 — No Intent Claims — P0

The application must not state that it knows the player’s internal intention, emotion, confidence, or psychology.

### FR-TRUST-003 — Semantic Separation — P0

The UI must clearly separate:

- Maia human-likelihood information
- Stockfish objective evaluation
- Deterministic explanation

### FR-TRUST-004 — No False Precision — P1

The application must not display unsupported probability or rating precision.

### FR-TRUST-005 — AI Limitations — P1

The product must explain that human-like predictions are estimates based on recorded game patterns and may be less reliable in unusual positions.

---

## 19.10 History and Settings

### FR-HISTORY-001 — Game List — P1

History must show locally saved games with useful metadata.

### FR-HISTORY-002 — Open Game — P1

The player must be able to reopen a completed game and its review.

### FR-HISTORY-003 — Sort and Filter — P2

History should support basic sorting and filtering if implementation remains simple.

### FR-SETTINGS-001 — Appearance — P1

The player must be able to configure approved appearance options.

### FR-SETTINGS-002 — Board — P1

The player must be able to configure board orientation/theme options defined for Version 1.

### FR-SETTINGS-003 — Sound — P1

The player must be able to enable or disable sound.

### FR-SETTINGS-004 — Accessibility — P1

The player must be able to configure approved motion, contrast, coordinate, or accessibility preferences.

### FR-SETTINGS-005 — Data Controls — P1

The player must be able to export and clear approved categories of local data.

---

## 19.11 Offline and Degraded Operation

### FR-OFFLINE-001 — Local Core — P0

After required assets are available, local chess gameplay must not require a backend.

### FR-OFFLINE-002 — Maia Unavailable — P0

The application must remain usable when the Maia service is unavailable.

### FR-OFFLINE-003 — Stockfish Unavailable — P0

If Stockfish cannot run, the application must preserve local game and data access.

### FR-OFFLINE-004 — Clear Capability Status — P1

The interface must communicate degraded capability without exposing unnecessary technical details.

---

## 19.12 Distribution

### FR-DIST-001 — Standard Web Build — P1

Caissa must be deployable as a static web application.

### FR-DIST-002 — itch.io Build — P1

Caissa must be packageable as an HTML5 itch.io project with relative assets and a root `index.html`.

### FR-DIST-003 — Independent Maia Service — P1

The Maia service must be independently deployable and rollbackable.

### FR-DIST-004 — Version Visibility — P1

The application must expose sufficient version information for support and diagnostics.

---

# 20. UX Requirements

## 20.1 Board Priority

The board must remain the visual and interaction center of the active-game screen.

## 20.2 Progressive Disclosure

The default experience must prioritize understandable information and reveal technical depth on demand.

## 20.3 Calm Feedback

Messages and animations should support focus rather than create alarm or spectacle.

## 20.4 No Dead Ends

Every major state should offer a clear next action.

## 20.5 Responsive Behavior

The product must remain usable across:

- Desktop
- Laptop
- Tablet
- Mobile portrait
- Mobile landscape where practical

## 20.6 Input Consistency

Mouse, touch, and keyboard interactions must produce equivalent legal game behavior.

## 20.7 Brand Consistency

The experience must reflect the approved calm, refined, thoughtful, and human brand personality.

Detailed interaction requirements are defined in `02_ux_specification.md`.

---

# 21. Accessibility Requirements

Version 1 must target WCAG 2.2 AA principles for the core experience.

Required:

- Semantic controls
- Keyboard navigation
- Keyboard board interaction
- Accessible names
- Focus visibility
- Dialog focus management
- Screen-reader move and result communication
- Color-independent states
- Sufficient contrast
- Reduced-motion support
- Touch targets appropriate for mobile use

A keyboard-only user must be able to configure, play, finish, review, and export a game.

---

# 22. Non-Functional Requirements

## 22.1 Correctness — P0

- Illegal moves must never be committed.
- Terminal results must be correct.
- Clocks must remain correct under backgrounding and delayed callbacks.
- PGN/FEN must round-trip correctly.
- Engine proposals must not bypass validation.

## 22.2 Reliability — P0

- Active games must survive refresh.
- Recoverable data must not be discarded silently.
- Engine and network failures must preserve the game.
- Review failures must not remove PGN or results.

## 22.3 Performance — P1

Initial targets include:

- Responsive board input
- No heavy engine search on the main thread
- Controlled initial bundle size
- Progressive engine loading
- Progressive review generation
- Stable play on a reasonable mid-tier laptop

Detailed budgets are defined in `04_technical_specification.md`.

## 22.4 Security — P0

- External input is untrusted.
- Secrets never enter frontend bundles.
- Maia requests are validated and bounded.
- Engine commands are internally constructed.
- Production CORS is allowlisted.
- Release artifacts are traceable.

## 22.5 Privacy — P0

- No account is required.
- Games are local by default.
- Full games are not remotely retained by default.
- Optional analytics are disabled unless deliberately reviewed and disclosed.
- Players can export and delete local data.

## 22.6 Compatibility — P1

The product must support the approved current browser matrix and an itch.io-compatible build.

## 22.7 Maintainability — P1

- Domain logic remains framework-independent.
- Engine adapters are replaceable.
- External boundaries are typed.
- Architecture checks run in CI.
- Every critical bug receives a regression test.

## 22.8 Observability — P1

The Maia service must expose operational health, latency, error, and worker information without logging unnecessary game data.

---

# 23. Data Requirements

## 23.1 Local Data

Caissa Version 1 may store locally:

- Preferences
- Active game
- Completed games
- PGN
- Review summaries
- Analysis cache
- Version metadata

## 23.2 Remote Inference Data

A Maia request may include only what is required for move inference:

- Position
- Relevant move history
- Opponent/profile parameters
- Request metadata

It must not require:

- Name
- Email
- Account identity
- Full unrelated history
- Precise location

## 23.3 Data Ownership

Players must retain practical access to their games through PGN export.

## 23.4 Data Migration

Persistent local records must be versioned, migrated, tested, and recoverable.

---

# 24. AI Requirements

## 24.1 Maia Role

Maia is responsible for likely human move prediction and human-like opponent behavior.

## 24.2 Stockfish Role

Stockfish is responsible for objective analysis, candidate lines, and tactical verification.

## 24.3 Explanation Role

Version 1 explanations should be composed from deterministic, structured evidence.

A general-purpose LLM is not required.

## 24.4 Model Honesty

The product must not:

- Present Maia compatibility evaluations as Stockfish evaluations
- Claim that profiles guarantee exact Elo
- Claim to know the player’s mental state
- Invent chess lines
- Hide model/service fallback

## 24.5 Model Availability

Maia is a network-enhanced capability. Local play must remain available without it.

---

# 25. Success Measures

Version 1 success should be evaluated across product quality, user value, AI quality, and reliability.

## 25.1 Product Quality Measures

- Core game completion rate during beta
- Percentage of sessions without blocking error
- Successful active-game restoration
- Successful PGN export
- Mobile and desktop usability
- Accessibility core-flow completion

## 25.2 Experience Measures

During beta, evaluate:

- Time required for a first-time user to start a game
- Whether users understand opponent choices
- Whether result and review next actions are clear
- Whether the product feels calm and premium
- Whether users wish to play again

## 25.3 Review Value Measures

- Percentage of completed games where review is opened
- Percentage of opened reviews where at least one critical moment is viewed
- User-rated usefulness
- Chess-reviewer correctness score
- Unsupported factual claim rate
- Duplicate or irrelevant insight rate

## 25.4 Human-Like AI Measures

- Legal output rate
- Inference success rate
- Latency
- Move-prediction benchmark results
- Profile calibration
- Opening diversity
- Human playtester believability rating
- Difference between perceived and intended difficulty

## 25.5 Stability Measures

- Worker crash rate
- Maia timeout/error rate
- Storage failure rate
- Unhandled browser error rate
- Release rollback frequency

---

# 26. Initial Release Targets

Before stable Version 1:

- Zero known P0 chess-integrity defect
- Zero known illegal engine move committed
- Zero known destructive migration defect
- No unresolved Severity 0 or Severity 1 release defect
- Core keyboard flow passes
- Core browser matrix passes
- Private itch.io release passes smoke testing
- Maia service has healthy fallback behavior
- Review release sample is approved by a chess-knowledgeable reviewer
- Security and license gates pass

Quantitative AI and latency thresholds will be finalized through benchmarking rather than invented in advance.

---

# 27. Acceptance Criteria for Version 1

Version 1 is accepted only when all of the following are true.

## 27.1 Gameplay

- A player can start and complete a correct game.
- All standard chess rules work.
- Mouse, touch, and keyboard play work.
- Clocks behave correctly.
- Promotion works.
- Results are correct.

## 27.2 Opponents

- Stockfish opponent works locally.
- Maia opponent works through the approved service.
- Maia moves are validated locally.
- Human-like AI failure is disclosed and safely handled.
- Difficulty profiles are documented and tested.

## 27.3 Persistence

- Active games restore.
- Completed games remain available locally.
- PGN export works.
- Migrations preserve recoverable game data.

## 27.4 Review

- A completed game can generate a guided review.
- Review identifies meaningful critical moments.
- Better moves are legal.
- Claims are evidence-backed.
- Language is respectful.
- Partial review remains usable.

## 27.5 UX and Accessibility

- Desktop and mobile layouts are usable.
- Keyboard-only core journey works.
- Focus and dialog behavior are correct.
- Contrast and reduced motion are supported.
- The interface reflects the approved brand.

## 27.6 Distribution and Operations

- Standard web build deploys.
- itch.io build works in private verification.
- Maia service deploys independently.
- Rollback is possible.
- Release metadata is visible.
- Monitoring and health checks operate.

## 27.7 Security and Privacy

- No frontend secrets exist.
- Inputs are validated.
- CORS and request limits are configured.
- Local data can be exported and deleted.
- Privacy notice matches behavior.
- Required open-source notices and source obligations are satisfied.

---

# 28. Product Constraints

## 28.1 Browser-First

The core game must work in the browser without installation.

## 28.2 itch.io

The application must support itch.io HTML5 packaging and embedded/fullscreen behavior.

## 28.3 Local-First

Version 1 game history and preferences are stored locally.

## 28.4 Network-Enhanced Maia

Human-like Maia play requires a remote service, but the product must remain usable when it is unavailable.

## 28.5 Solo/Small-Team Feasibility

The architecture and release plan must remain feasible for a solo developer or small team.

## 28.6 License Compliance

Stockfish and Maia licensing obligations must be addressed before public release.

## 28.7 No Premature Accounts

Account infrastructure must not be introduced solely for convenience.

---

# 29. Dependencies

Version 1 depends on:

- Approved UX and visual design
- Correct chess-domain core
- Local persistence
- Browser-compatible Stockfish distribution
- Maia-3 service integration
- Testing infrastructure
- Accessible board interaction
- Static hosting
- itch.io publishing workflow
- Container hosting for Maia
- License and source-distribution review

---

# 30. Assumptions

The roadmap assumes:

- Standard chess only
- Browser access is available
- A supported device can run local game logic
- Stockfish WebAssembly can run in at least single-thread mode on supported desktop browsers
- Maia3-5M can be hosted within an acceptable early-stage operational budget
- A small beta group can be recruited
- A chess-knowledgeable reviewer can evaluate review quality

Assumptions must be tested, not treated as guarantees.

---

# 31. Risks and Mitigations

## 31.1 Risk — Scope Expansion

**Risk:** Accounts, multiplayer, puzzles, or social features delay the core experience.

**Mitigation:** Lock Version 1 scope and apply the product philosophy test.

## 31.2 Risk — Maia Latency

**Risk:** Human-like moves arrive too slowly.

**Mitigation:** Use Maia3-5M, warm workers, bounded timeouts, and disclosed Stockfish fallback.

## 31.3 Risk — Difficulty Labels Are Misleading

**Risk:** Users interpret a profile as a guaranteed rating.

**Mitigation:** Use approximate language, benchmark profiles, and conduct playtesting.

## 31.4 Risk — Review Explanations Are Incorrect

**Risk:** Fluent explanations damage trust.

**Mitigation:** Use deterministic evidence, legal-line verification, regression fixtures, and expert review.

## 31.5 Risk — Board Library Limits Accessibility

**Risk:** The selected renderer cannot provide acceptable keyboard/screen-reader behavior.

**Mitigation:** Use an adapter, prototype accessibility early, and preserve replacement ability.

## 31.6 Risk — itch.io Runtime Limits

**Risk:** Threaded engine or absolute asset assumptions fail.

**Mitigation:** Dedicated relative-path build, single-thread engine fallback, and private host testing.

## 31.7 Risk — Overengineering

**Risk:** Architecture effort delays a playable product.

**Mitigation:** Deliver vertical milestones and avoid unnecessary infrastructure.

## 31.8 Risk — License Mismanagement

**Risk:** Public distribution violates Stockfish or Maia obligations.

**Mitigation:** Record provenance, notices, corresponding source, and obtain legal review before commercialization.

---

# 32. Release Strategy

The planned product stages are:

## 32.1 Local Alpha

- Complete local chess
- Persistence
- Core interface

## 32.2 Engine Alpha

- Stockfish opponent
- Worker recovery
- Browser capability fallback

## 32.3 Human-Like AI Beta

- Maia opponent
- Calibrated profiles
- Safe fallback

## 32.4 Complete Experience Beta

- Guided review
- Human/objective comparison
- Accessibility and responsive polish

## 32.5 Release Candidate

- Security
- Performance
- itch.io
- Monitoring
- License/source

## 32.6 Stable Version 1

- Approved complete play-review loop
- Public browser and itch.io release

Detailed sequencing is defined in `11_project_roadmap.md`.

---

# 33. Feature Decision Framework

Before accepting a new feature, answer:

1. Does it support the product philosophy?
2. Does it help users play, understand, or improve?
3. Does it differentiate Caissa?
4. Can it meet the expected quality?
5. Does it introduce account, privacy, or operational complexity?
6. Can it be deferred without weakening the Version 1 promise?
7. Which existing requirement would be delayed?

A feature should not be added merely because another chess platform has it.

---

# 34. Requirement Traceability

| Requirement Area | Primary Follow-Up Document |
|---|---|
| Product philosophy | `00_product_identity.md` |
| User journeys and interaction | `02_ux_specification.md` |
| Visual system | `03_design_system.md` |
| Technology and budgets | `04_technical_specification.md` |
| Modules and state machines | `05_architecture_design.md` |
| Maia, Stockfish, and review intelligence | `06_ai_architecture.md` |
| Verification and release quality | `07_testing_strategy.md` |
| Deployment and operations | `08_deployment_and_release.md` |
| Implementation conventions | `09_coding_guidelines.md` |
| Threats, privacy, and security | `10_security_and_privacy.md` |
| Execution sequence | `11_project_roadmap.md` |

---

# 35. Locked Product Decisions

The following decisions are approved:

1. The product name is Caissa.
2. The primary slogan is “Beyond the Best Move.”
3. Caissa is browser-first and local-first.
4. No account is required for Version 1.
5. Complete legal chess is a P0 requirement.
6. Stockfish provides local objective play and analysis.
7. Maia provides human-like opponent behavior.
8. Maia and Stockfish semantics remain separate.
9. Guided review is a Version 1 requirement.
10. Explanations are evidence-backed and non-judgmental.
11. Deterministic explanation logic ships before optional LLM wording.
12. Game history is local in Version 1.
13. PGN export is required.
14. Core play remains available during Maia failure.
15. Desktop, mobile, keyboard, and touch are supported.
16. itch.io is an approved release target.
17. Accounts, multiplayer, puzzles, and personalized coaching are deferred.
18. A smaller coherent product is preferred over feature breadth.

---

# 36. Open Product Decisions

These decisions require design, technical validation, or beta evidence:

1. Final Version 1 opponent profile names
2. Exact profile-to-Elo mappings
3. Final launch time controls
4. Whether local two-player mode ships in stable Version 1
5. Number of launch board themes
6. Exact guided-review moment count
7. Whether basic local statistics ship
8. Whether PWA installation ships
9. Exact launch browser matrix
10. Whether controlled web hosting enables threaded Stockfish
11. Final beta group size
12. Exact analytics decision
13. Final public support channel
14. Exact hosting providers
15. Exact monetization direction after Version 1

These open decisions must not block Phase 1 repository setup or Phase 3 chess-core implementation.

---

# 37. Definition of Product Readiness

A feature is product-ready when:

- It solves an approved user need
- Scope is clear
- UX is defined
- Error and degraded behavior are defined
- Accessibility is considered
- Data and privacy impact are known
- Acceptance criteria exist
- Dependencies are available
- It does not contradict the product philosophy

---

# 38. Definition of Version 1 Product Completion

Caissa Version 1 is product-complete when a player can:

1. Open the product and understand what makes it different.
2. Start a game without creating an account.
3. Choose a local engine or human-like opponent.
4. Play a complete, correct, polished game.
5. Recover the game after interruption.
6. Finish and understand the result.
7. Review the decisions that mattered most.
8. See a legal better move and clear explanation.
9. Understand the difference between a natural human move and an objectively strong move.
10. Export or delete their local game data.
11. Play again with confidence that the product is accurate, respectful, and reliable.

---

# 39. Final Product Direction

Caissa is not defined by the number of chess features it contains.

It is defined by the quality of one complete experience:

```text
Play realistically
  ↓
Understand clearly
  ↓
Improve meaningfully
```

The final product principle is:

> The best chess experience is not only about finding the best move. It is about understanding the player who must make it.

Every Version 1 decision should protect that principle.
