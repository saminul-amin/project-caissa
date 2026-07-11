"""Startup configuration validation tests."""

import pytest
from pydantic import ValidationError

from caissa_maia_service.config import Settings


def test_settings_reject_unknown_environment() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="unknown")  # type: ignore[arg-type]
