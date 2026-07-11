# Caissa — Coding Guidelines

**Document ID:** CAISSA-CODE-001  
**Document Type:** Repository Coding Standards and Engineering Conventions  
**Version:** 1.0  
**Status:** Approved for Implementation  
**Product:** Caissa  
**Product Slogan:** Beyond the Best Move  
**Prepared:** July 2026  
**Owner:** Md. Saminul Amin  
**Primary Audience:** Frontend Engineering, Backend Engineering, AI Engineering, QA, DevOps, Technical Reviewers, Contributors, and Codex-assisted development

---

## 1. Purpose

This document defines the coding standards for the Caissa repository.

It establishes mandatory conventions for TypeScript, React, Python, FastAPI, chess-domain code, state management, asynchronous workflows, error handling, validation, persistence, engine integrations, accessibility, security, performance, testing, documentation, Git, pull requests, code review, and Codex-assisted implementation.

These guidelines exist to keep the codebase correct, predictable, readable, testable, secure, accessible, maintainable, and consistent across contributors.

This is not a general-purpose style guide. It is specific to Caissa’s approved product and architecture.

---

## 2. Related Documents

This document must remain consistent with:

- `00_product_identity.md`
- `01_prd.md`
- `02_ux_specification.md`
- `03_design_system.md`
- `04_technical_specification.md`
- `05_architecture_design.md`
- `06_ai_architecture.md`
- `07_testing_strategy.md`
- `08_deployment_and_release.md`
- `10_security_and_privacy.md` — planned
- `11_project_roadmap.md` — planned

When conflicts occur, use this priority:

1. Chess correctness
2. Security and data integrity
3. Accessibility
4. Architecture boundaries
5. Testing requirements
6. This coding guide
7. Local preference

---

# 3. Engineering Principles

## 3.1 Prefer Clarity Over Cleverness

Code should be understandable by a competent contributor without requiring hidden context.

Avoid:

- Dense one-liners
- Unnecessary abstractions
- Metaprogramming without strong justification
- Clever type tricks that reduce readability
- Hidden side effects
- Ambiguous names

## 3.2 Make Invalid States Difficult to Represent

Use narrow types, validated constructors, state machines, branded identifiers, discriminated unions, schema validation, and explicit result types.

Do not rely on comments to prevent invalid combinations.

## 3.3 Keep the Game Authoritative

The authoritative game state belongs to the game controller and chess-rules layer.

No component, engine, API client, or persistence adapter may bypass the validated move-commit path.

## 3.4 Keep Side Effects at the Edges

Domain logic should remain deterministic.

HTTP, IndexedDB, Web Workers, audio, logging, timers, and browser APIs must remain behind adapters or application services.

## 3.5 Fail Explicitly

Do not silently ignore invalid engine output, failed persistence, schema mismatch, illegal moves, missing configuration, or unsupported capabilities.

Map failures into typed errors and recovery behavior.

## 3.6 Optimize Only With Evidence

Do not add complexity for hypothetical performance. Measure first.

## 3.7 Comments Explain Why

Comments should explain decisions, workarounds, invariants, and non-obvious boundaries. They should not restate obvious code.

---

# 4. Repository-Wide Rules

## 4.1 Encoding and Line Endings

- All source files use UTF-8.
- Use LF line endings.
- Every text file ends with a newline.

## 4.2 Formatting

Formatting is automated:

- TypeScript, JSON, Markdown, and CSS: Prettier
- Python: Ruff formatter or Black-compatible formatting

Manual preferences must not fight the formatter.

## 4.3 Linting and Type Checking

- TypeScript: ESLint
- Python: Ruff
- Type checking: TypeScript strict mode and mypy or pyright

No lint rule should be disabled globally without documented justification.

## 4.4 Generated Files

Generated files must be clearly identified, reproducible, never hand-edited, and regenerated through documented commands.

## 4.5 Secrets

Secrets must never appear in source code, fixtures, documentation examples, screenshots, logs, or client environment variables.

---

# 5. File and Folder Naming

## 5.1 TypeScript and React

Use kebab-case for general files:

```text
game-controller.ts
stockfish-worker-client.ts
review-orchestrator.ts
```

Use PascalCase when a React component is the primary export:

```text
GameBoard.tsx
PromotionDialog.tsx
ReviewPanel.tsx
```

Hooks:

```text
use-game-session.ts
use-keyboard-board.ts
```

Tests:

```text
game-controller.test.ts
GameBoard.test.tsx
active-game.spec.ts
```

## 5.2 Python

Use snake_case:

```text
worker_pool.py
move_service.py
model_registry.py
```

## 5.3 Directories

Use kebab-case:

```text
game-session/
stockfish/
maia-service/
shared-contracts/
```

## 5.4 Barrel Files

Use `index.ts` only for intentional public module APIs. Do not export every internal file automatically.

---

# 6. TypeScript Standards

## 6.1 Strict Mode

TypeScript strict mode is mandatory.

Recommended options:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "useUnknownInCatchVariables": true
}
```

## 6.2 Avoid `any`

`any` is prohibited unless interacting with an untyped external boundary and immediately validating or narrowing the value.

Prefer `unknown`, generics, narrow interfaces, and runtime schemas.

## 6.3 Type Inference

Use inference when obvious.

```ts
const timeoutMs = 5_000;
```

Use explicit types for public APIs, complex return values, cross-package contracts, domain entities, reducers, state machines, and external boundaries.

## 6.4 Interfaces and Type Aliases

Use `interface` for object contracts, ports, services, and component props.

Use `type` for unions, intersections, branded primitives, function types, and mapped types.

## 6.5 Discriminated Unions

Prefer:

```ts
type EngineState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; version: string }
  | { status: "searching"; requestId: RequestId }
  | { status: "failed"; error: AppError };
```

Avoid contradictory boolean collections.

## 6.6 Branded Types

Use branded types for semantically distinct values:

```ts
type Fen = string & { readonly __brand: "Fen" };
type UciMove = string & { readonly __brand: "UciMove" };
type GameId = string & { readonly __brand: "GameId" };
```

Compile-time branding does not replace runtime validation.

## 6.7 `null` and `undefined`

Use `undefined` for optional application values. Use `null` only when required by external contracts or explicit semantics.

## 6.8 Enums

Prefer string unions over TypeScript enums.

## 6.9 Exhaustiveness

Switches over discriminated unions must be exhaustive.

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}
```

## 6.10 Immutability

Prefer immutable domain transformations and readonly collections where ownership matters.

---

# 7. Function Standards

## 7.1 Responsibility

A function should have one clear purpose.

Functions above approximately 40–60 lines should be reviewed for hidden responsibilities.

## 7.2 Parameters

Avoid long positional argument lists.

Prefer:

```ts
calculateClockAfterMove({
  clock,
  side,
  now,
  incrementMs,
});
```

## 7.3 Boolean Parameters

Avoid ambiguous booleans.

Bad:

```ts
createReview(game, true, false);
```

Better:

```ts
createReview(game, {
  includeHumanLikelihood: true,
  deepAnalysis: false,
});
```

## 7.4 Pure Functions

Domain calculations should be pure whenever possible.

## 7.5 Early Returns

Use early returns to reduce nesting when clarity improves.

## 7.6 No Hidden I/O

A function named `calculateEvaluation` must not secretly write to storage or call a remote service.

---

# 8. Naming Standards

Names should be specific, searchable, domain-aligned, and consistent.

## 8.1 Booleans

Use:

- `is`
- `has`
- `can`
- `should`
- `was`

Examples:

```ts
isInCheck
hasActiveGame
canUndo
shouldAutoFallback
```

## 8.2 Commands and Queries

Commands use verbs:

```ts
commitMove
restoreGame
cancelSearch
saveReview
```

Queries use clear read-oriented names:

```ts
getLegalMoves
findSavedGame
isTerminalPosition
```

## 8.3 Avoid Vague Names

Avoid `data`, `item`, `thing`, `temp`, `helper`, `manager`, and `utils` unless scope is unmistakable.

## 8.4 Acronyms

Use conventional casing:

```ts
apiClient
pgnParser
fenValidator
uciCommand
```

---

# 9. React Standards

## 9.1 Components

Use function components.

Components primarily handle rendering, interaction wiring, accessibility semantics, and local UI state.

They do not directly handle chess legality, database transactions, UCI parsing, API contract mapping, or global orchestration.

## 9.2 Props

Props should be explicit and minimal.

Do not pass full stores or service containers when a read model and callbacks are sufficient.

## 9.3 Hooks

Hooks must:

- Start with `use`
- Have one clear responsibility
- Avoid hidden global side effects
- Clean up listeners and subscriptions
- Return stable, documented values

## 9.4 Effects

`useEffect` synchronizes with external systems.

Do not use it for calculations that belong in render, event handlers, selectors, or domain services.

Avoid chained effects and effect-driven business workflows.

## 9.5 Derived State

Compute derived state from source values rather than duplicating it.

## 9.6 Memoization

Use `useMemo` and `useCallback` only when referential stability or measured cost requires them.

## 9.7 Keys

Use stable domain IDs. Do not use array indexes for reorderable or stateful lists.

## 9.8 Conditional Rendering

Prefer explicit branches over deeply nested ternaries.

## 9.9 Accessibility

Every interactive component must define semantic role, accessible name, focus behavior, keyboard behavior, disabled behavior, and error behavior.

---

# 10. React Component Pattern

```tsx
interface GameResultCardProps {
  result: GameResultViewModel;
  onReview(): void;
  onRematch(): void;
}

export function GameResultCard({
  result,
  onReview,
  onRematch,
}: GameResultCardProps) {
  return (
    <section aria-labelledby="game-result-title">
      <h2 id="game-result-title">{result.title}</h2>
      <p>{result.summary}</p>

      <div>
        <Button onClick={onReview}>Review Game</Button>
        <Button variant="secondary" onClick={onRematch}>
          Play Again
        </Button>
      </div>
    </section>
  );
}
```

This pattern has typed props, semantic markup, clear callbacks, and no direct service access.

---

# 11. State Management Standards

## 11.1 React Local State

Use local state for:

- Open or closed UI
- Local selection
- Temporary field values
- Hover/focus display
- One-component animation state

## 11.2 Zustand

Use Zustand for approved cross-component application state.

Stores must not become databases, service containers, API clients, engine parsers, or generic event buses.

## 11.3 Store Shape

Prefer small, focused stores with product-oriented actions.

## 11.4 Selectors

Components subscribe to narrow selectors, not entire stores.

## 11.5 Server State

Use TanStack Query only for remote server state.

Authoritative game state must never live in query cache.

---

# 12. Async and Concurrency Standards

## 12.1 Promises

No floating promises unless intentionally fire-and-forget.

Intentional fire-and-forget must use `void`, handle errors internally, and have documented behavior.

## 12.2 Cancellation

Support cancellation for HTTP requests, Stockfish searches, review analysis, and obsolete engine work.

## 12.3 Request Identity

Every engine request has a request ID.

Ignore results when request ID, position, ply, or game phase no longer match.

## 12.4 Race Conditions

Do not use “last response wins” unless the response is valid for the current expected state.

## 12.5 Timeouts

Every remote or long-running operation has an explicit timeout.

## 12.6 Retries

Retries must be limited, condition-specific, observable, and safe.

Invalid input must not be retried.

---

# 13. Error Handling

## 13.1 Typed Errors

Use the approved `AppError` shape.

Infrastructure errors must be mapped before reaching UI.

## 13.2 Catch Variables

Treat caught values as `unknown`.

```ts
try {
  await repository.save(game);
} catch (error: unknown) {
  throw mapStorageError(error);
}
```

## 13.3 Empty Catch Blocks

Empty catches are prohibited.

## 13.4 Error Messages

Internal technical messages and user-facing product copy are separate.

## 13.5 Preserve Cause

Preserve the underlying cause where supported.

## 13.6 Safe Context

Include request ID, operation, version, and safe engine state where relevant.

Do not include secrets or unnecessary full game data.

## 13.7 Recoverability

Every recoverable error defines a recovery action.

---

# 14. Validation Standards

Validate at trust boundaries:

- HTTP requests
- HTTP responses
- Environment variables
- IndexedDB records
- Imported PGN/FEN
- Worker messages
- Engine output
- Build metadata

Use Zod in TypeScript and Pydantic in Python.

Once parsed into a trusted internal type, do not redundantly validate at every internal call unless crossing another boundary.

---

# 15. Chess-Domain Coding Rules

## 15.1 Rules Authority

Browser legality comes from the chess rules adapter.

No board component may implement legality independently.

## 15.2 Explicit Formats

Use explicit types for SAN, UCI, FEN, PGN, square, and color.

## 15.3 Evaluation Perspective

Every evaluation specifies its perspective.

## 15.4 Move Commit

Only the game controller commits moves.

## 15.5 Result Detection

Terminal-state logic is centralized.

## 15.6 Undo

Undo reconstructs validated state from history or snapshots.

Do not reverse piece arrays manually in UI code.

## 15.7 Special Rules

Unusual chess behavior should have a short explanatory comment and regression test.

---

# 16. Engine Integration Standards

## 16.1 Stockfish

Only Stockfish infrastructure may know raw UCI commands.

## 16.2 Maia

Only Maia infrastructure may know service endpoints and UCI process implementation.

## 16.3 Untrusted Output

Validate:

- Move format
- Move legality
- Expected request
- Expected position
- Numeric values
- Candidate uniqueness

## 16.4 Lifecycle

Every engine adapter implements initialize, ready, execute, cancel, dispose, and recover or fail clearly.

## 16.5 Fallback

Changing Maia to Stockfish must never be silent.

---

# 17. Persistence Standards

## 17.1 Repositories

UI and domain code use repository interfaces.

## 17.2 Transactions

Use transactions for logically atomic updates.

## 17.3 Schema Versioning

Durable records include schema version where appropriate.

## 17.4 Migrations

Migrations are idempotent, tested, non-destructive where possible, and preserve PGN.

## 17.5 Failure

Do not erase a valid in-memory game because persistence failed.

## 17.6 localStorage

Use localStorage only for small preferences.

Use IndexedDB for games, reviews, and analysis data.

---

# 18. Python Standards

## 18.1 Typing

Public functions and methods require type annotations.

Complex internal functions should also be typed.

## 18.2 Pydantic and Dataclasses

Use Pydantic for external validation.

Use dataclasses or typed classes for internal immutable structures where appropriate.

## 18.3 Async

Use async for I/O and concurrency.

Do not disguise CPU-bound inference as async without a process or thread boundary.

## 18.4 Imports

Import order:

1. Standard library
2. Third-party
3. Local application

## 18.5 Exceptions

Use domain-specific exceptions.

Broad `except Exception` is allowed only at controlled boundaries with mapping, logging, and safe handling.

## 18.6 Context Managers

Use context managers for files, processes, locks, and temporary resources.

## 18.7 Subprocesses

Never construct shell commands from user input.

Use argument lists and controlled executable paths.

---

# 19. FastAPI Standards

## 19.1 Routes

Routes handle HTTP concerns, dependency injection, response mapping, and status codes.

Routes do not contain inference logic.

## 19.2 Services

Application services coordinate validation, worker acquisition, timeout, result mapping, and metrics.

## 19.3 Schemas

Request and response models are explicit.

## 19.4 Error Contract

Use stable error codes and one error envelope.

## 19.5 Dependency Injection

Use FastAPI dependencies for configuration, request context, rate-limit context, and service access.

## 19.6 Lifespan

Initialize and close worker pools through the application lifespan.

## 19.7 OpenAPI

Public contract changes require compatibility review and contract tests.

---

# 20. Python Example

```python
from dataclasses import dataclass

from app.domain.errors import MaiaBusyError
from app.domain.requests import MaiaMoveRequest
from app.domain.responses import MaiaMoveResult
from app.infrastructure.maia.worker_pool import MaiaWorkerPool


@dataclass(frozen=True)
class MaiaMoveService:
    worker_pool: MaiaWorkerPool

    async def get_move(self, request: MaiaMoveRequest) -> MaiaMoveResult:
        worker = await self.worker_pool.acquire()

        if worker is None:
            raise MaiaBusyError("No Maia worker is currently available.")

        try:
            return await worker.infer_move(request)
        finally:
            await self.worker_pool.release(worker)
```

---

# 21. API Coding Standards

- Use versioned API paths.
- GET requests must not mutate state.
- Define retry and idempotency behavior for mutations.
- Accept or create request IDs for inference.
- Set timeouts at client and service boundaries.
- Use status codes consistently.
- Never return stack traces.

Typical status codes:

- `200` success
- `400` invalid request
- `422` schema validation
- `429` rate limited
- `503` busy or unready
- `504` inference timeout where appropriate

---

# 22. CSS and Tailwind Standards

## 22.1 Tokens

Use approved semantic design tokens.

Do not scatter literal hex values.

## 22.2 Class Composition

Use one approved variant/composition utility.

Avoid complex string concatenation.

## 22.3 Arbitrary Values

Use arbitrary values only when tokens cannot represent the need or board geometry requires them.

## 22.4 Inline Styles

Use inline styles only for truly dynamic values such as calculated dimensions or CSS variables.

## 22.5 Global CSS

Reserve global CSS for tokens, reset/base styles, font declarations, accessibility utilities, and product-wide motion preferences.

## 22.6 Responsive Behavior

Reorganize or collapse according to the UX specification. Do not hide essential information simply because width decreases.

---

# 23. Accessibility Coding Standards

- Use native HTML before ARIA.
- Clickable actions use `<button>`.
- Inputs require labels.
- Dialogs require an accessible title, focus trap, Escape handling, focus return, and correct semantics.
- Use controlled live regions for meaningful move, check, result, and engine announcements.
- Every feature defines keyboard behavior.
- Do not remove focus outlines without replacement.
- Respect `prefers-reduced-motion`.

---

# 24. Security Coding Standards

- Do not use untrusted HTML.
- Treat PGN headers, API responses, query strings, and engine output as untrusted.
- Validate external URLs.
- Never log secrets, authorization headers, identity data, or full games without approved purpose.
- Review every new production dependency.
- Never execute user-controlled shell commands.
- Configure CORS explicitly.

---

# 25. Performance Coding Standards

- Heavy analysis never runs on the main thread.
- Clock ticks must not rerender the whole app.
- Lazy-load Stockfish, review charts, advanced analysis, non-default themes, and heavy optional routes.
- Clean up workers, timers, subscriptions, listeners, abort controllers, object URLs, and audio resources.
- Bound caches and unbounded collections.
- Performance-sensitive changes should include evidence when meaningful.

---

# 26. Logging Standards

Use structured logging with approved levels:

- `debug`
- `info`
- `warning`
- `error`
- `critical`

User-facing messages are not logs.

Include request ID and version where relevant.

Production browser code must not contain uncontrolled `console.log`.

---

# 27. Comments and Documentation

## 27.1 Public APIs

Public service interfaces should have concise documentation.

## 27.2 Invariants

Document non-obvious invariants near the code.

## 27.3 TODOs

TODOs should include a reason and issue reference when available.

Avoid vague permanent TODOs.

## 27.4 Package README

Major packages should explain purpose, public API, development commands, boundaries, and testing.

## 27.5 Diagrams

Update architecture diagrams when behavior changes materially.

---

# 28. Testing Coding Standards

- Use clear Arrange, Act, Assert phases.
- Test names describe behavior.
- Do not use arbitrary sleep.
- Prefer accessible queries.
- Mock external boundaries, not the core function under test.
- Use named fixtures.
- Every fixed bug gets a regression test.
- Snapshots may support, but not replace, critical assertions.

Example:

```ts
describe("GameController", () => {
  it("rejects an opponent proposal for a stale position", async () => {
    const game = createGameFixture();
    const controller = createGameController({ game });

    const proposal = createOpponentProposal({
      expectedFen: asFen("stale-fen"),
      expectedPly: game.history.length,
      move: asUciMove("g8f6"),
    });

    const result = await controller.commitOpponentMove(proposal);

    expect(result).toEqual({
      status: "rejected",
      reason: "position-mismatch",
    });
    expect(controller.getSession().position.fen).toBe(game.position.fen);
  });
});
```

---

# 29. Dependency Standards

Before adding a production dependency, document:

- Purpose
- License
- Maintenance status
- Bundle or runtime cost
- Security risk
- Alternatives
- Replacement difficulty

Do not add duplicate libraries for the same concern without approval.

Commit lockfiles.

Avoid unsupported deep imports from third-party internals.

---

# 30. Architecture Import Rules

Prohibited:

```text
domain → React
domain → Dexie
domain → FastAPI
ui → Dexie tables
ui → raw fetch
features → worker implementation
features → UCI parser
```

Allowed:

```text
UI → application command
application service → domain
application service → port
adapter → external library
```

Architecture linting must enforce these boundaries.

---

# 31. Git Standards

## 31.1 Branch Names

```text
feature/game-controller
fix/clock-timeout
docs/ai-architecture
chore/update-stockfish
```

## 31.2 Commits

Use clear imperative messages:

```text
Add active-game restoration
Fix stale Maia response handling
Document Stockfish worker lifecycle
```

## 31.3 Commit Scope

Commits should be focused and reviewable.

Avoid mixing refactors, features, formatting, and unrelated fixes.

## 31.4 Generated Output

Do not commit local build output unless it is an approved generated source or release artifact.

---

# 32. Pull Request Standards

Every pull request should include:

- Purpose
- Scope
- Related issue or document
- Technical approach
- Tests
- Screenshots for UI changes
- Accessibility impact
- Performance impact
- Migration impact
- Known limitations
- Rollback considerations where relevant

Prefer small, coherent pull requests.

A PR is review-ready when CI passes, tests and documentation are updated, self-review is complete, and debug code is removed.

---

# 33. Code Review Standards

Reviewers should evaluate:

## Correctness

- Does behavior match requirements?
- Are chess invariants preserved?
- Are races handled?

## Architecture

- Are boundaries respected?
- Are abstractions justified?
- Is state owned correctly?

## Security

- Is input validated?
- Are secrets and logs safe?

## Accessibility

- Are semantics and keyboard behavior correct?

## Testing

- Are important scenarios covered?
- Are tests meaningful?

## Maintainability

- Are names clear?
- Is complexity reasonable?
- Is documentation sufficient?

Review comments should be specific and respectful.

---

# 34. Refactoring Standards

Refactoring should preserve observable behavior, keep tests green, improve clarity or architecture, and avoid unrelated feature changes.

Large refactors require motivation, boundary planning, regression evidence, and rollback consideration.

Do not casually refactor critical chess code during release stabilization.

---

# 35. Feature Flag Standards

Feature flags must:

- Have typed identifiers
- Have explicit defaults
- Be read through one service
- Have an owner
- Have an expiry or removal plan
- Not become scattered conditionals

Security must not depend on a client-side flag.

---

# 36. Environment Configuration Standards

- Parse configuration once.
- Do not access `import.meta.env` or `os.environ` throughout application code.
- Server configuration fails fast when required values are missing.
- Production-sensitive values require explicit production settings.

---

# 37. API Contract Standards

Contracts define:

- Required fields
- Optional fields
- Nullability
- Enumerations
- Error responses
- Version metadata

Changes require schema update, contract tests, documentation, and compatibility review.

---

# 38. AI-Specific Coding Rules

## 38.1 Semantic Separation

Do not reuse one type for Maia WDL and Stockfish WDL.

## 38.2 Provenance

Every AI output carries version metadata.

## 38.3 Evidence

No explanation text without evidence identifiers.

## 38.4 Model Control

Users select approved product profiles, not arbitrary model paths or unsafe raw parameters.

## 38.5 Intent

Code and templates must not assert user psychology.

## 38.6 Determinism

Use fixed seeds or deterministic profiles in tests where applicable.

---

# 39. CSS Example

Preferred:

```css
.game-panel {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
}

.game-panel:focus-within {
  border-color: var(--color-focus);
}
```

Avoid:

```css
.game-panel {
  background: #15191d;
  border-radius: 17px;
  box-shadow: 0 0 30px #00ffcc;
}
```

---

# 40. Code Documentation Example

```ts
/**
 * Validates and commits an opponent move proposal.
 *
 * The proposal is rejected if its request ID, expected FEN,
 * expected ply, or legal move no longer matches the active game.
 */
async function commitOpponentMove(
  proposal: OpponentMoveProposal,
): Promise<MoveCommitResult> {
  // ...
}
```

Do not document obvious getters or setters.

---

# 41. Code Smells

Review or refactor when encountering:

- Function with unrelated branches
- Boolean-flag combinations
- Repeated type narrowing
- Repeated direct storage access
- Repeated error mapping
- Cross-feature imports
- Oversized store
- Component with business logic
- Unbounded cache
- Silent catch
- Duplicate chess rules
- Repeated literal colors
- Long effect chains
- Async operation without cancellation
- Test requiring arbitrary waits

---

# 42. Prohibited Patterns

The following are prohibited unless explicitly approved:

1. `any` as a shortcut
2. Empty catch blocks
3. Direct Dexie access from UI
4. Direct `fetch` from feature components
5. UCI strings outside engine infrastructure
6. Chess legality in board components
7. Mutable global singleton game state
8. Silent engine fallback
9. User-controlled shell commands
10. Secrets in frontend code
11. `dangerouslySetInnerHTML` without review
12. Random literal colors and radii
13. Index keys for stateful lists
14. Arbitrary sleeps in tests
15. Broad CI workflow permissions
16. Unbounded retries
17. Unversioned persistent schema changes
18. Model updates without provenance
19. Copying another chess product’s UI implementation
20. Disabling release tests to merge code

---

# 43. Codex-Assisted Development Rules

Codex is an implementation assistant, not an architecture authority.

## 43.1 Every Task Must Include

- Goal
- Relevant document sections
- Allowed files
- Required interfaces
- Tests
- Constraints
- Definition of done

## 43.2 Task Size

Prefer one module, adapter, component family, migration, or test suite.

Avoid:

```text
Build the entire chess app.
```

## 43.3 Codex Must Not

- Change architecture without instruction
- Add dependencies without approval
- Rewrite unrelated files
- Remove tests
- Weaken types
- Use `any` to bypass errors
- Invent API contracts
- Invent design tokens
- Hardcode secrets
- Add silent fallbacks
- Commit unnecessary generated output

## 43.4 Review Generated Code

Before accepting Codex output:

- Read every changed file
- Run tests
- Run type checks
- Inspect dependencies
- Confirm architecture boundaries
- Verify error behavior
- Verify accessibility
- Verify no placeholder remains

---

# 44. Example Codex Task

```text
Implement the Stockfish worker transport described in:

- 05_architecture_design.md sections 19 and 31
- 04_technical_specification.md section 11
- 09_coding_guidelines.md sections 12, 16, and 42

Allowed files:
- apps/web/src/infrastructure/workers/stockfish/**
- apps/web/src/services/stockfish/**
- related test files only

Requirements:
- Use typed request IDs.
- Support initialize, search, stop, and dispose.
- Ignore stale responses.
- Map raw worker errors to AppError.
- Do not expose UCI strings outside the Stockfish infrastructure module.
- Add tests for crash recovery, cancellation, stale response, and bestmove parsing.
- Do not add dependencies.
```

---

# 45. Definition of Done for Code Changes

A change is complete when:

- Behavior matches approved requirements
- Types pass
- Lint passes
- Tests pass
- New behavior has tests
- Architecture boundaries are respected
- Accessibility is addressed
- Errors are mapped
- Documentation is updated
- No debug code remains
- No secret or placeholder remains
- Performance impact is acceptable
- A reviewer can understand the change

---

# 46. Initial Tooling Configuration

Recommended tooling:

```text
Prettier
ESLint
TypeScript strict mode
Ruff
mypy or pyright
Vitest
Pytest
Playwright
dependency-cruiser
secret scanning
license scanning
```

Pre-commit hooks may run fast checks. Full verification remains in CI.

---

# 47. Locked Coding Decisions

The following are approved:

1. TypeScript strict mode is mandatory.
2. `any` is prohibited by default.
3. Domain code remains framework-independent.
4. Game-state changes pass through the game controller.
5. External data is validated at boundaries.
6. React components do not own chess rules.
7. Stores remain focused.
8. Side effects remain behind adapters.
9. Stockfish and Maia integrations remain isolated.
10. IndexedDB access uses repositories.
11. Python public APIs are typed.
12. FastAPI routes remain thin.
13. Raw engine output is untrusted.
14. Accessibility behavior is part of implementation.
15. Performance-sensitive work avoids the main thread.
16. Every bug gains a regression test.
17. Semantic design tokens are mandatory.
18. Production logging is structured.
19. Codex tasks are constrained and reviewable.
20. No code change is complete without tests and documentation impact.

---

# 48. Open Coding Decisions

Resolve during repository setup:

1. Exact ESLint configuration
2. Exact Prettier settings
3. Ruff versus Black-compatible formatting
4. mypy versus pyright
5. Exact class-variant utility
6. Exact dependency-graph tool
7. Exact pre-commit hook system
8. Whether Conventional Commits are mandatory
9. Exact generated OpenAPI client tooling
10. Whether Storybook is introduced
11. Exact mutation-testing scope
12. Exact code-coverage thresholds
13. Whether commit signing is required
14. Exact monorepo task runner
15. Exact Markdown linting rules

---

# 49. Coding Review Checklist

Before approving code, ask:

## Correctness

- Is behavior correct?
- Are chess invariants protected?
- Are invalid states rejected?

## Types

- Are types narrow and meaningful?
- Is runtime validation present at boundaries?
- Is `any` avoided?

## Architecture

- Is logic in the right layer?
- Are external systems wrapped?
- Are imports legal?

## Async

- Is cancellation supported?
- Are stale responses rejected?
- Are timeouts explicit?

## Errors

- Are errors typed?
- Is recovery defined?
- Is user messaging separate?

## Accessibility

- Are semantics, focus, and keyboard behavior correct?

## Testing

- Are relevant scenarios covered?
- Is testing deterministic?
- Is a regression test included for fixes?

## Maintainability

- Are names clear?
- Is complexity justified?
- Is documentation sufficient?

---

# 50. Coding Acceptance Criteria

This guide is implementation-ready when:

- TypeScript rules are defined.
- React rules are defined.
- Python and FastAPI rules are defined.
- Chess-domain constraints are explicit.
- State and async rules are defined.
- Validation and error rules are defined.
- Persistence and engine rules are defined.
- Accessibility and security rules are defined.
- Testing and Git standards are defined.
- Codex rules are defined.
- Prohibited patterns are listed.
- Review and definition-of-done criteria are documented.

---

# 51. Final Coding Direction

Caissa’s code should reflect the same qualities as its product experience:

- Calm
- Precise
- Understandable
- Intentional
- Reliable

The final coding principle is:

> Write code that makes the correct path obvious, the unsafe path difficult, and the future change understandable.

A contributor should not need to guess where chess logic belongs, where AI ends, where infrastructure begins, or how failure is handled.

The codebase should answer those questions through its types, boundaries, tests, and names.
