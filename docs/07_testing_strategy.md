# Caissa — Testing Strategy

**Document ID:** CAISSA-TEST-001  
**Document Type:** Software Testing and Quality Assurance Strategy  
**Version:** 1.0  
**Status:** Approved for Implementation Planning  
**Product:** Caissa  
**Product Slogan:** Beyond the Best Move  
**Prepared:** July 2026  
**Owner:** Md. Saminul Amin  
**Primary Audience:** Frontend Engineering, Backend Engineering, AI Engineering, QA, DevOps, Product, Accessibility Reviewers, Chess Domain Reviewers, and Codex-assisted development

---

## 1. Purpose

This document defines how Caissa will be verified before release and throughout ongoing development.

It translates the Product Requirements Document, UX Specification, Design System, Technical Specification, Architecture Design Document, and AI Architecture into an actionable quality strategy covering:

- Unit testing
- Domain and chess-rule regression testing
- Component testing
- Integration testing
- Contract testing
- Browser and device testing
- End-to-end testing
- Accessibility testing
- Performance testing
- Security testing
- Persistence and migration testing
- Engine and worker testing
- Maia service testing
- AI quality evaluation
- Release qualification
- Defect management
- Continuous integration quality gates

The purpose of testing is not merely to prove that the application runs.

The purpose is to prove that:

- Chess state remains correct
- Games are recoverable
- AI outputs are safe and honest
- User interactions remain usable
- Accessibility is maintained
- itch.io builds work in the actual hosting environment
- Failures degrade safely
- Every release is traceable and reproducible

---

## 2. Related Documents

This strategy must remain consistent with:

- `00_product_identity.md`
- `01_prd.md`
- `02_ux_specification.md`
- `03_design_system.md`
- `04_technical_specification.md`
- `05_architecture_design.md`
- `06_ai_architecture.md`
- `08_deployment_and_release.md` — planned
- `09_coding_guidelines.md` — planned

When conflicts occur, apply this priority:

1. Chess correctness
2. Security and data integrity
3. Accessibility
4. Honest AI behavior
5. UX acceptance criteria
6. This testing strategy
7. Local development convenience

---

# 3. Quality Philosophy

Caissa should be tested according to risk, not according to visual prominence.

A small chess-state bug can be more serious than a major visual defect.

The quality philosophy is:

> Test the rules most deeply, the boundaries most aggressively, the user journeys most realistically, and the AI most honestly.

Caissa must not rely on:

- Manual testing alone
- Happy-path testing
- Visual inspection without interaction testing
- Engine outputs without validation
- A small number of showcase games
- Unit tests that ignore real browser behavior
- User engagement as evidence of correctness

---

# 4. Quality Objectives

## 4.1 Primary Objectives

Testing must verify that:

1. Every legal chess rule behaves correctly.
2. Illegal moves cannot be committed.
3. Clocks remain correct under delay, pause, backgrounding, and restoration.
4. Active games survive normal interruption.
5. Stockfish cannot freeze the browser.
6. Maia failures cannot corrupt a game.
7. Stale async responses are rejected.
8. Reviews do not invent chess facts.
9. The core product works without network access.
10. The itch.io build works in its actual embedded/fullscreen environment.
11. Keyboard and screen-reader users can complete core flows.
12. Performance remains within approved budgets.
13. Data migrations do not destroy saved games.
14. Release builds remain reproducible.
15. License and model provenance are traceable.

## 4.2 Secondary Objectives

Testing should also verify:

- Visual consistency
- Theme correctness
- Motion behavior
- Audio behavior
- Graceful degradation
- Browser capability fallback
- Error-message clarity
- Human-like AI believability
- Review usefulness
- Regression resistance

---

# 5. Testing Principles

## 5.1 Test Behavior, Not Implementation Detail

Tests should assert externally meaningful behavior.

Preferred:

```text
When the user promotes a pawn to a knight, the resulting FEN and PGN are correct.
```

Avoid:

```text
The component called setSelectedPromotionPiece.
```

## 5.2 Domain Logic Must Be Deterministic

Clock logic, move legality, result mapping, storage migration, and review classification must be testable without rendering React.

## 5.3 External Systems Must Be Isolated

Stockfish, Maia, IndexedDB, network, audio, and browser APIs should be accessed through adapters that can be replaced in tests.

## 5.4 Every Bug Becomes a Regression Test

A defect is not considered fully resolved until:

- The root cause is understood
- A failing test reproduces it
- The fix passes
- Nearby failure modes are considered

## 5.5 AI Fluency Is Not Evidence

An explanation that sounds professional is still incorrect if it is unsupported.

AI-related tests must verify legality, evidence, provenance, and uncertainty.

## 5.6 Accessibility Is Continuous

Accessibility testing begins with components and continues through end-to-end flows.

It is not a final release-only audit.

---

# 6. Test Pyramid

```text
                    Manual Exploratory Testing
                  Cross-Browser End-to-End Tests
               Integration and Contract Test Suites
           Component, Accessibility, and Worker Tests
      Domain, Chess Regression, Unit, and Property Tests
```

The broadest foundation is deterministic domain testing.

## 6.1 Expected Test Distribution

Approximate target distribution:

| Layer | Approximate Share |
|---|---:|
| Unit/domain/regression | 45–55% |
| Component | 15–20% |
| Integration/contract | 15–20% |
| End-to-end | 8–12% |
| Manual/exploratory/specialist review | 5–10% |

These are planning guidelines, not quotas.

---

# 7. Test Environments

Required environments:

| Environment | Purpose |
|---|---|
| Local unit | Fast deterministic developer tests |
| Local browser | Component and integration development |
| CI browser | Automated headless browser verification |
| Preview | Full application review per pull request |
| Production-like web | Headers, caching, and threaded-engine tests |
| Production-like itch | Relative paths, iframe, fullscreen, single-thread fallback |
| Maia staging | Model integration and load tests |
| Release candidate | Final qualification |

No release should be approved based only on local testing.

---

# 8. Approved Testing Tools

## 8.1 Frontend and Shared TypeScript

| Concern | Tool |
|---|---|
| Test runner | Vitest |
| Component testing | React Testing Library |
| DOM assertions | `@testing-library/jest-dom` |
| User interaction | `@testing-library/user-event` |
| End-to-end | Playwright |
| Accessibility automation | axe-core / Playwright axe integration |
| IndexedDB test support | fake-indexeddb or real browser IndexedDB |
| API mocking | MSW |
| Property testing | fast-check |
| Coverage | Vitest coverage |
| Dependency rules | dependency-cruiser or equivalent |

## 8.2 Python Maia Service

| Concern | Tool |
|---|---|
| Unit/integration runner | Pytest |
| Async testing | pytest-asyncio |
| HTTP testing | FastAPI TestClient / HTTPX |
| Property testing | Hypothesis |
| Type checking | mypy or pyright |
| Linting | Ruff |
| Coverage | coverage.py / pytest-cov |
| Load testing | Locust, k6, or approved equivalent |

## 8.3 Manual Specialist Testing

- Browser developer tools
- Screen readers
- Keyboard-only navigation
- Real mobile devices
- Chess expert review
- itch.io preview/private release testing

---

# 9. Test Classification

Every automated test should be identifiable by category.

Recommended tags:

```text
unit
domain
chess-regression
component
integration
contract
worker
persistence
migration
accessibility
performance
security
e2e
itch
maia
stockfish
ai-quality
smoke
release
```

Tests may belong to multiple categories.

---

# 10. Domain Unit Testing

## 10.1 Scope

Domain unit tests cover framework-independent logic.

Required modules include:

- Game controller
- Clock service
- Game result mapping
- Move serialization
- PGN utilities
- FEN validation
- Opponent proposal validation
- Capability-profile derivation
- Difficulty profile mapping
- Review classification
- Chess feature detectors
- Explanation templates
- Cache-key generation
- Version metadata

## 10.2 Rules

Domain tests must:

- Avoid React
- Avoid real network
- Avoid real IndexedDB unless testing repository behavior
- Avoid wall-clock dependence
- Use injected time
- Use deterministic inputs
- Run quickly

## 10.3 Coverage Target

Recommended:

- Critical domain modules: 90%+ branch coverage
- General utilities: 80%+ branch coverage
- Generated or trivial mapping code may be exempted with justification

Coverage percentage is not a substitute for scenario quality.

---

# 11. Chess Regression Suite

The chess regression suite is the most important automated suite in Caissa.

## 11.1 Move Legality

Test:

- Normal piece movement
- Blocked sliding pieces
- Pawn movement
- Double pawn move
- Pawn captures
- Knight movement
- King movement
- Moving into check
- Pinned pieces
- Illegal self-check
- Capture legality

## 11.2 Castling

Required cases:

- White kingside castling
- White queenside castling
- Black kingside castling
- Black queenside castling
- Castling after king moved
- Castling after rook moved
- Castling through check
- Castling out of check
- Castling into check
- Blocked castling
- Restored FEN castling rights
- Undo after castling

## 11.3 En Passant

Required cases:

- Legal en passant
- Expired en passant opportunity
- En passant exposing own king
- En passant resolving check
- Correct FEN target square
- Correct PGN notation
- Undo restoration

## 11.4 Promotion

Required cases:

- Queen promotion
- Rook promotion
- Bishop promotion
- Knight promotion
- Capture promotion
- Promotion with check
- Promotion with mate
- Underpromotion correctness
- Keyboard promotion flow
- Undo after promotion

## 11.5 Check and Mate

Required cases:

- Check detection
- Double check
- Discovered check
- Checkmate
- Smothered mate
- Back-rank mate
- Promotion mate
- Escape from check
- Illegal response while in check

## 11.6 Draw Conditions

Required cases:

- Stalemate
- Insufficient material
- Threefold repetition
- Fifty-move rule
- Agreed draw, if implemented
- Draw after timeout where material rules require special handling
- Repetition after restoration

## 11.7 PGN and FEN

Required cases:

- PGN export
- PGN import
- PGN round trip
- FEN round trip
- Headers
- Result notation
- Special moves
- Comments ignored or handled safely
- Invalid PGN
- Invalid FEN
- Very long game
- Unicode metadata sanitization

## 11.8 Undo and Restart

Required cases:

- Undo one local move
- Undo player plus AI reply
- Undo after capture
- Undo after castling
- Undo after promotion
- Undo while AI request is pending
- Restart active game
- Result cleared correctly
- Clock restored correctly
- Review data invalidated correctly

---

# 12. Property-Based Testing

Property testing should verify invariants across generated scenarios.

## 12.1 Candidate Properties

Examples:

- Applying a legal move increases ply by exactly one.
- Undo restores the previous FEN.
- Exporting and re-importing PGN preserves final position.
- A committed move appears exactly once in history.
- A completed game has no active clock.
- Illegal engine proposals never alter state.
- Stale request IDs never alter state.
- Clock remaining time never increases except by configured increment.
- Candidate probabilities contain no NaN or negative values.
- Storage migration preserves PGN.

## 12.2 Limits

Property tests do not replace curated chess scenarios.

Generated positions must be legal or explicitly marked as invalid-input tests.

---

# 13. Clock Testing

Clock logic requires deterministic simulated time.

## 13.1 Cases

Test:

- Start white clock
- Start black clock
- Move commit
- Increment
- No-increment mode
- Pause
- Resume
- Tab hidden
- Delayed callback
- Long inactivity
- Timeout
- Simultaneous move/timeout boundary
- Restoration
- Undo
- Restart
- Game completion
- No-clock mode

## 13.2 Timing Boundary Tests

Test around:

- 0 ms
- 1 ms
- Exact expiration
- One millisecond before expiration
- Increment at zero boundary
- Multiple pause/resume cycles
- Browser throttling simulation

## 13.3 Prohibited Test Pattern

Do not use real `setTimeout` waits for core clock-unit tests.

Inject time.

---

# 14. State Machine Testing

Every approved state machine must have transition tests.

## 14.1 Game State Machine

Verify:

- Valid transitions
- Invalid transitions rejected
- Terminal-state immutability
- Board input disabled during commit
- Opponent request only from valid phase
- Pause/resume phase restoration
- Recovery state behavior

## 14.2 Stockfish Worker State

Verify:

- Loading to ready
- Ready to searching
- Search to stop
- Search to best move
- Crash to failed
- Failed to recreated
- Dispose behavior
- Stale result rejection

## 14.3 Maia Worker Pool State

Verify:

- Worker starting
- Ready
- Busy
- Unhealthy
- Restarting
- Queue timeout
- Pool saturation
- Graceful shutdown

## 14.4 Review State

Verify:

- Not started
- Preparing
- Analyzing
- Partial
- Composing
- Ready
- Failed
- Retry
- Exploration reset

---

# 15. Component Testing

Component tests verify user-visible behavior in isolation.

## 15.1 Chessboard Adapter

Test:

- Position rendering
- Orientation
- Legal target display
- Selection
- Drag move
- Click move
- Touch-equivalent event handling
- Invalid drop
- Check highlight
- Last move
- Disabled state
- Keyboard focus
- Accessible square names

The board adapter test suite should be reusable if the underlying board library changes.

## 15.2 Promotion Chooser

Test:

- All four choices
- Keyboard navigation
- Escape behavior
- Focus trapping
- Mobile sheet behavior
- Position-adjacent behavior
- No implicit queen choice unless configured

## 15.3 Clock Component

Test:

- Active state
- Low-time state
- Expired state
- Tabular layout stability
- Accessible label
- Reduced motion

## 15.4 Move History

Test:

- SAN rendering
- Numbering
- Latest move
- Current review move
- Auto-scroll
- Manual browse behavior
- Mobile drawer
- Keyboard navigation

## 15.5 Setup Controls

Test:

- Opponent selection
- Difficulty
- Color
- Time control
- Default restoration
- Start validation
- Loading state
- Engine unavailable state

## 15.6 Result and Review Components

Test:

- Win/loss/draw messages
- Result reason
- Review action
- Rematch
- Critical moment card
- Better move
- Confidence
- Partial review
- Error state
- Try-the-move interaction

---

# 16. Accessibility Testing

## 16.1 Automated Accessibility

Automated checks should run on:

- Home
- Setup
- Active game
- Promotion
- Game result
- Guided review
- Settings
- History
- Error states
- Mobile navigation

Check:

- Missing names
- Contrast violations detectable by tool
- Invalid ARIA
- Duplicate IDs
- Focusable hidden elements
- Dialog semantics
- Landmark structure

## 16.2 Keyboard Testing

A keyboard-only user must be able to:

- Navigate the app
- Configure a game
- Start a game
- Select and move pieces
- Promote a pawn
- Open game controls
- Resign or restart
- Complete a game
- Navigate review
- Export PGN
- Change settings

## 16.3 Screen Reader Testing

Manual screen-reader tests should cover at least:

- NVDA with Chrome or Firefox on Windows
- VoiceOver with Safari on macOS or iOS where available

Verify:

- Board entry announcement
- Square navigation
- Piece identity
- Legal move announcement
- Last move
- Check
- Result
- Dialog focus
- Move history
- Review explanation

## 16.4 Reduced Motion

Verify:

- Media query respected
- Board flip reduced
- Pulses removed
- Result celebration removed
- Essential movement remains understandable

## 16.5 Color and Contrast

Verify:

- Text contrast
- Focus ring
- Selected square
- Legal marker
- Capture marker
- Check state
- Move classification
- Active clock
- Disabled controls

Color must not be the only signal.

---

# 17. Integration Testing

Integration tests verify collaboration across modules.

Required integrations:

- Game controller plus chess.js
- Game controller plus clock
- Game controller plus repository
- Game controller plus opponent provider
- Stockfish adapter plus worker transport
- Maia client plus API contract
- Review orchestrator plus Stockfish
- Review classifier plus feature detectors
- Explanation composer plus structured evidence
- Settings store plus persistence
- App bootstrap plus database migration
- Capability detection plus engine selection

---

# 18. Persistence Testing

## 18.1 Repository Tests

Verify:

- Save active game
- Restore active game
- Save completed game
- Clear active marker
- List history
- Delete game
- Save review
- Cache analysis
- Clear cache independently

## 18.2 Transaction Tests

Verify:

- Move and clock snapshot saved together
- Terminal result saved correctly
- Active marker cleared after completion
- Failed transaction does not produce inconsistent partial records

## 18.3 Corruption Tests

Simulate:

- Missing fields
- Invalid schema version
- Invalid FEN
- PGN mismatch
- Corrupt review
- Corrupt cache
- Duplicate ID
- Interrupted migration

Expected behavior:

- Preserve recoverable PGN
- Enter recovery state
- Clear disposable cache only
- Never silently discard valid game data

---

# 19. Migration Testing

Every database schema change requires:

- Forward migration test
- Idempotency test
- Existing-data preservation test
- Corrupt-data handling test
- Roll-forward compatibility review
- Export validation

Maintain fixture databases from prior versions.

Example:

```text
fixtures/db/v1/
fixtures/db/v2/
fixtures/db/corrupted/
```

No release may include an untested migration.

---

# 20. Stockfish Testing

## 20.1 UCI Parser Tests

Use recorded transcripts to test:

- `uciok`
- `readyok`
- `id`
- `option`
- `info depth`
- `info score cp`
- `info score mate`
- `multipv`
- `pv`
- `bestmove`
- `ponder`
- malformed output
- excessive output
- unknown lines

## 20.2 Worker Tests

Verify:

- Initialization
- Readiness
- Search
- Stop
- Cancellation
- Recreate after crash
- Dispose
- Stale search ignored
- Option reapplication
- Single-thread mode
- Threaded capability selection

## 20.3 Analysis Tests

Use stable known positions to verify:

- Legal best move
- Mate detection
- Evaluation sign convention
- MultiPV count
- Position history handling
- Search profile mapping

Tests should avoid requiring exact centipawn equality across engine builds unless the version is pinned and tolerance is appropriate.

## 20.4 Browser Performance Tests

Measure:

- Worker startup
- First move latency
- Search cancellation latency
- Main-thread responsiveness
- Memory behavior
- Repeated game cleanup

---

# 21. Maia Service Testing

## 21.1 API Validation

Test:

- Valid request
- Invalid FEN
- Inconsistent history
- Unsupported Elo
- Unknown profile
- Excessive candidate count
- Missing request ID
- Oversized body
- Invalid side to move

## 21.2 Worker Pool

Test:

- Warm startup
- Acquire/release
- Queue saturation
- Acquisition timeout
- Worker crash
- Worker restart
- No ready workers
- Graceful shutdown
- Readiness state

## 21.3 Output Validation

Test:

- Legal selected move
- Duplicate candidates
- Illegal candidate
- NaN probability
- Negative probability
- Missing selected move
- Malformed WDL
- Wrong model identity
- Timeout
- Unexpected process exit

## 21.4 Contract Tests

The TypeScript client and FastAPI service must agree on:

- Request schema
- Response schema
- Error schema
- Profile IDs
- Model IDs
- Version fields

OpenAPI-based compatibility checks should run in CI.

---

# 22. AI Quality Testing

AI quality testing is distinct from software correctness testing.

## 22.1 Maia Metrics

Evaluate:

- Top-1 move match
- Top-3 coverage
- Top-5 coverage
- Negative log-likelihood
- Mean reciprocal rank
- Calibration error
- Probability entropy
- Illegal output rate
- Candidate duplication rate
- Latency
- Diversity
- Game-playing strength estimate

## 22.2 Segmentation

Report metrics by:

- Rating band
- Opening/middlegame/endgame
- Tactical vs quiet position
- White vs Black
- Position complexity
- Time-control category where available
- Winning/equal/losing state

Overall averages alone are insufficient.

## 22.3 Opponent Playtesting

Human testers should assess:

- Believability
- Difficulty
- Repetition
- Variety
- Tactical realism
- Positional realism
- Whether mistakes feel natural
- Whether strength label feels fair

## 22.4 Stockfish Comparison

Do not evaluate Maia only by agreement with Stockfish.

Measure:

- Human move match
- Difference from Stockfish
- Objective loss distribution
- Human plausibility
- Game quality

---

# 23. Review Intelligence Testing

## 23.1 Critical Position Selection

For curated games, verify:

- Important turning point selected
- Forced sequence not over-counted
- Redundant moments suppressed
- Short game produces few moments
- Long game remains focused

## 23.2 Classification

Test:

- Best
- Strong
- Good
- Inaccuracy
- Mistake
- Blunder
- Missed opportunity
- Forced

Include:

- Mate transitions
- Winning-to-equal
- Equal-to-losing
- Already-lost positions
- Forced moves
- Sacrifices
- Quiet positional improvements

## 23.3 Feature Detectors

Each detector needs:

- Positive fixtures
- Negative fixtures
- Ambiguous fixtures
- Multi-motif positions

Examples:

- Fork
- Pin
- Skewer
- Hanging piece
- Back-rank weakness
- Passed pawn
- King exposure
- Open file
- Simplification
- Promotion threat

## 23.4 Explanation Tests

Verify:

- Every factual claim maps to evidence
- No illegal line
- No unsupported intent
- Correct move notation
- Correct piece/square mention
- Appropriate uncertainty
- Tone is non-judgmental
- Length within limits
- Fallback explanation available
- Conflicting Maia/Stockfish evidence described honestly

---

# 24. Golden Test Set

Maintain a locked golden suite of:

- Chess positions
- Full games
- Maia responses
- Stockfish transcripts
- Review outputs
- Explanation evidence

Each golden record should include:

```text
fixture_id
source
license/provenance
position
history
expected legal moves
expected invariants
engine/model versions
expected classification range
expected evidence
notes
```

Golden tests should be reviewed before intentional updates.

---

# 25. End-to-End Testing

## 25.1 Critical User Journeys

Required E2E flows:

1. First-time visitor starts a game
2. Returning visitor resumes a game
3. User makes legal moves
4. Illegal move rejected
5. Pawn promotion
6. Castling
7. En passant
8. Checkmate
9. Stalemate
10. Timeout
11. Resign
12. Undo against AI
13. Restart
14. Refresh and restore
15. Game completion and PGN export
16. Guided review
17. Advanced review navigation
18. Settings persistence
19. Offline local game
20. Maia failure and fallback
21. Stockfish crash and recovery
22. Keyboard-only game
23. Mobile setup and play
24. itch.io launch

## 25.2 E2E Test Design

E2E tests should:

- Use deterministic fixtures where possible
- Avoid depending on live production Maia
- Use stubbed Maia in general CI
- Run a smaller real-model smoke suite separately
- Capture trace, video, and screenshot on failure
- Use stable accessible selectors

## 25.3 E2E Anti-Patterns

Avoid:

- Brittle CSS selectors
- Arbitrary sleep delays
- One enormous test for the entire app
- Exact animation timing assertions
- Live third-party dependency in every CI run

---

# 26. Cross-Browser Testing

## 26.1 Required Browsers

At release time, test current supported versions of:

- Chrome
- Edge
- Firefox
- Safari

Mobile:

- Android Chrome
- iOS Safari

## 26.2 Priority Matrix

| Feature | Chrome | Firefox | Safari | Mobile |
|---|---:|---:|---:|---:|
| Local game | Required | Required | Required | Required |
| IndexedDB | Required | Required | Required | Required |
| Stockfish single-thread | Required | Required | Required | Required where supported |
| Threaded Stockfish | Controlled host only | Controlled host only | Capability-dependent | Not required |
| Audio | Required | Required | Required | Required |
| Fullscreen | Required | Required | Required | Required |
| Keyboard board | Required | Required | Required | External keyboard where practical |

---

# 27. itch.io Testing

## 27.1 Package Validation

Automated release script must verify:

- `index.html` at ZIP root
- Relative asset paths
- No missing assets
- Case-correct filenames
- File count below limit
- Total size below limit
- Individual file size below limit
- No source secrets
- Third-party notices included where required

## 27.2 Runtime Testing

Verify in actual private itch.io upload:

- Launch button
- Fullscreen
- Embedded mode
- Responsive sizing
- Keyboard focus
- Audio unlock
- Local storage
- Refresh
- External Maia API
- Offline behavior
- Single-thread Stockfish
- Mobile launch

## 27.3 Browser Console

No release should produce unhandled errors in normal itch.io use.

---

# 28. Visual Regression Testing

Visual regression may be used for stable screens:

- Home
- Setup
- Active game
- Result
- Guided review
- Settings
- History
- Error state
- Mobile layouts

Rules:

- Use fixed viewport and data
- Disable non-essential animation
- Use deterministic fonts/assets
- Review diffs manually
- Do not approve broad baseline updates without inspection

Visual tests do not replace accessibility or interaction tests.

---

# 29. Design System Testing

Verify:

- Token usage
- No unapproved colors
- Button variants
- Focus states
- Disabled states
- Loading states
- Error states
- Responsive behavior
- Typography scale
- Board theme contrast
- Piece visibility
- Reduced motion

Architecture linting may detect:

- Literal colors
- Direct icon-library violations
- Unapproved inline styles
- Restricted imports

---

# 30. Performance Testing

## 30.1 Frontend Budgets

Measure:

- Initial JavaScript
- CSS
- Total app-shell transfer
- LCP
- CLS
- INP
- Long tasks
- Memory
- Route loading
- Engine startup

## 30.2 Gameplay Performance

Measure:

- Piece selection latency
- Move-commit response
- Clock-render stability
- Board animation FPS
- Move-history update
- AI response presentation
- Worker cancellation

## 30.3 Review Performance

Measure:

- Time to first insight
- Time to full guided review
- Number of positions analyzed
- Main-thread blocking
- Memory growth
- Cancellation behavior

## 30.4 Load Profiles

Test at:

- Mid-tier laptop
- Lower-powered laptop
- Modern desktop
- Mid-tier Android device
- iPhone/Safari where available

## 30.5 Regression Threshold

A performance regression beyond approved tolerance blocks release unless documented and approved.

---

# 31. Maia Load and Reliability Testing

## 31.1 Load Scenarios

Test:

- One user
- Normal expected concurrency
- Peak expected concurrency
- Queue saturation
- Worker restart during load
- Model startup
- Repeated timeout
- Rate-limit enforcement

## 31.2 Metrics

Capture:

- Throughput
- P50/P95/P99 latency
- Queue wait
- Timeout rate
- Error rate
- Worker restart
- CPU
- Memory
- Model load time
- Request rejection under overload

## 31.3 Soak Testing

Run a sustained test to detect:

- Memory leak
- Process degradation
- Queue growth
- Zombie workers
- File descriptor leak
- Increasing latency

---

# 32. Security Testing

## 32.1 Frontend

Test:

- Malicious PGN headers
- Script content in metadata
- Invalid FEN
- Oversized import
- Unsafe URL
- XSS attempts
- CSP behavior
- No secret exposure
- Dependency audit

## 32.2 Maia Service

Test:

- Oversized body
- Invalid JSON
- Unexpected fields
- Rate-limit bypass attempts
- Queue exhaustion
- Command injection attempts
- Arbitrary model path attempts
- Malformed UCI output
- Log injection
- CORS
- Timeout
- Process crash

## 32.3 Dependency Security

CI should run:

- Package audit
- Python dependency scan
- Secret scanning
- License scan
- Container image scan

Critical vulnerabilities block release unless risk is explicitly accepted.

---

# 33. Privacy Testing

Verify:

- No account required
- No unexpected remote game-history upload
- No full PGN sent in telemetry by default
- Settings opt-out works
- Local data clear works
- PGN export works before deletion
- Maia request contains only required data
- Logs exclude unnecessary game data
- Analytics failure does not block gameplay

---

# 34. Offline and Degraded-Mode Testing

Required modes:

## Full

- Local core
- Stockfish
- Maia

## Local Enhanced

- Local core
- Stockfish
- No Maia

## Local Basic

- Local core only

## Recovery

- Read/export saved data

Test transitions between modes during an active session.

Examples:

- Network lost before Maia request
- Network lost during Maia request
- Stockfish worker crashes
- IndexedDB unavailable
- Audio blocked
- Review partially completed

---

# 35. Error-State Testing

Every defined error must have:

- Trigger test
- Recovery test
- User-message test
- Data-preservation test
- Observability test where applicable

Required examples:

- Engine unavailable
- Engine timeout
- Maia busy
- Storage failure
- Migration failure
- Unsupported browser
- Invalid restored state
- Corrupt cache
- API contract mismatch
- Offline mode

---

# 36. Manual Exploratory Testing

Exploratory sessions should use charters.

Example charters:

- Attempt to break promotion and undo
- Switch tabs repeatedly during clocked play
- Rapidly restart games while engine requests are pending
- Use the app only with keyboard
- Use a narrow mobile viewport
- Force offline mode during review
- Import unusual PGNs
- Play repeated rematches against one Maia profile
- Examine whether feedback feels judgmental
- Attempt to create stale AI responses

Each session records:

- Charter
- Environment
- Findings
- Severity
- Screenshots/video
- Follow-up tests

---

# 37. Chess Expert Review

A chess-knowledgeable reviewer should evaluate:

- Move classifications
- Tactical motif labels
- Critical moment selection
- Suggested alternatives
- Explanation accuracy
- Human-like opponent behavior
- Rating-label credibility
- Endgame claims
- Opening names

Expert review is required for AI review release candidates.

---

# 38. Usability Testing

## 38.1 First-Time User Test

Observe whether a new user can:

- Understand the product promise
- Start a game
- Move pieces
- Recognize turn and clock
- Complete or exit
- Understand the result
- Open review

## 38.2 Review Comprehension

Ask users:

- What was the main lesson?
- Did the explanation feel fair?
- Was the better move understandable?
- Did engine data overwhelm the screen?
- Would they play again?

## 38.3 Mobile Usability

Verify:

- Board size
- Tap accuracy
- Promotion
- Drawers
- Clocks
- Move history
- Fullscreen
- Orientation changes

---

# 39. Defect Severity

## Severity 0 — Release Stopper

Examples:

- Game state corruption
- Legal move rejected broadly
- Illegal move accepted
- Saved games destroyed
- Remote code execution
- Major data leak

## Severity 1 — Critical

Examples:

- Checkmate/result wrong
- Clock materially wrong
- Maia move commits to wrong position
- App unusable in primary browser
- Keyboard users cannot play
- itch.io build fails

## Severity 2 — Major

Examples:

- Review fact incorrect
- Restoration fails in common case
- Stockfish cannot recover
- Major responsive failure
- Important accessibility defect

## Severity 3 — Moderate

Examples:

- Non-critical setting not persisted
- Minor visual regression
- Rare error copy issue
- Secondary chart issue

## Severity 4 — Minor

Examples:

- Cosmetic spacing
- Low-impact copy issue
- Minor animation inconsistency

---

# 40. Release Blocking Policy

A stable release is blocked by:

- Any open Severity 0
- Any open Severity 1
- Unapproved Severity 2 affecting a core flow
- Failed chess regression suite
- Failed migration suite
- Failed itch.io smoke test
- Failed accessibility core-flow test
- Critical security issue
- AI illegal-output failure
- Missing license/provenance records

Severity 3 and 4 issues may ship only if documented.

---

# 41. Continuous Integration

Recommended CI stages:

```text
1. Install and cache dependencies
2. Static analysis
3. Type checking
4. Unit/domain tests
5. Chess regression suite
6. Component tests
7. Python service tests
8. Contract tests
9. Build web
10. Build itch
11. Architecture checks
12. Security/license scans
13. Browser smoke tests
14. Coverage and artifact upload
```

Longer suites may run:

- Nightly
- On release candidate
- On engine/model change

---

# 42. Pull Request Quality Gates

A pull request may merge only when:

- Required CI passes
- Tests added for changed behavior
- No architecture rule violated
- No unexpected bundle regression
- Public contracts updated
- Documentation updated where needed
- Accessibility considered
- Chess changes reviewed
- AI changes include evaluation evidence
- Migration changes include old-version fixtures

---

# 43. Branch and Release Testing

## 43.1 Feature Branch

Required:

- Unit tests
- Relevant component tests
- Static checks

## 43.2 Main Branch

Required:

- Full automated suite
- Browser smoke
- Preview deployment

## 43.3 Beta Candidate

Required:

- Cross-browser
- Real Maia smoke
- itch.io private upload
- Accessibility review
- Performance review
- Chess expert review
- Manual exploratory session

## 43.4 Stable Candidate

Required:

- Zero release blockers
- Full release checklist
- Reproducible artifacts
- Provenance records
- Rollback plan
- Signed approval

---

# 44. Test Data Management

## 44.1 Fixture Categories

```text
fixtures/
├── fen/
├── pgn/
├── clocks/
├── stockfish/
├── maia/
├── reviews/
├── persistence/
├── accessibility/
└── screenshots/
```

## 44.2 Fixture Requirements

Each fixture should record:

- ID
- Purpose
- Source
- License/provenance
- Expected behavior
- Version
- Notes

## 44.3 Sensitive Data

Do not use private user games in public fixtures without consent and anonymization.

---

# 45. Test Naming

Recommended format:

```text
given_<context>_when_<action>_then_<outcome>
```

Example:

```text
given_castling_path_is_attacked_when_white_castles_then_move_is_rejected
```

UI tests may use descriptive sentences.

---

# 46. Flaky Test Policy

A flaky test is a defect.

Rules:

- Do not rerun indefinitely until green.
- Quarantine only with issue and owner.
- Fix root cause quickly.
- Track quarantine duration.
- No flaky chess or migration test may be ignored for release.

Common prevention:

- Inject time
- Avoid arbitrary waits
- Use deterministic AI stubs
- Use stable selectors
- Reset storage
- Isolate worker lifecycle
- Seed randomized tests

---

# 47. Test Coverage Reporting

Coverage reports should be segmented by:

- Chess core
- Clock
- Persistence
- Worker adapters
- Maia service
- Review logic
- UI components

Do not optimize for a single repository-wide percentage.

Critical-path untested branches must be reviewed even if overall coverage is high.

---

# 48. Quality Dashboards

Recommended release dashboard:

- CI pass rate
- Open defects by severity
- Chess regression status
- Browser matrix status
- Accessibility status
- Bundle size
- Performance metrics
- Maia latency/error
- Worker crash rate
- AI benchmark comparison
- Test flakiness
- Release checklist status

---

# 49. Codex Testing Protocol

Every Codex implementation task must include testing requirements.

Example:

```text
Implement active-game restoration.

Required tests:
- Restore a normal active game.
- Preserve clock metadata.
- Reject invalid schema.
- Recover valid PGN from corrupt optional metadata.
- Do not call the opponent provider during restoration until the restored phase requires it.
- Add an integration test using isolated IndexedDB.
- Do not modify unrelated repositories.
```

Codex must not:

- Delete failing tests to pass CI
- Weaken assertions without justification
- Replace deterministic tests with sleeps
- Mock the exact code under test
- Add snapshot tests as the only verification of critical logic

---

# 50. Initial Test Milestones

## Milestone 1 — Foundation

- Test runners configured
- CI configured
- Coverage configured
- Architecture checks
- Shared fixture structure

## Milestone 2 — Chess Core

- Move legality
- Special rules
- Results
- PGN/FEN
- Clock
- State machine

## Milestone 3 — Persistence

- Repository
- Migration
- Restoration
- Corruption recovery

## Milestone 4 — Play UI

- Board
- Promotion
- Setup
- Clock
- Move history
- Accessibility

## Milestone 5 — Stockfish

- Parser
- Worker
- Cancellation
- Recovery
- Browser performance

## Milestone 6 — Maia

- API
- Worker pool
- Output validation
- Contract
- Load
- Fallback

## Milestone 7 — Review

- Position selection
- Classification
- Detectors
- Explanations
- Expert review

## Milestone 8 — Release

- Cross-browser
- itch.io
- Performance
- Security
- Accessibility
- Release sign-off

---

# 51. Locked Testing Decisions

The following are approved:

1. Vitest is the TypeScript unit-test runner.
2. React Testing Library is used for component behavior.
3. Playwright is used for end-to-end testing.
4. Pytest is used for the Maia service.
5. The chess regression suite is a release gate.
6. Every bug requires a regression test.
7. Core clock tests use injected time.
8. General CI uses deterministic Maia stubs.
9. Real-model Maia smoke tests run separately.
10. Every engine response is validated in tests.
11. Accessibility testing is both automated and manual.
12. itch.io is tested through an actual private upload.
13. Database migrations require prior-version fixtures.
14. AI explanations require evidence-backed tests.
15. Visual regression does not replace interaction testing.
16. No stable release ships with Severity 0 or Severity 1 defects.
17. Architecture dependency rules run in CI.
18. AI model upgrades require benchmark comparison.
19. Test flakiness is treated as a defect.
20. Release qualification includes chess expert review.

---

# 52. Open Testing Decisions

Resolve during implementation:

1. Exact coverage thresholds per package
2. Exact accessibility automation integration
3. Exact load-testing tool
4. Exact visual-regression platform
5. Exact real-device lab availability
6. Exact supported Safari versions at launch
7. Exact AI benchmark dataset
8. Exact chess expert review process
9. Exact performance test hardware baseline
10. Exact defect tracking system
11. Exact release sign-off roles
12. Whether mutation testing is introduced
13. Whether contract types are generated from OpenAPI
14. Exact golden-suite update approval process
15. Exact telemetry used for production-quality monitoring

---

# 53. Testing Acceptance Criteria

This strategy is implementation-ready when:

- Test layers are defined.
- Core chess scenarios are enumerated.
- AI and engine tests are separated from normal UI tests.
- Persistence and migration testing are defined.
- Accessibility and browser matrices are defined.
- itch.io release testing is defined.
- Performance and security scopes are defined.
- Release-blocking policy is defined.
- CI stages are defined.
- Defect severity is defined.
- Test fixtures and provenance are defined.
- Codex testing rules are defined.
- Release qualification includes specialist review.

---

# 54. Definition of Done for Testing Infrastructure

Testing infrastructure is complete when:

1. All approved test runners work from a clean checkout.
2. CI runs static, unit, regression, integration, and build checks.
3. Chess regression fixtures are versioned.
4. Coverage is reported by critical package.
5. Browser smoke tests run automatically.
6. IndexedDB tests are isolated.
7. Maia service tests run without downloading a model in normal CI.
8. A separate real-model smoke workflow exists.
9. Architecture rules are enforced automatically.
10. Failure artifacts are uploaded.
11. Flaky-test tracking exists.
12. Release checklist can reference objective test evidence.

---

# 55. Definition of Done for Version 1 Quality

Caissa Version 1 is quality-approved when:

1. All chess regression tests pass.
2. No illegal move can be committed through UI or engine path.
3. Clocks pass deterministic boundary tests.
4. Active games restore correctly.
5. Completed games export valid PGN.
6. Stockfish runs outside the main thread and recovers from failure.
7. Maia responses are validated and stale responses ignored.
8. Maia failure degrades safely.
9. Guided review contains no unsupported factual claims in the release suite.
10. Core flows pass keyboard testing.
11. Core screens pass accessibility review.
12. Supported browsers pass smoke testing.
13. The private itch.io build passes runtime verification.
14. Performance budgets are met or exceptions approved.
15. Security and license scans pass.
16. Database migrations preserve prior fixtures.
17. No Severity 0 or Severity 1 defect remains.
18. Chess expert review approves the release sample.
19. Release artifacts are reproducible and versioned.
20. The player’s game remains recoverable under every tested failure mode.

---

# 56. Final Testing Direction

Caissa should not be considered reliable because it has many tests.

It should be considered reliable because the tests protect the things that matter most:

- The legality of the game
- The accuracy of the clock
- The integrity of saved progress
- The honesty of AI output
- The accessibility of interaction
- The recoverability of failure

The final testing principle is:

> A beautiful game is not finished when it looks complete.  
> It is finished when its rules, data, AI, and user experience remain trustworthy under pressure.
