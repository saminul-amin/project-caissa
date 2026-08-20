# Caissa Maia Service

Typed FastAPI foundation for Caissa's future Maia inference boundary.

> **Not part of Version 1.** Maia-3 opposition is deferred to Version 2 by
> `docs/adr/0003-engine-opponent-profiles-replace-maia-in-v1.md`: a static itch.io release
> cannot depend on a remote service, and a required backend would contradict Caissa's
> local-first and offline promises. Version 1 ships engine-backed opponent profiles behind
> the same provider port, so this service can be added later without reopening the game
> controller or any screen.
>
> This service is not built, deployed, or called by the released application.

It provides only `GET /api/v1/health`, validated startup configuration, and a stable error envelope. It does not include Maia-3, model files, python-chess, inference endpoints, a worker pool, remote persistence, authentication, analytics, or CORS middleware.

## Setup

From the repository root using Python 3.13 and uv 0.11.8:

```text
uv sync --frozen --project apps/maia-service
```

`pyproject.toml` declares runtime and development dependencies. `uv.lock` freezes their complete transitive resolution, and uv manages an ignored project virtual environment.

## Run

```text
uv run --frozen --project apps/maia-service python -m uvicorn caissa_maia_service.main:app --app-dir apps/maia-service/src --reload
```

The health endpoint is available at `http://127.0.0.1:8000/api/v1/health`.

## Validate

```text
uv run --frozen --project apps/maia-service ruff check apps/maia-service
uv run --frozen --project apps/maia-service ruff format --check apps/maia-service
uv run --frozen --project apps/maia-service pytest apps/maia-service
```
