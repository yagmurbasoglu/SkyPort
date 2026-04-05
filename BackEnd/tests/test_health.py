from datetime import datetime

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_live_endpoint_returns_200() -> None:
    response = client.get("/health/live")
    assert response.status_code == 200


def test_ready_endpoint_returns_200() -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200


def test_health_response_contains_expected_fields() -> None:
    response = client.get("/health/live")
    body = response.json()

    assert body["status"] == "ok"
    assert "service" in body
    assert "environment" in body
    assert "timestamp" in body

    datetime.fromisoformat(body["timestamp"].replace("Z", "+00:00"))


def test_unknown_health_route_returns_404() -> None:
    response = client.get("/health/unknown")
    assert response.status_code == 404

