# Caissa Maia Service

Typed FastAPI foundation for Caissa's future Maia inference boundary.

Phase 1 provides only `GET /api/v1/health`, validated startup configuration, and a stable error envelope. It does not include Maia-3, model files, python-chess, inference endpoints, a worker pool, remote persistence, authentication, analytics, or CORS middleware.

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
