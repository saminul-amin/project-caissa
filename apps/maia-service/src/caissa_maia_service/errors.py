"""Structured service error foundations."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ServiceError(Exception):
    """Known service failure that can be mapped safely to HTTP."""

    code: str
    message: str
    status_code: int = 500
    retryable: bool = False
    request_id: str | None = None
