"""Redis connection management (optional at runtime; required for workers)."""

import logging

from redis.asyncio import Redis

from app.config import settings

logger = logging.getLogger(__name__)

_redis: Redis | None = None


def get_redis() -> Redis | None:
    return _redis


async def connect_to_redis() -> bool:
    global _redis
    try:
        client = Redis.from_url(
            settings.REDIS_URL, socket_timeout=2, socket_connect_timeout=2
        )
        await client.ping()
        _redis = client
        logger.info("Connected to Redis")
        return True
    except Exception as exc:
        logger.warning("Redis unavailable (background jobs degraded): %s", exc)
        _redis = None
        return False


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.close()
    _redis = None


async def redis_healthy() -> bool:
    if _redis is None:
        return False
    try:
        await _redis.ping()
        return True
    except Exception:
        return False


async def enqueue_job(task_name: str, *args, **kwargs) -> bool:
    """Enqueue an ARQ job. Returns False if Redis/worker unavailable.

    When no worker is available the caller is expected to execute the task
    inline so that core flows (e.g. invitation emails in dev) still work.
    """
    redis = get_redis()
    if redis is None:
        return False
    try:
        from arq.connections import ArqRedis

        if isinstance(redis, ArqRedis):
            await redis.enqueue_job(task_name, *args, **kwargs)
            return True
        # Plain redis client cannot enqueue; treat as unavailable.
        return False
    except Exception as exc:
        logger.warning("Failed to enqueue job %s: %s", task_name, exc)
        return False


async def set_worker_heartbeat(worker_id: str) -> None:
    redis = get_redis()
    if redis is None:
        return
    import time

    await redis.set("worker:heartbeat", str(time.time()), ex=60)
    await redis.sadd("workers", worker_id)


async def worker_healthy() -> bool:
    redis = get_redis()
    if redis is None:
        return False
    try:
        value = await redis.get("worker:heartbeat")
        return value is not None
    except Exception:
        return False
