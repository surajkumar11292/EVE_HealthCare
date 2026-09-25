from fastapi import APIRouter
from app.core.config import settings

api_router = APIRouter()


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
