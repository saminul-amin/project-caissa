"""FastAPI application factory and process entry point."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from caissa_maia_service.api.router import router
from caissa_maia_service.config import Settings, get_settings
from caissa_maia_service.contracts import ErrorDetail, ErrorResponse
from caissa_maia_service.errors import ServiceError


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create an application with eagerly parsed, startup-validated configuration."""

    resolved_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        # Settings construction validates all configured fields before readiness.
        application.state.settings = resolved_settings
        yield

    application = FastAPI(
        title="Caissa Maia Service",
        version=resolved_settings.service_version,
        lifespan=lifespan,
    )
    application.state.settings = resolved_settings
    application.include_router(router)

    @application.exception_handler(ServiceError)
    async def handle_service_error(_request: Request, error: ServiceError) -> JSONResponse:
        response = ErrorResponse(
            error=ErrorDetail(
                code=error.code,
                message=error.message,
                retryable=error.retryable,
                request_id=error.request_id,
            )
        )
        return JSONResponse(
            content=response.model_dump(by_alias=True),
            status_code=error.status_code,
        )

    return application


app = create_app()
