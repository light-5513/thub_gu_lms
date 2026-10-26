"""Simple rate limiting for sensitive endpoints (login, password reset).

Uses Redis when available; falls back to an in-process sliding window so the
API still protects itself in single-node development without Redis.
"""

import time
from collections import defaultdict, deque

from app.database.redis import get_redis

_memory: dict[str, deque] = defaultdict(deque)


async def is_rate_limited(
    key: str, limit: int, window_seconds: int
) -> tuple[bool, int]:
    """Return (limited, retry_after_seconds)."""
    redis = get_redis()
    now = int(time.time())
    window_start = now - window_seconds

    if redis is not None:
        try:
            redis_key = f"rl:{key}"
            async with redis.pipeline(transaction=True) as pipe:
                pipe.zremrangebyscore(redis_key, 0, window_start)
                pipe.zcard(redis_key)
                pipe.zadd(redis_key, {f"{now}-{time.time_ns()}": now})
                pipe.expire(redis_key, window_seconds)
                results = await pipe.execute()
            count = int(results[1])
            if count >= limit:
                ttl = await redis.ttl(redis_key)
                return True, max(ttl, 1)
            return False, 0
        except Exception:
            pass  # fall back to memory

    dq = _memory[key]
    while dq and dq[0] < window_start:
        dq.popleft()
    if len(dq) >= limit:
        retry_after = int(dq[0] + window_seconds - now) + 1
        return True, retry_after
    dq.append(now)
    return False, 0


def client_ip(request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def reset_key(request, scope: str, identifier: str | None = None) -> str:
    ident = identifier or client_ip(request)
    return f"{scope}:{ident}"
