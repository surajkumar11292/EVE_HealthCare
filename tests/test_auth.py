import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
from app.models.user import User


@pytest.mark.asyncio
async def test_signup_success(client: AsyncClient):
    """
    Verifies that a new user can register successfully and password is not returned.
    """
    payload = {
        "email": "newuser@example.com",
        "full_name": "New User",
        "password": "SecurePassword123!",
    }

    response = await client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert data["role"] == "PATIENT"
    assert "id" in data
    assert "password" not in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_signup_duplicate_email(client: AsyncClient, patient_user: User):
    """
    Verifies that registering with an already existing email returns 409 Conflict.
    """
    payload = {
        "email": patient_user.email,
        "full_name": "Duplicate User",
        "password": "SecurePassword123!",
    }

    response = await client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_signup_weak_password_validation(client: AsyncClient):
    """
    Verifies that passwords failing complexity criteria return 422 Unprocessable Entity.
    """
    payload = {
        "email": "weak@example.com",
        "full_name": "Weak Pass",
        "password": "short",
    }

    response = await client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, patient_user: User):
    """
    Verifies that login with valid credentials returns access_token and token_type.
    """
    payload = {
        "email": patient_user.email,
        "password": "PatientPass123!",
    }

    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"].lower() == "bearer"
    assert data["expires_in"] > 0


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, patient_user: User):
    """
    Verifies that login with incorrect password returns 401 Unauthorized.
    """
    payload = {
        "email": patient_user.email,
        "password": "WrongPassword999!",
    }

    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_non_existent_email(client: AsyncClient):
    """
    Verifies that login with non-existent email returns 401 Unauthorized without leaking user existence.
    """
    payload = {
        "email": "doesnotexist@example.com",
        "password": "AnyPassword123!",
    }

    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_me_success(client: AsyncClient, patient_headers: dict, patient_user: User):
    """
    Verifies that GET /auth/me returns current user details when authorized.
    """
    response = await client.get("/api/v1/auth/me", headers=patient_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == patient_user.email
    assert data["full_name"] == patient_user.full_name


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    """
    Verifies that GET /auth/me without Bearer token returns 401 Unauthorized.
    """
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_invalid_token(client: AsyncClient):
    """
    Verifies that GET /auth/me with malformed token returns 401 Unauthorized.
    """
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token.here"},
    )
    assert response.status_code == 401
