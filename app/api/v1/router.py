from fastapi import APIRouter
from app.core.config import settings
from app.api.v1.auth import router as auth_router
from app.api.v1.centres import router as centres_router
from app.api.v1.tests import router as tests_router

api_router = APIRouter()

# Include Sub-routers
api_router.include_router(auth_router)
api_router.include_router(centres_router)
api_router.include_router(tests_router)


@api_router.get("/health", tags=["System"])
async def health_check():
    """
    Health check endpoint returning system status and configuration environment.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "1.0.0",
    }
