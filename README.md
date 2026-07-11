# Caissa

> Beyond the Best Move

Caissa is a browser-first, local-first, human-centered AI chess application. The product is intended to combine polished play, believable human-like opposition, objective analysis, and respectful post-game learning. This repository currently contains only the approved Phase 1 engineering foundation.

Chess gameplay, chess rules, a chessboard, Stockfish, Maia inference, persistence, game review, authentication, multiplayer, analytics, and production deployment are **not implemented yet**.

## Monorepo structure

```text
apps/
  web/                 React, TypeScript, Vite, Router, and Tailwind shell
  maia-service/        Health-only typed FastAPI service
packages/
  chess-core/          Framework-independent domain package placeholder
  shared-contracts/    Runtime-validated API contract foundation
  design-tokens/       Semantic CSS variables
  test-fixtures/       Future curated fixture inventory
docs/                  Authoritative product and engineering specifications
scripts/               Architecture, secret, and artifact checks
tooling/               Reserved shared tooling boundary
LICENSES/              Third-party license inventory foundation
.github/workflows/     Pull-request quality gates
```

## Prerequisites

- Node.js 24.12.0
- pnpm 11.11.0 through Corepack
- Python 3.13.x
- uv 0.11.8

The repository pins runtime identities in `.node-version`, `.nvmrc`, `.python-version`, `package.json`, and CI. Python 3.13 is the approved stable equivalent used for this foundation.

## Installation

Enable the pinned package manager and install the locked JavaScript workspace:

```text
corepack enable
corepack prepare pnpm@11.11.0 --activate
pnpm install --frozen-lockfile
```

Synchronize the FastAPI service and development tools from the committed Python lockfile:

```text
uv sync --frozen --project apps/maia-service
```

uv creates an ignored project virtual environment automatically. `pyproject.toml` remains the dependency declaration source and `apps/maia-service/uv.lock` freezes the complete resolution.

## Development commands

Run the web app and FastAPI service together:

```text
pnpm dev
```

Or run them independently:

```text
pnpm --filter @caissa/web dev
uv run --frozen --project apps/maia-service python -m uvicorn caissa_maia_service.main:app --app-dir apps/maia-service/src --reload
```

The web app defaults to `http://127.0.0.1:5173`. The service defaults to `http://127.0.0.1:8000`, with health at `/api/v1/health`.

## Quality and test commands

```text
pnpm build               Build shared TypeScript packages and the web app
pnpm lint                Lint TypeScript and Python
pnpm format:check        Check Prettier and Ruff formatting
pnpm typecheck           Run strict TypeScript checks
pnpm test                Run TypeScript and Python unit tests
pnpm test:e2e            Run the Playwright shell test
pnpm architecture:check  Enforce import boundaries and reject cycles
pnpm verify              Run the complete non-E2E quality gate
```

Install Chromium once before the local E2E command:

```text
pnpm exec playwright install chromium
```

Direct Python equivalents are:

```text
uv run --frozen --project apps/maia-service ruff check apps/maia-service
uv run --frozen --project apps/maia-service ruff format --check apps/maia-service
uv run --frozen --project apps/maia-service pytest apps/maia-service
```

## Architecture summary

Caissa uses a browser-owned, local-first core with explicit boundaries around future infrastructure. Domain packages cannot import applications or UI frameworks. UI code cannot access persistence implementations directly. Feature code cannot call raw `fetch`. Dependency cycles are rejected. Future Stockfish and Maia integrations must remain replaceable advisers; neither will own authoritative game state.

The FastAPI service is independently runnable and currently exposes only operational health. It has no Maia package, model download, worker pool, database, CORS middleware, authentication, or remote data retention.

## Documentation reading order

The complete authoritative suite is in `docs/`. New contributors should begin with:

1. `docs/00_product_indentity.md`
2. `docs/01_prd.md`
3. `docs/11_project_roadmap.md`
4. `docs/09_coding_guidelines.md`
5. `docs/05_architecture_design.md`

For repository foundation work, also read technical specification 04, testing strategy 07, deployment specification 08, and security/privacy specification 10. `docs/README.md` contains the complete task-based reading guide.

## Current implementation status

Phase 1 provides reproducible workspace configuration, a minimal accessible web shell, a typed service health boundary, shared contract and design-token foundations, testing tools, architecture enforcement, supply-chain checks, and pull-request CI.

No Phase 2 or later product capability has been implemented. In particular, there is no chess gameplay, Stockfish integration, Maia inference, model file, review engine, authentication, multiplayer, database server, analytics service, or production deployment workflow.
