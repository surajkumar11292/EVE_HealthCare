import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi_pagination import add_pagination
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import structlog

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.api.v1.router import api_router
from app.db.session import engine
from app.db.base import Base
import app.models  # Register all models with Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info(
        "app_startup",
        app_name=settings.APP_NAME,
        env=settings.APP_ENV,
        debug=settings.DEBUG,
    )
    # Ensure database tables exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("database_tables_verified")
    except Exception as exc:
        logger.error("database_connection_failed_on_startup", error=str(exc))

    yield
    # Shutdown
    await engine.dispose()
    logger.info("app_shutdown", app_name=settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend service for diagnostic test bookings and simulated payments.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# Attach SlowAPI Limiter state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Structured Request Logging Middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        client_ip=request.client.host if request.client else "unknown",
    )

    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id

        logger.info(
            "request_finished",
            status_code=response.status_code,
            duration_ms=process_time_ms,
        )
        return response
    except Exception as exc:
        process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(
            "request_unhandled_exception",
            error=str(exc),
            duration_ms=process_time_ms,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected internal server error occurred.",
                    "request_id": request_id,
                }
            },
            headers={"X-Request-ID": request_id},
        )


from fastapi.encoders import jsonable_encoder


# Global Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = request.headers.get("X-Request-ID", "unknown")
    logger.warning("validation_error", errors=exc.errors())
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters.",
                "details": jsonable_encoder(exc.errors()),
            }
        },
        headers={"X-Request-ID": request_id},
    )


from app.api.v1.payments import router as payments_router


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Welcome to EVE Healthcare Backend API",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "health_check": "/health",
        "api_v1_prefix": settings.API_V1_PREFIX,
    }


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "1.0.0",
    }


# Include API V1 Router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Also mount payments_router directly at root for direct assignment spec compatibility
# (POST /payments/ and POST /payments/webhook/)
app.include_router(payments_router)

# Enable Pagination
add_pagination(app)
