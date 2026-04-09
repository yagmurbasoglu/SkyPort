from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_register_returns_created_user() -> None:
    user = SimpleNamespace(
        id=1,
        email="new.user@example.com",
        role="passenger",
        full_name="New User",
        is_active=True,
    )
    with patch("app.api.routes.auth.UserService.create_user", return_value=user):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "new.user@example.com",
                "password": "strong-password",
                "role": "passenger",
                "full_name": "New User",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "new.user@example.com"
    assert body["role"] == "passenger"
    assert body["is_active"] is True


def test_register_with_duplicate_email_returns_400() -> None:
    with patch(
        "app.api.routes.auth.UserService.create_user",
        side_effect=HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        ),
    ):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "existing.user@example.com",
                "password": "strong-password",
                "role": "passenger",
            },
        )

    assert response.status_code == 400


def test_login_returns_access_token() -> None:
    authenticated_user = SimpleNamespace(id=42)
    with patch(
        "app.api.routes.auth.AuthService.authenticate",
        return_value=authenticated_user,
    ):
        response = client.post(
            "/api/auth/login",
            data={
                "username": "user@example.com",
                "password": "correct-password",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_with_invalid_credentials_returns_401() -> None:
    with patch(
        "app.api.routes.auth.AuthService.authenticate",
        side_effect=HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ),
    ):
        response = client.post(
            "/api/auth/login",
            data={
                "username": "user@example.com",
                "password": "wrong-password",
            },
        )

    assert response.status_code == 401


def test_login_with_inactive_user_returns_401() -> None:
    with patch(
        "app.api.routes.auth.AuthService.authenticate",
        side_effect=HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={"WWW-Authenticate": "Bearer"},
        ),
    ):
        response = client.post(
            "/api/auth/login",
            data={
                "username": "inactive.user@example.com",
                "password": "correct-password",
            },
        )

    assert response.status_code == 401
