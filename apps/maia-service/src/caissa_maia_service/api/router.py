"""Version 1 API routes."""

from fastapi import APIRouter, Request

from caissa_maia_service.config import Settings
from caissa_maia_service.contracts import HealthResponse

router = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=HealthResponse, tags=["operations"])
async def get_health(request: Request) -> HealthResponse:
    """Report process health and immutable runtime identity."""

    settings: Settings = request.app.state.settings
    return HealthResponse(
        service_name=settings.service_name,
        service_version=settings.service_version,
        status="ok",
        environment=settings.environment,
    )
