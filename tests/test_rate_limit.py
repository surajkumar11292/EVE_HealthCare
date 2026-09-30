import pytest
from httpx import AsyncClient
from slowapi.errors import RateLimitExceeded
from fastapi import Request

from app.core.rate_limit import limiter, get_client_identifier


@pytest.mark.asyncio
async def test_get_client_identifier():
    """
    Verifies that client IP extraction respects X-Forwarded-For and X-Real-IP headers.
    """
    class MockRequest:
        def __init__(self, headers=None, client_host="192.168.1.1"):
            self.headers = headers or {}
            self.client = type("Client", (), {"host": client_host})()

    # 1. Direct connection
    req1 = MockRequest()
    assert get_client_identifier(req1) == "192.168.1.1"

    # 2. X-Forwarded-For with multiple proxy IPs
    req2 = MockRequest(headers={"X-Forwarded-For": "203.0.113.195, 70.41.3.18, 150.172.238.178"})
    assert get_client_identifier(req2) == "203.0.113.195"

    # 3. X-Real-IP header
    req3 = MockRequest(headers={"X-Real-IP": "198.51.100.42"})
    assert get_client_identifier(req3) == "198.51.100.42"


@pytest.mark.asyncio
async def test_rate_limiting_trigger_429(
    client: AsyncClient,
):
    """
    Verifies that rapid sequential requests from the same IP trigger
    HTTP 429 Too Many Requests once the limit threshold is passed.
    """
    # Use login endpoint with a rate limit of 10/minute
    hit_count = 15
    responses = []
    for _ in range(hit_count):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@test.com", "password": "WrongPassword123!"},
        )
        responses.append(res.status_code)

    # At least some requests should succeed (e.g. 401 Unauthorized for bad creds)
    # and subsequent requests exceeding the limit must receive 429 Too Many Requests
    assert 401 in responses
    assert 429 in responses

    # Check 429 response structure
    rate_limited_response = next(
        res for res in [await client.post("/api/v1/auth/login", json={"email": "a@b.com", "password": "x"})]
    )
    if rate_limited_response.status_code == 429:
        data = rate_limited_response.json()
        assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"
        assert "Retry-After" in rate_limited_response.headers
