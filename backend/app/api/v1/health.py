"""Health and readiness endpoints. Never exposes credentials."""

from fastapi import APIRouter

from app.config import settings
from app.database import mongo
from app.database.redis import redis_healthy, worker_healthy

router = APIRouter()


@router.get("/health")
async def health():
    db_ok = await mongo.mongo_healthy()
    redis_ok = await redis_healthy()
    worker_ok = await worker_healthy()
    return {
        "api": "healthy",
        "database": "healthy" if db_ok else "unhealthy",
        "redis": "healthy" if redis_ok else "unhealthy",
        "worker": "healthy" if worker_ok else ("unhealthy" if redis_ok else "unknown"),
        "environment": settings.APP_ENV,
        "version": "1.0.0",
    }


@router.get("/ready")
async def ready():
    db_ok = await mongo.mongo_healthy()
    return {"ready": bool(db_ok)}
