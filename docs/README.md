# Caissa Documentation

**Product:** Caissa  
**Slogan:** Beyond the Best Move  
**Documentation Status:** Approved; amended by the ADRs listed in section 8  
**Last Updated:** August 2026  
**Owner:** Md. Saminul Amin  

---

## 1. Purpose

This directory contains the complete product, design, engineering, AI, quality, deployment, coding, security, and execution documentation for Caissa.

Caissa is a browser-first, local-first, human-centered AI chess application designed around:

- Realistic human-like opponents
- Clear and respectful post-game analysis
- Reliable local gameplay
- Premium interaction and visual design
- Strong architectural boundaries
- Safe and explainable AI behavior
- Web and itch.io distribution

These documents are the authoritative source for implementation decisions.

Contributors and Codex-assisted workflows must read the relevant documents before modifying the codebase.

---

# 2. Product Foundation

Caissa is not intended to be another generic chess website.

Its defining idea is:

> **The best chess experience is not only about finding the best move. It is about understanding the player who must make it.**

The product combines:

- Maia-3 for human-like move prediction
- Stockfish for objective analysis
- Deterministic chess reasoning for explanations
- A polished and calm interface
- Local-first game storage
- Guided post-game reflection

---

# 3. Documentation Index

## `00_product_identity.md`

Defines:

- Product name
- Slogan
- Supporting tagline
- Brand personality
- Product philosophy
- Market positioning
- Experience principles
- Voice and tone
- Homepage messaging

Use this document for:

- Branding
- Product language
- Marketing copy
- Feature philosophy
- Tone decisions

---

## `01_prd.md`

The authoritative Product Requirements Document.

Defines:

- Product vision
- User personas
- Jobs to be done
- Version 1 scope
- Functional requirements
- Non-functional requirements
- Product success criteria
- Constraints
- Risks
- Acceptance criteria
- Explicitly deferred features

Use this document to determine:

- What must be built
- What must not be built
- Which features belong in Version 1
- Which requirements are mandatory

---

## `02_ux_specification.md`

Defines:

- Information architecture
- Screen behavior
- User journeys
- Board interaction
- Game setup
- Active game
- Result flow
- Review flow
- History
- Settings
- Responsive behavior
- Accessibility expectations
- Microcopy rules

Use this document for:

- Interaction design
- Screen implementation
- Navigation behavior
- Keyboard and mobile behavior
- UX acceptance criteria

---

## `03_design_system.md`

Defines:

- Color system
- Typography
- Board themes
- Chess piece direction
- Spacing
- Radius
- Borders
- Elevation
- Components
- Motion
- Accessibility
- Responsive design
- Design tokens

Use this document for:

- Visual implementation
- Semantic CSS variables
- Tailwind tokens
- Component variants
- Board styling
- Motion decisions

---

## `04_technical_specification.md`

Defines:

- Approved technology stack
- Frontend architecture
- Backend architecture
- Monorepo direction
- Browser capabilities
- Stockfish runtime
- Maia service
- Storage
- API
- Browser support
- itch.io requirements
- Performance budgets
- Build strategy
- Testing requirements

Use this document for:

- Technology decisions
- Package selection
- Runtime expectations
- API requirements
- Performance constraints
- Browser and hosting behavior

---

## `05_architecture_design.md`

Defines:

- System context
- Runtime containers
- Module boundaries
- Domain model
- Game controller
- State machines
- Engine adapters
- Worker protocols
- Persistence repositories
- Maia service internals
- Sequence diagrams
- Dependency rules
- Architectural fitness tests
- ADRs

Use this document for:

- Module placement
- Dependency direction
- Service interfaces
- State ownership
- Async flow
- Error propagation
- Architecture enforcement

---

## `06_ai_architecture.md`

Defines:

- Maia-3 role
- Stockfish role
- Human-like opponent profiles
- Elo conditioning
- Sampling
- Temperature
- Top-p
- MultiPV
- Review intelligence
- Move classification
- Explanation safety
- AI evaluation
- Model calibration
- Latency
- Model governance
- Release gates

Use this document for:

- AI implementation
- Maia service work
- Opponent profiles
- Review intelligence
- Explanation generation
- Model evaluation
- AI quality assurance

---

## `07_testing_strategy.md`

Defines:

- Test pyramid
- Chess regression suite
- Unit testing
- Component testing
- Integration testing
- Contract testing
- End-to-end testing
- Accessibility testing
- Performance testing
- Security testing
- AI evaluation
- Release blocking policy
- CI quality gates

Use this document for:

- Test planning
- Fixture design
- Regression requirements
- Browser testing
- Release qualification
- Defect severity

---

## `08_deployment_and_release.md`

Defines:

- Environments
- Build variants
- CI/CD
- Static web deployment
- itch.io packaging
- Maia container deployment
- Secrets
- Artifacts
- Versioning
- Rollback
- Monitoring
- Incident response
- Release approval

Use this document for:

- Deployment workflows
- itch.io releases
- Container builds
- Production configuration
- Rollback
- Release management

---

## `09_coding_guidelines.md`

Defines:

- TypeScript standards
- React standards
- Python standards
- FastAPI standards
- State management
- Async behavior
- Error handling
- Validation
- Security coding
- Testing conventions
- Git and pull requests
- Code review
- Codex rules

Use this document for:

- Daily implementation
- Code review
- Naming
- File placement
- Error behavior
- Testing discipline
- Contributor expectations

---

## `10_security_and_privacy.md`

Defines:

- Threat model
- Trust boundaries
- Data inventory
- Privacy defaults
- Browser security
- API security
- Maia subprocess security
- Secrets management
- Supply-chain security
- Logging and analytics
- Data retention
- Export and deletion
- Incident response
- Security release gates

Use this document for:

- Security-sensitive changes
- Data processing
- API hardening
- Logging
- Analytics
- Privacy notices
- Incident handling

---

## `11_project_roadmap.md`

Defines:

- Delivery phases
- Milestones
- Dependencies
- Workstreams
- Version 1 scope
- Implementation order
- Quality gates
- Risks
- Codex task sequencing
- Beta validation
- Stable release

Use this document for:

- Project planning
- Task sequencing
- Milestone tracking
- Scope control
- Release readiness

---

# 4. Recommended Reading Order

## First-Time Contributor

Read in this order:

```text
00_product_identity.md
01_prd.md
11_project_roadmap.md
09_coding_guidelines.md
05_architecture_design.md
```

Then read the document relevant to the assigned task.

## Frontend Work

Read:

```text
01_prd.md
02_ux_specification.md
03_design_system.md
04_technical_specification.md
05_architecture_design.md
07_testing_strategy.md
09_coding_guidelines.md
10_security_and_privacy.md
```

## Chess Core Work

Read:

```text
01_prd.md
04_technical_specification.md
05_architecture_design.md
07_testing_strategy.md
09_coding_guidelines.md
```

## Stockfish Work

Read:

```text
04_technical_specification.md
05_architecture_design.md
06_ai_architecture.md
07_testing_strategy.md
09_coding_guidelines.md
10_security_and_privacy.md
```

## Maia and AI Work

Read:

```text
01_prd.md
04_technical_specification.md
05_architecture_design.md
06_ai_architecture.md
07_testing_strategy.md
08_deployment_and_release.md
09_coding_guidelines.md
10_security_and_privacy.md
```

## Review Intelligence Work

Read:

```text
00_product_identity.md
01_prd.md
02_ux_specification.md
05_architecture_design.md
06_ai_architecture.md
07_testing_strategy.md
09_coding_guidelines.md
```

## Deployment Work

Read:

```text
04_technical_specification.md
05_architecture_design.md
07_testing_strategy.md
08_deployment_and_release.md
09_coding_guidelines.md
10_security_and_privacy.md
```

---

# 5. Authority and Conflict Resolution

When documents conflict, apply the following order.

## Product Scope

```text
01_prd.md
  ↓
11_project_roadmap.md
  ↓
00_product_identity.md
```

## User Experience

```text
Chess correctness
  ↓
02_ux_specification.md
  ↓
03_design_system.md
```

## Engineering

```text
Chess correctness
  ↓
10_security_and_privacy.md
  ↓
04_technical_specification.md
  ↓
05_architecture_design.md
  ↓
09_coding_guidelines.md
```

## AI

```text
Chess legality
  ↓
06_ai_architecture.md
  ↓
05_architecture_design.md
  ↓
04_technical_specification.md
```

## Testing and Release

```text
07_testing_strategy.md
  ↓
08_deployment_and_release.md
```

When a conflict remains unclear:

1. Stop implementation.
2. Record the conflict.
3. Create or update an ADR.
4. Update all affected documents.
5. Resume only after the decision is explicit.

---

# 6. Locked Version 1 Scope

Version 1 requires:

- Complete legal chess
- Polished browser-based gameplay
- Local two-player or practice support where approved
- Stockfish-based local opponent
- Adjustable opponent profiles (Maia-powered opposition moved to Version 2 by ADR-0003)
- Clocks
- Move history
- Undo in practice mode
- Save and resume
- PGN export
- Local game history
- Guided post-game review
- Objective Stockfish analysis
- Responsive design
- Accessibility baseline
- Web release
- itch.io release

Deferred:

- Maia-powered human-like opponent and human-likelihood context (ADR-0003)
- Authentication
- Cloud synchronization
- Online multiplayer
- Social features
- Public profiles
- Payments
- Leaderboards
- Puzzle platform
- Full personalized coaching
- Third-party LLM commentary
- Native mobile applications

---

# 7. Current Implementation Status

Documentation is complete. Version 1 implementation is complete and packaged for release.

| Area | Status |
|---|---|
| Product identity | Approved |
| Product requirements | Approved |
| UX specification | Approved |
| Design system | Approved |
| Technical specification | Approved, amended by ADR-0002 and ADR-0003 |
| Architecture | Approved, amended by ADR-0005 |
| AI architecture | Approved, amended by ADR-0003 |
| Testing strategy | Approved |
| Deployment and release | Approved, amended by ADR-0004, ADR-0005, and ADR-0006 |
| Coding guidelines | Approved |
| Security and privacy | Approved |
| Project roadmap | Approved, resequenced by ADR-0003 |
| Repository implementation | Complete |
| Chess core | Complete |
| Local persistence and recovery | Complete |
| Play experience | Complete |
| Stockfish integration | Complete (bundled, single-threaded) |
| Opponent profiles | Complete |
| Guided review | Complete |
| Game history and settings | Complete |
| Maia service | Deferred to Version 2 (ADR-0003) |
| itch.io packaging | Complete |

## 7.1 What Changed Against the Approved Plan

Three approved decisions were amended during implementation. Each has an ADR that records
the reason, the alternatives, and the consequences.

1. **The remote Maia service is not in Version 1** (ADR-0003). A static itch.io release
   cannot call a backend, and a required remote opponent would contradict the local-first
   and offline promises in the PRD. Version 1 ships engine-backed opponent profiles behind
   the same provider port, with honest strength labelling. `apps/maia-service` stays in the
   repository, unreleased.

2. **Stockfish is vendored and single-threaded** (ADR-0002). Threaded WebAssembly needs
   cross-origin isolation that the embedding page controls, which §11.5 of the technical
   specification already anticipated. The engine bytes are pinned by digest and verified in
   the quality gate.

3. **The project is GPL-3.0-or-later** (ADR-0004). Distributing Stockfish inside the
   package requires it. This replaces the previous `UNLICENSED` declaration.

Routing moved to hash-based URLs (ADR-0005) so one build works at a domain root, in a
subdirectory, and inside an itch.io iframe.

The web application is published to GitHub Pages from a `gh-pages` branch by a manual,
documented script rather than a CI workflow (ADR-0006).

## 7.2 Deferred to Version 2

- Remote Maia-3 service and human-like move prediction
- Human-likelihood context in review
- LLM explanation layer
- Accounts, cloud sync, online multiplayer, social features, puzzles

---

# 8. Architecture Decision Records

Architecture decisions are stored in `docs/adr/`. Where an ADR conflicts with a numbered
specification document, the ADR wins and the specification is treated as amended.

| ADR | Decision |
|---|---|
| `0001-browser-first-local-core.md` | The browser owns authoritative game state |
| `0002-bundled-stockfish-single-thread.md` | Vendored single-threaded Stockfish in a Web Worker |
| `0003-engine-opponent-profiles-replace-maia-in-v1.md` | Engine profiles replace Maia in Version 1 |
| `0004-gpl-relicensing.md` | The distributed work is GPL-3.0-or-later |
| `0005-hash-routing-for-static-hosting.md` | Hash routing and relative asset paths |

Each ADR should contain:

- Title
- Status
- Context
- Decision
- Alternatives
- Consequences
- Date

An ADR is required when:

- Replacing an approved technology
- Changing state ownership
- Changing API boundaries
- Introducing a new persistent data source
- Adding accounts or cloud sync
- Changing AI model strategy
- Changing deployment topology
- Accepting a major security exception

---

# 9. Documentation Change Policy

Documentation must change with the code when:

- Product scope changes
- Architecture changes
- API contracts change
- Persistent schemas change
- AI profiles change
- Security boundaries change
- Deployment behavior changes
- Release acceptance criteria change

Documentation drift is considered a defect.

Do not rewrite approved documents casually.

Significant changes require:

1. Reason
2. Impact
3. Related ADR
4. Updated tests
5. Updated roadmap or release notes where applicable

---

# 10. Codex Usage Rules

Codex must not receive vague requests such as:

```text
Build Caissa.
```

Every Codex task must include:

- Specific goal
- Relevant documents and sections
- Allowed files
- Required interfaces
- Error behavior
- Tests
- Security constraints
- Accessibility constraints
- Definition of done

## Codex Task Scope

Good:

```text
Implement the framework-independent ClockService.
```

Bad:

```text
Build chess gameplay.
```

## Codex Must Not

- Redesign the architecture
- Add unapproved dependencies
- Rewrite unrelated files
- Remove failing tests
- Weaken strict typing
- Use `any` to bypass errors
- Invent API contracts
- Implement deferred features
- Add authentication
- Add analytics
- Add silent fallbacks
- Add production deployment without instruction

---

# 11. Codex Document Requirements by Task

| Task Type | Required Documents |
|---|---|
| Repository foundation | 04, 05, 07, 08, 09, 10, 11 |
| UI component | 01, 02, 03, 07, 09 |
| Chess rules | 01, 04, 05, 07, 09 |
| Persistence | 04, 05, 07, 09, 10 |
| Stockfish | 04, 05, 06, 07, 09 |
| Maia service | 04, 05, 06, 07, 08, 09, 10 |
| Guided review | 00, 01, 02, 05, 06, 07, 09 |
| Deployment | 07, 08, 09, 10 |
| Security | 07, 08, 09, 10 |
| Release | 01, 07, 08, 10, 11 |

Document numbers refer to file prefixes.

---

# 12. Definition of Ready

A task is ready when:

- The goal is clear
- The requirement exists in documentation
- Dependencies are complete
- Interfaces are defined
- Error behavior is defined
- Tests are defined
- Allowed files are known
- Acceptance criteria exist
- No unresolved architecture conflict exists

---

# 13. Definition of Done

A task is complete when:

- Behavior matches documentation
- Type checking passes
- Linting passes
- Tests pass
- Required tests were added
- Architecture boundaries remain intact
- Accessibility was considered
- Security requirements were followed
- Documentation was updated where necessary
- No placeholder or debug code remains
- The change was reviewed

---

# 14. Implementation Order

The approved execution sequence was, and was followed except where ADR-0003 resequenced
Maia out of Version 1:

```text
1. Repository foundation
2. Product design prototype
3. Chess domain core
4. Local persistence
5. Play experience
6. Stockfish integration
7. Maia service
8. Opponent calibration
9. Guided review
10. Accessibility and responsive polish
11. Security and release engineering
12. Beta validation
13. Stable Version 1
```

Do not begin with:

- Maia
- Landing-page animation
- Authentication
- Multiplayer
- Advanced coaching
- Social features

The first serious implementation must establish the repository and chess foundation.

---

# 15. Repository Documentation Placement

Recommended structure:

```text
docs/
├── README.md
├── 00_product_identity.md
├── 01_prd.md
├── 02_ux_specification.md
├── 03_design_system.md
├── 04_technical_specification.md
├── 05_architecture_design.md
├── 06_ai_architecture.md
├── 07_testing_strategy.md
├── 08_deployment_and_release.md
├── 09_coding_guidelines.md
├── 10_security_and_privacy.md
├── 11_project_roadmap.md
└── adr/
```

---

# 16. Contribution Checklist

Before starting:

- Read required documents
- Confirm task scope
- Confirm allowed files
- Confirm dependencies
- Confirm acceptance criteria

Before submitting:

- Run verification
- Review every changed file
- Remove debug code
- Update documentation
- Confirm no deferred feature was added
- Confirm no architecture boundary was violated

---

# 17. Documentation Completion Status

The current documentation suite establishes:

- What Caissa is
- Why it exists
- Who it serves
- What Version 1 contains
- How the experience behaves
- How it should look
- How it is architected
- How AI is used
- How quality is verified
- How releases are deployed
- How code is written
- How security and privacy are protected
- How implementation should proceed

The next step is not another high-level product document.

The next step is controlled implementation.

---

# 18. Final Direction

Caissa should be implemented from these documents, not from improvisation.

The documentation exists to keep every contribution aligned with the same product promise:

> Play realistically, understand clearly, and improve meaningfully.

The repository should preserve that promise in its architecture, code, tests, AI, interface, and release process.
