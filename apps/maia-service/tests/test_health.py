"""Health endpoint contract tests."""

from fastapi.testclient import TestClient

from caissa_maia_service.config import Settings
from caissa_maia_service.main import create_app


def test_health_returns_structured_service_identity() -> None:
    settings = Settings(environment="test")

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "serviceName": "caissa-maia-service",
        "serviceVersion": "0.1.0",
        "status": "ok",
        "environment": "test",
    }


def test_openapi_documents_the_health_contract() -> None:
    with TestClient(create_app(Settings(environment="test"))) as client:
        response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/api/v1/health" in response.json()["paths"]
