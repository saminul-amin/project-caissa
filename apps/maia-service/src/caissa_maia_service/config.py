"""Validated service configuration."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ServiceEnvironment = Literal["local", "test", "preview", "production"]


class Settings(BaseSettings):
    """Configuration parsed once at the service boundary."""

    model_config = SettingsConfigDict(
        env_prefix="CAISSA_",
        extra="ignore",
        frozen=True,
    )

    service_name: str = Field(default="caissa-maia-service", min_length=1)
    service_version: str = Field(default="0.1.0", min_length=1)
    environment: ServiceEnvironment = "local"


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide validated settings instance."""

    return Settings()
