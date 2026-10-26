"""Main FastAPI application."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging
from app.database import mongo
from app.database.redis import close_redis, connect_to_redis


def _resolve_frontend_dist() -> Path | None:
    """Locate the built frontend. Honour FRONTEND_DIST_DIR if set, else look
    for a sibling `../frontend/dist` (monolith mode). Returns None if absent."""
    if settings.FRONTEND_DIST_DIR:
        p = Path(settings.FRONTEND_DIST_DIR).expanduser().resolve()
        return p if p.is_dir() else None
    # app/main.py -> app -> repo_root -> frontend/dist
    candidate = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    return candidate if candidate.is_dir() else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    db_ok = await mongo.connect_to_mongo()
    if db_ok:
        await mongo.ensure_indexes(mongo.get_db())
    redis_ok = False
    try:
        redis_ok = await connect_to_redis()
        if redis_ok:
            from urllib.parse import urlparse

            from arq.connections import RedisSettings, create_pool

            parsed = urlparse(settings.REDIS_URL)
            pool = await create_pool(
                RedisSettings(
                    host=parsed.hostname or "localhost",
                    port=parsed.port or 6379,
                    database=int((parsed.path or "/0").lstrip("/") or 0),
                )
            )
            # Replace plain client with ArqRedis pool so enqueue works.
            import app.database.redis as redis_module

            await redis_module._redis.close() if redis_module.get_redis() else None
            redis_module._redis = pool
    except Exception:
        pass
    app.state.db_ready = db_ok
    app.state.db = mongo.get_db() if db_ok else None
    yield
    await mongo.close_mongo()
    await close_redis()


app = FastAPI(
    title=f"{settings.APP_NAME} API",
    version="1.0.0",
    docs_url="/api/docs" if settings.is_dev else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.is_dev else None,
    lifespan=lifespan,
)

# CORS (credentials for cookie auth)
cors_kwargs = {
    "allow_origins": settings.cors_origins,
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
}
if settings.is_dev:
    # Allow any local network IP for development
    cors_kwargs["allow_origin_regex"] = (
        r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$"
    )

app.add_middleware(CORSMiddleware, **cors_kwargs)


@app.middleware("http")
async def security_headers(request, call_next):
    from app.middleware.request_context import RequestContextMiddlewareLogic

    return await RequestContextMiddlewareLogic()(request, call_next)


register_exception_handlers(app)

app.include_router(api_router, prefix="/api")

# --- Serve built frontend as static files (monolith mode) -------------------
# When frontend/dist exists, mount it so a single uvicorn process serves
# both the API and the SPA. SPA client-side routes are served index.html.
_FRONTEND_DIST = _resolve_frontend_dist()
if _FRONTEND_DIST is not None:
    app.mount(
        "/assets",
        StaticFiles(directory=str(_FRONTEND_DIST / "assets")),
        name="frontend-assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # Never shadow API routes (those are matched first by FastAPI).
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        # Serve real static files (favicon, manifest, etc.) if present.
        candidate = (_FRONTEND_DIST / full_path).resolve()
        try:
            candidate.relative_to(_FRONTEND_DIST)  # block path traversal
            if candidate.is_file():
                return FileResponse(str(candidate))
        except ValueError:
            pass
        # Otherwise fall back to index.html (SPA client-side routing).
        index = _FRONTEND_DIST / "index.html"
        if index.is_file():
            return FileResponse(str(index), media_type="text/html")
        return JSONResponse({"detail": "Frontend not built"}, status_code=500)


@app.get("/", include_in_schema=False)
async def root():
    """In monolith mode serve the SPA index; otherwise return API info."""
    if _FRONTEND_DIST is not None and (_FRONTEND_DIST / "index.html").is_file():
        return FileResponse(str(_FRONTEND_DIST / "index.html"), media_type="text/html")
    return {"name": settings.APP_NAME, "status": "running", "docs": "/api/docs"}
