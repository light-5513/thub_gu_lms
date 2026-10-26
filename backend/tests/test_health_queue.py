"""Readiness and background-job fallback contracts."""

import pytest
from pathlib import Path
from tempfile import TemporaryDirectory
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.api.v1 import health as health_routes
from app.database import redis as redis_module
from app.workers import worker


@pytest.mark.asyncio
async def test_readiness_uses_http_503_when_database_is_unavailable(monkeypatch):
    async def unavailable():
        return False

    monkeypatch.setattr(health_routes.mongo, "mongo_healthy", unavailable)
    monkeypatch.setattr(app.state, "frontend_dist", None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/ready")

    assert response.status_code == 503
    assert response.json() == {"ready": False}


@pytest.mark.asyncio
async def test_ready_database_and_optional_inline_jobs(monkeypatch):
    async def healthy():
        return True

    async def unavailable():
        return False

    monkeypatch.setattr(health_routes.mongo, "mongo_healthy", healthy)
    monkeypatch.setattr(app.state, "frontend_dist", None)
    monkeypatch.setattr(health_routes, "redis_healthy", unavailable)
    monkeypatch.setattr(health_routes, "worker_healthy", unavailable)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ready = await client.get("/api/ready")
        health = await client.get("/api/health")

    assert ready.status_code == 200
    assert ready.json() == {"ready": True}
    assert health.status_code == 200
    assert health.json()["database"] == "healthy"
    assert health.json()["redis"] == "unavailable"
    assert health.json()["worker"] == "inline"


@pytest.mark.asyncio
async def test_readiness_rejects_missing_mounted_spa_asset(monkeypatch):
    async def healthy():
        return True

    with TemporaryDirectory(dir=Path(__file__).parent) as temp_dir:
        dist = Path(temp_dir)
        (dist / "index.html").write_text(
            '<script src="/assets/app.js"></script>', encoding="utf-8"
        )
        monkeypatch.setattr(health_routes.mongo, "mongo_healthy", healthy)
        monkeypatch.setattr(app.state, "frontend_dist", dist)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            missing = await client.get("/api/ready")
            (dist / "assets").mkdir()
            (dist / "assets" / "app.js").write_text("// built", encoding="utf-8")
            complete = await client.get("/api/ready")

    assert missing.status_code == 503
    assert missing.json() == {"ready": False}
    assert complete.status_code == 200
    assert complete.json() == {"ready": True}


@pytest.mark.asyncio
async def test_job_falls_back_inline_without_live_worker(monkeypatch):
    async def no_worker():
        return False

    monkeypatch.setattr(redis_module, "get_redis", lambda: object())
    monkeypatch.setattr(redis_module, "worker_healthy", no_worker)

    assert await redis_module.enqueue_job("send_email_task", kind="notification") is False


@pytest.mark.asyncio
async def test_worker_heartbeat_uses_arq_context_pool():
    writes = []

    class Pool:
        async def set(self, key, value, **kwargs):
            writes.append(("set", key, kwargs))

        async def sadd(self, key, value):
            writes.append(("sadd", key, value))

    await worker.heartbeat({"worker_id": "worker-test", "redis": Pool()})

    assert writes[0] == ("set", "worker:heartbeat", {"ex": 60})
    assert writes[1] == ("sadd", "workers", "worker-test")
