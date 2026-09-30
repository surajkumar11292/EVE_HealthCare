from typing import Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.logging import logger


def get_client_identifier(request: Request) -> str:
    """
    Extracts client IP address considering proxy headers (X-Forwarded-For, X-Real-IP)
    with fallback to socket remote address.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # First IP in comma-separated list is the client origin
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    return get_remote_address(request) or "127.0.0.1"


# Initialize SlowAPI Limiter with Redis storage and in-memory fallback for high availability
limiter = Limiter(
    key_func=get_client_identifier,
    storage_uri=settings.REDIS_URL,
    in_memory_fallback_enabled=True,
    headers_enabled=False,
    swallow_errors=True,
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom 429 Too Many Requests handler with structured JSON response and request tracing.
    """
    request_id = request.headers.get("X-Request-ID", "unknown")
    client_ip = get_client_identifier(request)

    logger.warning(
        "rate_limit_exceeded",
        client_ip=client_ip,
        path=request.url.path,
        method=request.method,
        detail=str(exc.detail),
    )

    retry_after = "60"
    headers = {
        "X-Request-ID": request_id,
        "Retry-After": retry_after,
    }

    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please slow down and try again later.",
                "detail": str(exc.detail),
                "retry_after_seconds": 60,
                "request_id": request_id,
            }
        },
        headers=headers,
    )
