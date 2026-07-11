"""Public HTTP response contracts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from caissa_maia_service.config import ServiceEnvironment


class HealthResponse(BaseModel):
    """Stable response for the versioned health endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    service_name: str = Field(alias="serviceName")
    service_version: str = Field(alias="serviceVersion")
    status: Literal["ok"]
    environment: ServiceEnvironment


class ErrorDetail(BaseModel):
    """Machine-readable service failure details."""

    code: str
    message: str
    retryable: bool
    request_id: str | None = Field(default=None, alias="requestId")


class ErrorResponse(BaseModel):
    """Stable error envelope shared by all future endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    error: ErrorDetail
