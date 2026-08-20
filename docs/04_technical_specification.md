# Caissa — Technical Specification

**Document ID:** CAISSA-TS-001  
**Document Type:** Technical Specification  
**Version:** 1.0  
**Status:** Approved for Architecture Design  
**Product:** Caissa  
**Product Slogan:** Beyond the Best Move  
**Prepared:** July 2026  
**Owner:** Md. Saminul Amin  
**Primary Audience:** Frontend Engineering, Backend Engineering, AI Engineering, QA, DevOps, Product Design, and Codex-assisted development

---

## 1. Purpose

This document defines the technical foundation of Caissa.

It freezes the initial technology choices, runtime boundaries, browser support policy, local storage model, chess-engine strategy, Maia-3 integration model, deployment constraints, performance budgets, security requirements, dependency rules, testing obligations, and technical release criteria.

This specification answers:

- Which technologies will be used?
- Which responsibilities belong in the browser?
- Which responsibilities require a backend?
- How will Stockfish and Maia-3 be integrated?
- How will Caissa remain usable on itch.io?
- How will games and preferences be stored?
- Which technical capabilities are required for Version 1.0?
- Which implementation patterns are permitted or prohibited?
- What must be proven before architecture and coding begin?

This document does not define the complete component tree, module graph, API implementation, database schema, CI workflow, or sprint backlog. Those details belong to later documents.

---

## 2. Related Documents

This specification should be read alongside:

- `00_product_identity.md`
- `01_prd.md`
- `02_ux_specification.md`
- `03_design_system.md`
- `05_architecture_design.md` — next
- `06_ai_architecture.md` — planned
- `07_testing_strategy.md` — planned
- `08_deployment_and_release.md` — planned
- `09_coding_guidelines.md` — planned

When documents conflict, use this order:

1. Chess correctness
2. Security and data integrity
3. Accessibility
4. UX requirements
5. This technical specification
6. Architecture implementation preference
7. Local developer convenience

---

## 3. Technical Vision

Caissa will be a browser-first chess application with a local-first core and optional network-enhanced AI capabilities.

The product must remain playable when advanced AI services are unavailable.

The technical design should support this hierarchy:

```text
Core chess gameplay
        ↓
Local persistence
        ↓
Local Stockfish analysis
        ↓
Remote Maia-3 human-like play
        ↓
Advanced review and explanation services
```

A failure in a higher layer must not destroy a lower-layer experience.

Examples:

- If Maia is unavailable, local chess and Stockfish practice still work.
- If Stockfish fails, the completed game remains valid and exportable.
- If review generation fails, the PGN and result remain available.
- If the network is offline, local play and saved history remain usable.

---

## 4. Technical Principles

### 4.1 Correctness Before Convenience

Chess state, legal moves, clocks, results, PGN, and restoration must be correct before visual polish or AI enrichment.

### 4.2 Browser First

The core game should run entirely in the browser.

The frontend must not depend on a backend for:

- Legal move validation
- Board state
- Game result detection
- Local clocks
- Local history
- Settings
- PGN import/export
- Basic Stockfish play and analysis

### 4.3 Local First

The first release should store user data locally unless a feature explicitly requires remote processing.

### 4.4 Optional Intelligence

Maia and advanced review services are enhancements, not prerequisites for basic use.

### 4.5 Explicit Runtime Boundaries

CPU-intensive chess engines must not run on the browser main thread.

### 4.6 Progressive Capability

The application must detect browser capabilities and select the safest supported engine mode.

### 4.7 Replaceable Integrations

External engines, board libraries, storage adapters, and remote AI services must be accessed through internal interfaces.

### 4.8 Measured Performance

Performance budgets are release requirements, not suggestions.

### 4.9 License Awareness

Stockfish and Maia-3 have copyleft licenses. Distribution and network use must be handled transparently and reviewed before public release.

---

# 5. Approved Technology Stack

## 5.1 Frontend

| Concern | Technology | Status |
|---|---|---|
| Framework | React | Approved |
| Language | TypeScript with strict mode | Approved |
| Build tool | Vite | Approved |
| Styling | Tailwind CSS v4 plus semantic CSS variables | Approved |
| Routing | React Router | Approved |
| Global client state | Zustand | Approved |
| Server state | TanStack Query | Conditional |
| Chess rules | chess.js | Approved |
| Initial board renderer | react-chessboard behind an adapter | Approved |
| Animation | Framer Motion | Approved |
| Audio | Howler.js | Approved |
| Charts | Recharts | Approved |
| Icons | Lucide React | Approved |
| Local structured storage | IndexedDB through Dexie | Approved |
| Unit testing | Vitest | Approved |
| Component testing | React Testing Library | Approved |
| End-to-end testing | Playwright | Approved |
| Runtime validation | Zod | Approved |
| Formatting | Prettier | Approved |
| Static analysis | ESLint | Approved |

Exact package versions will be selected from stable releases at implementation kickoff and locked through the package manager lockfile.

No dependency may use an unpinned floating version in production.

## 5.2 Backend and AI Service

| Concern | Technology | Status |
|---|---|---|
| Language | Python 3.12 or approved stable equivalent | Approved |
| API framework | FastAPI | Approved |
| ASGI server | Uvicorn | Approved |
| Chess representation | python-chess | Approved |
| Maia integration | Official `maia3` package/UCI entry point | Approved |
| Validation | Pydantic | Approved |
| HTTP client | HTTPX | Approved |
| Testing | Pytest | Approved |
| Containerization | Docker | Approved |
| Process supervision | Platform/container runtime | Approved |
| Optional cache | Redis | Deferred |
| Persistent relational DB | None for v1 local-first scope | Deferred |

## 5.3 Package Manager

Recommended frontend package manager:

```text
pnpm
```

Reasons:

- Deterministic workspace support
- Efficient dependency storage
- Strong lockfile behavior
- Suitable for future monorepo structure

Use a single package manager across the repository.

---

# 6. Versioning Policy

## 6.1 Runtime Versions

The project must define runtime versions in repository configuration.

Recommended:

```text
Node.js: active LTS at implementation kickoff
Python: 3.12.x or newer compatible stable version
pnpm: pinned major version
```

Version files may include:

- `.nvmrc`
- `.node-version`
- `.python-version`
- `packageManager` in `package.json`

## 6.2 Dependency Versions

Rules:

- Production dependencies must use exact or lockfile-resolved versions.
- Major upgrades require an explicit review.
- Chess-rule and engine dependencies require regression tests before upgrade.
- Security updates may be expedited but still require automated tests.
- Experimental prerelease packages are prohibited in the release branch unless approved by an Architecture Decision Record.

---

# 7. Repository Strategy

The approved direction is a monorepo.

Conceptual layout:

```text
caissa/
├── apps/
│   ├── web/
│   └── maia-service/
├── packages/
│   ├── chess-core/
│   ├── shared-types/
│   ├── design-tokens/
│   └── test-fixtures/
├── docs/
├── scripts/
├── tooling/
├── LICENSES/
└── README.md
```

The Architecture Design Document will define the final directory structure.

Benefits:

- Shared contracts
- Unified documentation
- Coordinated releases
- Centralized linting and testing
- Easier Codex context
- Explicit separation between browser and server code

---

# 8. Runtime Architecture

Caissa will use three primary runtime zones.

## 8.1 Browser Main Thread

Responsibilities:

- React rendering
- Navigation
- User input
- Board presentation
- Local game controller orchestration
- Settings
- Local persistence coordination
- Review UI
- Audio commands

Prohibited:

- Long-running engine search
- Direct Maia model inference
- Heavy PGN batch analysis
- Blocking filesystem or network loops

## 8.2 Browser Worker Layer

Responsibilities:

- Stockfish WebAssembly execution
- UCI communication
- Search cancellation
- Engine readiness
- Optional review batch processing
- Engine capability detection

The worker must be treated as a disposable compute process.

If it crashes, the application should recreate it without losing game state.

## 8.3 Remote Maia Service

Responsibilities:

- Load and cache Maia-3 model weights
- Convert validated positions and history into Maia requests
- Select human-like moves at requested skill settings
- Return candidate probabilities
- Expose health and model metadata
- Enforce timeouts, rate limits, and request validation

The service must not own the authoritative game state.

The browser sends the position and relevant move history with each request.

---

# 9. Core Chess State

## 9.1 Source of Truth

`chess.js` is the authoritative rules engine in the browser for Version 1.0.

It determines:

- Legal moves
- Side to move
- Check
- Checkmate
- Stalemate
- Insufficient material
- Repetition where supported by maintained state
- Castling
- En passant
- Promotion
- FEN
- PGN
- Move notation

## 9.2 State Representation

The application should store:

- Current FEN
- Move history
- PGN headers
- Clock state
- Game configuration
- Result
- Board orientation
- Active engine request state
- Persistence metadata

The canonical recoverable game representation should include PGN plus supporting clock/configuration metadata.

## 9.3 No Duplicate Rules Engine

UI components must not implement independent chess legality logic.

The board may request legal destinations from the game controller, but it must not decide legality itself.

## 9.4 Server Validation

The Maia service must independently validate:

- FEN
- Move history
- Side to move
- Requested rating range
- Candidate count
- Sampling configuration

The server must not trust client-provided legal move lists.

---

# 10. Board Rendering Strategy

## 10.1 Initial Implementation

Use `react-chessboard` behind a local `BoardAdapter` interface.

The application must not spread library-specific props throughout product code.

Conceptual interface:

```ts
interface ChessBoardViewProps {
  position: string;
  orientation: "white" | "black";
  selectedSquare?: Square;
  legalMoves: LegalMoveMap;
  lastMove?: { from: Square; to: Square };
  checkSquare?: Square;
  disabled: boolean;
  onMoveAttempt(move: MoveAttempt): void;
  onSquareSelect(square: Square): void;
}
```

## 10.2 Replacement Readiness

A custom board may replace the initial library if required for:

- Keyboard accessibility
- Advanced motion
- Annotation tools
- Better mobile interactions
- Performance
- Brand-specific rendering

Replacement must not require rewriting game logic.

---

# 11. Stockfish Integration

## 11.1 Purpose

Stockfish will support:

- Computer opponent fallback
- Practice difficulty
- Post-game evaluation
- Candidate move generation
- Tactical verification
- Evaluation graph
- Guided-review evidence

Stockfish must not be presented as human-like AI.

## 11.2 Execution Model

Stockfish runs in a dedicated Web Worker.

Communication uses UCI commands through a typed engine adapter.

The main thread must never parse unbounded engine output synchronously.

## 11.3 Engine Port Selection

> **Resolved by ADR-0002.** The selected distribution is Stockfish.js 18.0.8
> (`stockfish-18-lite-single`), vendored at `apps/web/public/engine/`, pinned by SHA-256 in
> `scripts/check-engine-assets.mjs`, and recorded in `THIRD_PARTY_NOTICES.md`.

Use a maintained browser-compatible Stockfish WebAssembly distribution.

Do not build new integration work on a deprecated compatibility repository when a maintained port exists.

The selected distribution must be recorded with:

- Upstream repository
- Exact version/commit
- License
- Build artifacts
- Source-disclosure procedure
- Browser capability requirements

## 11.4 Threading Strategy

Preferred order:

1. Threaded WebAssembly when cross-origin isolation is available
2. Single-thread WebAssembly fallback
3. Engine-disabled fallback with clear messaging

The application must feature-detect:

- WebAssembly
- Web Workers
- SharedArrayBuffer
- Atomics
- Cross-origin isolation
- Available hardware concurrency
- Approximate device memory where exposed

## 11.5 itch.io Constraint

Caissa will be embedded by itch.io in an iframe.

The application must not assume that the hosting environment provides the response headers needed for cross-origin-isolated threaded WebAssembly.

Therefore:

- The itch.io build must support single-thread Stockfish.
- Threaded Stockfish is an optimization for controlled hosting, not a release requirement for itch.io.
- Engine mode must be selected at runtime.
- The UI must not expose technical failure details to normal users.

## 11.6 Worker Lifecycle

Required states:

```text
uninitialized
loading
ready
searching
stopping
failed
terminated
```

Required operations:

- Initialize
- Set options
- Start search
- Stop search
- Reset position
- Health check
- Terminate
- Recreate

## 11.7 Search Cancellation

Every search request receives an internal request identifier.

Results from obsolete searches must be ignored.

Before changing position or options:

1. Send stop.
2. Wait for completion or apply timeout.
3. Reset engine state if necessary.
4. Start the new search.

## 11.8 Resource Defaults

Browser-safe initial defaults:

- Threads: 1
- Hash: 32–64 MB
- MultiPV: 1 during play
- MultiPV: up to 3 in advanced review
- Search time: bounded
- No unbounded analysis during normal gameplay

Higher values may be selected only after capability checks.

## 11.9 Difficulty

Difficulty should be defined through a controlled profile rather than arbitrary UI exposure of engine internals.

A profile may configure:

- Skill level
- Search time
- Node limit
- Depth cap
- Randomization policy where defensible

The product must not claim that Stockfish engine levels correspond exactly to human ratings.

---

# 12. Maia-3 Integration

> **Amended by ADR-0003.** Maia-3 is deferred to Version 2. Version 1 ships engine-backed
> opponent profiles behind the same provider port. This section remains the approved design
> for the Version 2 workstream.

## 12.1 Verified Capability Baseline

The official Maia-3 project provides Python inference code and a UCI engine for released human-move prediction models.

The official model family includes multiple sizes intended for different accuracy and compute trade-offs.

The integration must use the official package or a reviewed fork.

## 12.2 Initial Model Choice

Approved initial production candidate:

```text
Maia3-5M
```

Reasons:

- Intended as the first-try/CPU model
- Lower memory and latency than larger variants
- Suitable for early service deployment
- Sufficient for validating product value

Larger models may be evaluated later.

## 12.3 Service-Only Integration

Maia-3 will not run directly in the browser in Version 1.0.

Reasons:

- Official runtime is Python-based
- Model files increase distribution size
- Browser inference would increase implementation risk
- itch.io packaging and memory constraints favor remote inference
- Server-side inference allows controlled caching and observability

## 12.4 UCI Process Model

The initial service may run Maia through its official UCI entry point.

Recommended production pattern:

- Pre-cache model weights at build/deployment time
- Start a fixed worker pool
- Keep model processes warm
- Allocate one active request per worker
- Apply hard request timeout
- Restart unhealthy workers
- Avoid spawning a new model process for every move

## 12.5 Required Inputs

A Maia move request should include:

- Current FEN
- Reconstructed move history or UCI move list
- Player rating target
- Opponent rating target
- Temperature profile
- Top-p profile
- Number of candidates
- Client request identifier

## 12.6 Required Outputs

A response should include:

- Selected move in UCI notation
- Candidate moves
- Candidate probabilities or normalized scores
- Model identifier
- Effective rating parameters
- Sampling parameters
- Inference duration
- Request identifier
- Warning metadata where applicable

## 12.7 Rating Range

The API must validate rating inputs against the capability range of the selected Maia model.

The user-facing UI should expose approved presets rather than arbitrary unsupported values.

## 12.8 Sampling Policy

Sampling profiles must be centrally defined.

Example conceptual profiles:

```text
deterministic:
  temperature = 0
  top_p = 1.0

realistic:
  temperature = approved value
  top_p = approved value

varied:
  temperature = higher approved value
  top_p = narrower or wider based on testing
```

Exact values must be established through offline evaluation.

## 12.9 Fallback Behavior

When Maia fails:

1. Retry once if failure is transient and time budget permits.
2. Offer a Stockfish-based fallback.
3. Preserve game state.
4. Disclose that the opponent mode changed.
5. Never silently substitute a random legal move.

## 12.10 Maia Evaluation Semantics

Maia output must not be described as equivalent to Stockfish evaluation.

Human-game outcome predictions, candidate likelihoods, and compatibility scores must be labeled accurately.

## 12.11 License Requirement

The official Maia-3 repository is licensed under AGPL-3.0.

Before public network deployment:

- Preserve license notices.
- Publish corresponding source for the deployed covered service as required.
- Document modifications.
- Make source availability clear to users interacting with the service.
- Obtain legal review if the product becomes commercial or combines proprietary server components.

This document is not legal advice.

---

# 13. AI Explanation Strategy

## 13.1 Version 1.0

Human-readable review explanations should initially use deterministic templates backed by structured chess evidence.

Inputs may include:

- Evaluation change
- Tactical motif
- Material change
- King safety
- Hanging pieces
- Forcing moves
- Maia candidate probability
- Stockfish candidate ranking
- Opening phase
- Endgame phase

Benefits:

- Predictable language
- Lower cost
- Easier testing
- Lower hallucination risk
- Offline compatibility for basic explanations

## 13.2 Optional LLM Layer

An LLM-based explanation service is deferred.

If introduced, it must:

- Receive structured facts rather than raw free-form state only
- Be prohibited from inventing lines
- Cite the move and position being explained
- Return a structured schema
- Be checked against legal moves
- Fall back to deterministic copy
- Avoid claiming knowledge of player intent

---

# 14. API Boundary

## 14.1 API Versioning

All public service endpoints must be versioned.

Initial prefix:

```text
/api/v1
```

## 14.2 Proposed Endpoints

```text
GET  /api/v1/health
GET  /api/v1/models
POST /api/v1/maia/move
POST /api/v1/maia/candidates
POST /api/v1/review/human-likelihood
```

Advanced review endpoints are deferred until the AI architecture is finalized.

## 14.3 Example Move Request

```json
{
  "requestId": "client-generated-id",
  "fen": "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  "moves": ["e2e4", "e7e5"],
  "selfElo": 1200,
  "opponentElo": 1200,
  "profile": "realistic",
  "candidateCount": 3
}
```

## 14.4 Example Response

```json
{
  "requestId": "client-generated-id",
  "move": "g1f3",
  "candidates": [
    { "move": "g1f3", "probability": 0.42 },
    { "move": "f1c4", "probability": 0.21 },
    { "move": "b1c3", "probability": 0.16 }
  ],
  "model": "maia3-5m",
  "selfElo": 1200,
  "opponentElo": 1200,
  "durationMs": 185
}
```

Values above are examples only.

## 14.5 Error Contract

Errors must return a stable machine-readable structure.

```json
{
  "error": {
    "code": "MAIA_TIMEOUT",
    "message": "The human-like engine did not respond in time.",
    "retryable": true,
    "requestId": "client-generated-id"
  }
}
```

Do not expose stack traces, subprocess output, or filesystem paths.

---

# 15. Local Storage Model

## 15.1 Storage Responsibilities

Use `localStorage` only for small preferences.

Use IndexedDB for:

- Saved games
- Active-game snapshots
- PGN
- Review summaries
- Analysis cache
- Migration metadata

## 15.2 Approved Storage Library

Use Dexie as the IndexedDB abstraction.

All persistence must be accessed through repository interfaces rather than directly from UI components.

## 15.3 Conceptual Stores

```text
preferences
games
activeGame
reviews
analysisCache
schemaMetadata
```

## 15.4 Game Record

A saved game should include:

- Stable local ID
- Created and updated timestamps
- PGN
- Final FEN
- Result
- Result reason
- Player color
- Opponent type
- Opponent configuration
- Time control
- Clock history or final values
- Move count
- Review status
- App schema version

## 15.5 Active-Game Save Policy

Save after:

- Every committed move
- Clock-impacting lifecycle event
- Undo
- Resume
- Game completion
- App visibility loss where practical

Writes should be debounced only when doing so cannot lose a committed move.

## 15.6 Data Migration

Every persistent record must include a schema version.

Migrations must be:

- Idempotent
- Tested
- Non-destructive where possible
- Able to preserve PGN even if richer metadata becomes incompatible

## 15.7 Export

Version 1.0 must support:

- PGN export
- Copy PGN
- Download PGN
- Optional JSON diagnostic export for development

---

# 16. Authentication and Accounts

No user account is required for Version 1.0.

Deferred:

- Sign-in
- Cloud synchronization
- Cross-device history
- Public profile
- Remote ratings

The frontend architecture should avoid assumptions that prevent future account support.

Local record IDs must not be treated as globally unique account identifiers.

---

# 17. Network Behavior

## 17.1 API Transport

All production API traffic must use HTTPS.

## 17.2 Timeouts

Recommended initial budgets:

| Operation | Timeout |
|---|---:|
| Maia move | 5 seconds |
| Maia candidates | 7 seconds |
| Health check | 2 seconds |
| Optional remote review | 20 seconds |

Timeouts must be configurable and measured.

## 17.3 Retry Policy

Retry only:

- Network failures
- 429 with server guidance
- Approved 5xx errors
- Worker-unavailable errors

Do not automatically retry:

- Invalid FEN
- Invalid move history
- Unsupported rating
- Authentication failure
- License/configuration error

## 17.4 CORS

The service must allow only approved origins.

Expected origins may include:

- Production web domain
- itch.io game CDN origin where technically required
- Local development origins

Wildcard CORS is prohibited in production when credentials or sensitive endpoints are introduced.

---

# 18. Offline and Degraded Modes

## 18.1 Offline-Capable Features

After required assets have loaded, the application should support:

- Local game
- Legal move validation
- Clocks
- Settings
- History
- PGN export
- Local Stockfish when bundled and supported
- Previously generated reviews

## 18.2 Network-Dependent Features

- Maia move inference
- Maia candidate probabilities
- Cloud services
- Remote opening data
- Future account sync

## 18.3 Degradation Levels

```text
Full:
  Local core + Stockfish + Maia available

Local Enhanced:
  Local core + Stockfish available

Local Basic:
  Local core available, engines unavailable

Recovery:
  Read/export saved game data only
```

The UI must communicate the active capability level without technical jargon.

---

# 19. Browser Support

## 19.1 Functional Support Target

Support the latest two stable major versions at release time of:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Apple Safari

Mobile targets:

- Current and previous major iOS Safari
- Current and previous major Android Chrome

## 19.2 Required Baseline Capabilities

- ES modules
- WebAssembly
- Web Workers
- IndexedDB
- CSS Grid
- CSS custom properties
- Pointer Events
- ResizeObserver
- `crypto.randomUUID` or safe fallback

## 19.3 Progressive Capabilities

- SharedArrayBuffer
- Atomics
- Cross-origin isolation
- Fullscreen API
- Screen Wake Lock
- Device memory hints
- Hardware concurrency hints
- Installable PWA support

Progressive features must not be required for basic play.

## 19.4 Unsupported Browser Behavior

If the browser lacks a required baseline capability:

- Explain the limitation.
- Preserve any accessible stored data.
- Offer PGN export where possible.
- Avoid a blank screen or raw JavaScript error.

---

# 20. itch.io Distribution Requirements

## 20.1 Build Type

Caissa will be published as an HTML5 project.

The upload package must be a ZIP containing:

```text
index.html
assets/
...
```

## 20.2 Relative Paths

The itch.io build must use relative asset paths.

Vite must be configured with an appropriate relative base, conceptually:

```ts
base: "./"
```

No production asset URL may assume deployment at the domain root.

## 20.3 Packaging Limits

The release process must verify:

- Fewer than 1,000 extracted files
- Less than 500 MB total extracted size
- No individual extracted file larger than 200 MB
- UTF-8, case-correct filenames
- Maximum path length within itch.io limits
- `index.html` at ZIP root

The project should remain far below these maximums.

## 20.4 Iframe Behavior

The application must:

- Resize responsively
- Work in fullscreen launch mode
- Avoid dependence on top-window navigation
- Avoid third-party cookies
- Handle focus loss
- Handle mobile fullscreen launch
- Avoid absolute asset paths
- Use HTTPS for external APIs

## 20.5 Audio

Audio playback must begin only after a user gesture where browser policy requires it.

## 20.6 Recommended Launch Mode

Use “Click to launch in fullscreen” for the primary itch.io experience unless embed testing demonstrates a better in-page layout.

---

# 21. Build Configuration

## 21.1 Build Outputs

Required outputs:

- Standard production web build
- itch.io relative-path build
- Source maps for controlled error diagnosis
- Build metadata
- Third-party license bundle
- Asset manifest

Public source maps may be disabled or access-controlled depending on deployment strategy.

## 21.2 Environment Configuration

Use typed environment variables.

Frontend-exposed variables must use the Vite public prefix and may contain no secrets.

Examples:

```text
VITE_API_BASE_URL
VITE_BUILD_VERSION
VITE_RELEASE_CHANNEL
VITE_ENABLE_MAIA
VITE_ENABLE_ANALYTICS
```

Server-only variables:

```text
MAIA_MODEL
MAIA_DEVICE
MAIA_WORKER_COUNT
ALLOWED_ORIGINS
REQUEST_TIMEOUT_SECONDS
RATE_LIMIT_CONFIG
```

## 21.3 Build Reproducibility

A clean checkout must build using documented commands and the lockfiles.

No hidden local files may be required.

---

# 22. Performance Budgets

## 22.1 Frontend Loading

Recommended release budgets:

| Metric | Target |
|---|---:|
| Initial app JavaScript, gzip, excluding engine | ≤ 350 KB |
| Initial critical CSS, gzip | ≤ 60 KB |
| Initial app shell transfer, excluding fonts/engine | ≤ 1.5 MB |
| Largest Contentful Paint on reasonable mid-tier device | ≤ 2.5 s |
| Cumulative Layout Shift | ≤ 0.1 |
| Interaction to Next Paint | ≤ 200 ms |

Budgets should be measured under defined test conditions.

## 22.2 Engine Loading

- Stockfish loads only when a mode requires it.
- Maia model never ships in the browser v1 build.
- Review charts load on demand.
- Non-default board themes may load on demand.
- Audio may load after the first interaction.

## 22.3 Runtime Interaction

| Interaction | Target |
|---|---:|
| Board selection feedback | < 50 ms |
| Legal move indicators | < 100 ms |
| Move commit UI response | < 100 ms |
| Local persistence acknowledgment | < 100 ms perceived |
| Piece animation | Stable 60 FPS target |
| Route transition | < 300 ms perceived |

## 22.4 Main Thread

Avoid tasks longer than 50 ms during active play.

Large PGN parsing, engine output processing, and review generation should be chunked or moved off-thread.

## 22.5 Memory

Initial target:

- Web app without engine: under 150 MB typical browser memory
- Stockfish worker configuration: under 256 MB default
- No unlimited engine hash
- No unbounded analysis cache
- Revoke unused object URLs
- Terminate obsolete workers

---

# 23. Caching Strategy

## 23.1 Static Assets

Use content-hashed filenames and long-lived immutable caching on controlled hosting.

## 23.2 Engine Assets

Engine files should be versioned and cached independently.

## 23.3 API Responses

Maia move requests should not be cached blindly by shared HTTP caches when sampling is enabled.

Deterministic candidate requests may use an application cache keyed by:

- Model version
- FEN
- Relevant history
- Ratings
- Sampling profile
- Candidate count

## 23.4 Local Analysis Cache

Cache bounded Stockfish analysis by:

- Engine version
- FEN
- depth/time profile
- MultiPV
- options

Use an eviction policy.

---

# 24. Security Requirements

## 24.1 Frontend

- No secrets in client code
- No `eval`
- No untrusted HTML insertion
- Sanitize imported metadata before rendering
- Validate PGN/FEN input
- Restrict external origins
- Use a Content Security Policy on controlled hosting
- Keep dependencies audited

## 24.2 Maia Service

- Strict schema validation
- Maximum request body size
- Rating and candidate bounds
- Request timeout
- Rate limiting
- Exact CORS allowlist
- No arbitrary command execution
- No user-provided model paths
- No user-controlled UCI executable arguments
- Process isolation
- Controlled logs
- Health probes
- Resource limits

## 24.3 Engine Command Safety

Only the internal engine adapter may construct UCI commands.

Raw user strings must never be forwarded directly to an engine subprocess.

## 24.4 Import Safety

Imported PGN must be treated as data, not markup.

Headers displayed in the UI must be escaped.

## 24.5 Abuse Protection

Remote Maia endpoints require:

- Per-IP or equivalent rate limits
- Concurrency limits
- Maximum candidate count
- Request timeout
- Circuit breaker behavior
- Capacity monitoring

---

# 25. Privacy Requirements

Version 1.0 is local-first.

Default behavior:

- No account
- No remote game-history storage
- No advertising tracker
- No sale of user data
- No unnecessary personal data

If analytics are enabled:

- Use minimal event data
- Avoid full PGN collection by default
- Provide disclosure
- Support opt-out where appropriate
- Do not block gameplay

---

# 26. Observability

## 26.1 Frontend

Recommended error metadata:

- App version
- Browser family
- Capability flags
- Current route
- Engine state
- Anonymous request ID
- Sanitized error code

Do not include full game content remotely without explicit policy.

## 26.2 Backend

Required metrics:

- Request count
- Success/failure rate
- Inference latency
- Queue time
- Worker availability
- Timeout count
- Model load time
- Memory
- CPU
- Process restart count

## 26.3 Structured Logging

Logs should be structured and include:

- Timestamp
- Request ID
- Endpoint
- Model
- Duration
- Status
- Error code

Do not log raw authorization secrets or unnecessary full PGNs.

---

# 27. Error Handling

## 27.1 Error Categories

```text
USER_INPUT
CHESS_STATE
ENGINE_UNAVAILABLE
ENGINE_TIMEOUT
NETWORK
STORAGE
MIGRATION
UNSUPPORTED_BROWSER
INTERNAL
```

## 27.2 Recovery Requirements

Every recoverable error should provide a recovery action.

Examples:

- Retry Maia
- Switch opponent
- Recreate Stockfish worker
- Export PGN
- Continue without analysis
- Restore previous snapshot
- Clear only corrupted cache

## 27.3 Error Boundaries

React error boundaries should isolate:

- Application shell
- Gameplay workspace
- Review workspace
- Chart/analysis panels

A secondary panel failure must not destroy an active game.

---

# 28. State Management Boundaries

## 28.1 React Local State

Use for:

- Open/closed UI
- Temporary form state
- Hover
- Local selection
- Non-shared animation state

## 28.2 Zustand

Use for:

- Active game orchestration
- Engine lifecycle state
- Global preferences mirror
- Current opponent configuration
- Cross-component game UI state

## 28.3 TanStack Query

Use only for remote server state:

- Maia requests
- Model metadata
- Health checks
- Future review services

Do not use TanStack Query for local chess state.

## 28.4 IndexedDB

Use for durable local records.

UI components must not call IndexedDB directly.

---

# 29. Concurrency and Race Conditions

The implementation must handle:

- User exits while AI request is pending
- Undo while Stockfish is analyzing
- New game before prior worker terminates
- Browser tab becomes hidden
- Duplicate move response
- Stale network response
- Rapid review navigation
- Storage write overlap
- Clock tick during game completion

Required patterns:

- Request IDs
- AbortController for HTTP
- Engine search tokens
- Idempotent reducers/actions
- Transactional storage operations
- Single authoritative game phase

---

# 30. Clock Technical Requirements

Use a monotonic time source such as `performance.now()` for active timing calculations.

Do not rely solely on decrementing a counter every second.

Clock state should store:

- Remaining duration
- Timestamp when active period began
- Active side
- Increment
- Paused state

On resume or visibility change, recalculate from elapsed monotonic time where available.

Persist enough information to restore safely.

---

# 31. Audio Technical Requirements

- Audio loads lazily.
- User preference is persisted.
- Browser autoplay restrictions are respected.
- Sounds must be preloaded before critical use where practical.
- Overlapping events must be controlled.
- Audio failure must never block gameplay.
- No background music is required for Version 1.0.

---

# 32. Accessibility Engineering Requirements

- Semantic HTML is required.
- All controls need accessible names.
- Board keyboard model must be implemented and tested.
- Screen-reader announcements use a controlled live region.
- Focus must return predictably after dialogs.
- Reduced-motion media query must be honored.
- High-contrast and color-independent states must be supported.
- Accessibility cannot be postponed to a final polishing phase.

---

# 33. Testing Strategy Baseline

A dedicated testing document will expand this section.

## 33.1 Unit Tests

Required for:

- Game controller
- Clock calculations
- Result mapping
- Move serialization
- Storage migrations
- Engine parser
- Maia API validation
- Difficulty profiles
- Capability detection

## 33.2 Chess Regression Tests

Must cover:

- Castling rights
- Castling through check
- En passant
- Underpromotion
- Checkmate
- Stalemate
- Insufficient material
- Repetition
- Fifty-move handling
- Undo restoration
- PGN round trip
- FEN round trip

## 33.3 Component Tests

Required for:

- Promotion chooser
- Game result
- Clock
- Move history
- Setup controls
- Error/fallback states
- Keyboard board interaction

## 33.4 End-to-End Tests

Required flows:

1. Start game
2. Make legal move
3. Reject illegal move
4. Complete checkmate scenario
5. Promote pawn
6. Undo against AI
7. Refresh and resume
8. Complete and export PGN
9. Maia failure fallback
10. Stockfish worker recovery
11. Mobile setup and game flow
12. Keyboard-only game interaction

## 33.5 API Tests

- Valid move request
- Invalid FEN
- Inconsistent history
- Unsupported rating
- Timeout
- Worker unavailable
- Rate limit
- Stable error schema

---

# 34. Quality Gates

A pull request may not merge unless:

- TypeScript compiles in strict mode.
- Python type/lint checks pass where configured.
- Unit tests pass.
- Relevant integration tests pass.
- Linting passes.
- Formatting passes.
- No critical dependency vulnerability is introduced.
- Bundle budget has not regressed beyond tolerance.
- Chess behavior changes include regression tests.
- Public API changes update contracts and documentation.

---

# 35. Dependency Governance

Before adding a production dependency, document:

- Purpose
- Maintainer activity
- License
- Bundle/runtime impact
- Security history
- Replacement difficulty
- Browser support
- Whether a smaller internal implementation is reasonable

Prohibited:

- Duplicate libraries for the same concern
- Unmaintained engine wrappers without review
- UI libraries that conflict with the design system
- Dependencies that silently transmit user data
- Packages with unclear or incompatible licenses

---

# 36. License and Attribution

## 36.1 Stockfish

Stockfish and common browser ports are distributed under GPL-3.0-compatible terms.

The project must:

- Preserve notices
- Provide corresponding source as required
- Document the exact distributed engine build
- Avoid implying Stockfish endorses Caissa
- Include license text in the release bundle or accompanying source distribution

## 36.2 Maia-3

Maia-3 is AGPL-3.0 licensed.

The service deployment plan must account for network-source obligations.

## 36.3 Fonts and Assets

Every font, sound, icon, piece set, and image must have documented usage rights.

Create:

```text
LICENSES/
THIRD_PARTY_NOTICES.md
ASSET_MANIFEST.md
```

## 36.4 Legal Review

A license review is mandatory before monetization or closed-source distribution.

This specification is not legal advice.

---

# 37. Deployment Environments

Required environments:

```text
local
preview
production-web
production-itch
production-maia
```

Each environment must have:

- Documented configuration
- Separate environment values
- Build version
- Health verification
- Rollback procedure where applicable

Preview environments must not use production secrets automatically.

---

# 38. Maia Service Deployment

## 38.1 Container Requirements

The container should:

- Install exact dependencies
- Pre-download the approved model
- Run as a non-root user
- Expose health endpoint
- Set CPU/memory limits
- Use read-only filesystem where practical
- Store model cache in an explicit path
- Shut down workers gracefully

## 38.2 Health Checks

Readiness means:

- API process running
- Model available
- At least one inference worker ready

Liveness means:

- Process responsive
- Event loop not blocked

A service may be alive but not ready.

## 38.3 Scaling

Initial deployment may use a single instance with a small fixed worker pool.

Scale based on:

- Queue time
- P95 latency
- CPU saturation
- Memory
- timeout rate

Do not create more model workers than memory allows.

---

# 39. Release Channels

Recommended channels:

- `dev`
- `preview`
- `beta`
- `stable`

Every build must expose:

- Semantic app version
- Git commit
- Build date
- Engine version
- Maia model version where applicable
- Schema version

This information may appear in an About or diagnostics panel.

---

# 40. Feature Flags

Use typed feature flags for incomplete or environment-specific capabilities.

Examples:

```text
maiaOpponent
advancedReview
liveEvaluation
pwaInstall
analytics
lightTheme
localTwoPlayer
```

Rules:

- Flags require default values.
- Production defaults are explicit.
- Dead flags are removed.
- Security-sensitive behavior cannot rely only on client flags.

---

# 41. Technical Acceptance Criteria

This specification is satisfied when:

## Foundation

- Monorepo scaffolding is reproducible.
- TypeScript strict mode is enabled.
- Python service starts from a clean checkout.
- Environment variables are typed and documented.
- Dependency versions are locked.

## Core Chess

- `chess.js` is the sole browser rules authority.
- PGN and FEN round trips are tested.
- Special moves and terminal states pass regression tests.
- Active game can be restored.

## Stockfish

- Runs in a dedicated worker.
- Searches are cancellable.
- Stale results are ignored.
- Single-thread fallback works.
- Failure does not destroy game state.

## Maia

- Official Maia-3 integration runs through the service.
- Model is pre-cached.
- Requests are validated.
- Worker pool remains warm.
- Timeouts and fallback are implemented.
- Model and license information are disclosed.

## Storage

- IndexedDB schema is versioned.
- Migrations are tested.
- PGN export works without network.
- Corrupted analysis cache can be cleared independently.

## itch.io

- Relative-path build works.
- ZIP contains root `index.html`.
- File counts and sizes pass validation.
- Game functions in iframe/fullscreen testing.
- External API uses HTTPS.
- Single-thread engine mode is verified.

## Quality

- Required browser matrix passes.
- Accessibility baseline passes.
- Performance budgets are measured.
- Security checks pass.
- Third-party notices are complete.

---

# 42. Technical Risks

## Risk: Threaded Stockfish Fails in itch.io

**Mitigation**

- Feature detection
- Single-thread fallback
- Controlled resource profiles
- Itch-specific test build

## Risk: Maia Latency Feels Slow

**Mitigation**

- Warm process pool
- 5M model first
- Pre-cached weights
- Bounded request timeout
- Subtle thinking state
- Stockfish fallback

## Risk: Copyleft Obligations Are Mishandled

**Mitigation**

- Separate notices
- Public corresponding source
- Deployment documentation
- Legal review before commercialization

## Risk: Board Library Limits Accessibility

**Mitigation**

- Adapter boundary
- Early keyboard prototype
- Replacement readiness
- Accessibility acceptance tests

## Risk: Review Becomes Computationally Expensive

**Mitigation**

- Analyze critical positions first
- Bounded search profiles
- Cache results
- Progressive review generation
- Cancel obsolete jobs

## Risk: IndexedDB Records Become Incompatible

**Mitigation**

- Schema versions
- Tested migrations
- Preserve PGN
- Export path
- Recovery mode

## Risk: AI Explanation Hallucinates

**Mitigation**

- Deterministic templates first
- Structured evidence
- Legality checks
- No unsupported claims of intent
- Fallback copy

---

# 43. Locked Technical Decisions

The following are approved:

1. Caissa is browser-first.
2. Core chess play requires no backend.
3. React, TypeScript, Vite, and Tailwind CSS v4 form the frontend foundation.
4. `chess.js` is the browser rules authority.
5. The initial board library is isolated behind an adapter.
6. Stockfish runs in a Web Worker.
7. The itch.io build must support single-thread Stockfish.
8. Maia-3 runs in a separate Python/FastAPI service.
9. Maia3-5M is the first production candidate.
10. The Maia service keeps warm workers and pre-cached weights.
11. User game data is local-first in Version 1.0.
12. IndexedDB stores games and reviews; localStorage stores small preferences only.
13. No account is required for Version 1.0.
14. Deterministic explanations precede optional LLM explanations.
15. All engine and network integrations use typed adapters.
16. Copyleft license compliance is a release requirement.
17. itch.io receives a dedicated relative-path build.
18. Performance and accessibility budgets are quality gates.

---

# 44. Open Technical Decisions

Resolve in the Architecture Design Document or AI Architecture:

1. Exact maintained Stockfish browser distribution
2. Exact frontend package versions
3. Exact deployment provider for Maia
4. Maia worker count and CPU/memory sizing
5. Exact sampling values for opponent profiles
6. Whether TanStack Query is needed in the first milestone
7. Whether PWA support ships in Version 1.0
8. Whether local two-player ships in Version 1.0
9. Exact analysis cache limits
10. Exact error-monitoring provider, if any
11. Exact analytics policy
12. Whether review explanations remain fully local in Version 1.0
13. Exact board library replacement threshold
14. Whether controlled web hosting and itch.io ship simultaneously
15. Whether downloadable desktop builds are added later

---

# 45. Next Document Requirements

The next document, `05_architecture_design.md`, must define:

- System context
- Container boundaries
- Frontend module structure
- Game controller
- State machines
- Engine adapters
- Persistence repositories
- API client
- Maia service internals
- Worker pool
- Data contracts
- Error propagation
- Sequence diagrams
- Dependency rules
- Folder structure
- Architectural fitness tests
- Deployment topology
- Architecture Decision Records

---

# 46. Final Technical Direction

Caissa should not be technically impressive because it uses many technologies.

It should be impressive because each technology has a clear responsibility, each failure is contained, and the core experience remains reliable.

The technical standard is:

> Local where possible, remote where valuable, isolated where expensive, and replaceable where uncertain.

The architecture must protect the player’s game first.

AI, analysis, and visual sophistication are valuable only when they are built on top of correct, recoverable, and understandable chess.
