"""Coding platform adapter interface + shared HTTP behavior.

Each adapter must implement:
    fetch_profile(username) -> raw payload or raise AdapterError
    normalize(raw) -> dict of standardized statistics

Adapters handle their own timeouts, retries with exponential backoff and
429/5xx handling. Unsupported/unconfigured platforms raise
AdapterNotConfigured so callers can skip them gracefully.
"""

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class AdapterError(Exception):
    """Platform request failed after retries."""


class AdapterNotConfigured(Exception):
    """Platform has no usable public API / requires credentials not present."""


class CodingPlatformAdapter:
    name: str = "base"
    display_name: str = "Base"

    def __init__(
        self, timeout: int = 15, max_retries: int = 3, retry_delay: float = 2.0
    ):
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay

    async def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        delay = self.retry_delay
        last_exc: Exception | None = None
        headers = kwargs.pop("headers", None) or {}
        headers.setdefault("User-Agent", "LMS-Sync/1.0 (educational)")
        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout, follow_redirects=True
                ) as client:
                    response = await client.request(
                        method, url, headers=headers, **kwargs
                    )
                if response.status_code == 404:
                    raise AdapterError("Profile not found on platform")
                if response.status_code == 429 or response.status_code >= 500:
                    # Retry with exponential backoff
                    wait = delay * (2 ** (attempt - 1))
                    logger.warning(
                        "%s returned %s; retrying in %.1fs",
                        self.name,
                        response.status_code,
                        wait,
                    )
                    await asyncio.sleep(wait)
                    continue
                response.raise_for_status()
                return response
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc
                wait = delay * (2 ** (attempt - 1))
                logger.warning(
                    "%s network error (attempt %d): %s", self.name, attempt, exc
                )
                await asyncio.sleep(wait)
            except AdapterError:
                raise
            except Exception as exc:
                last_exc = exc
                await asyncio.sleep(delay)
        raise AdapterError(f"{self.name} request failed: {last_exc}")

    # ------------------------------------------------------------------ interface
    async def fetch_profile(self, username: str) -> dict[str, Any]:
        raise NotImplementedError

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    async def get_stats(self, username: str) -> dict[str, Any]:
        raw = await self.fetch_profile(username)
        return await self.normalize(raw)

    def profile_url(self, username: str) -> str:
        return ""
