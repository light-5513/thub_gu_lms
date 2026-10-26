"""Health and readiness endpoints. Never exposes credentials."""

from fastapi import APIRouter, Request, Response, status

from app.config import settings
from app.core.frontend import frontend_build_ready
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
        "redis": "healthy" if redis_ok else "unavailable",
        "worker": "healthy" if worker_ok else "inline",
        "environment": settings.APP_ENV,
        "version": "1.0.0",
    }


@router.get("/ready")
async def ready(request: Request, response: Response):
    db_ok = await mongo.mongo_healthy()
    dist = getattr(request.app.state, "frontend_dist", None)
    frontend_ok = dist is None or frontend_build_ready(dist)
    if not db_ok or not frontend_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"ready": bool(db_ok and frontend_ok)}
