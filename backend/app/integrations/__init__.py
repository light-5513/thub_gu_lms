"""Adapter registry."""

from typing import Dict, Optional

from app.config import settings
from app.integrations.atcoder import AtCoderAdapter
from app.integrations.base import CodingPlatformAdapter
from app.integrations.codechef import CodeChefAdapter
from app.integrations.codeforces import CodeforcesAdapter
from app.integrations.geeksforgeeks import GeeksForGeeksAdapter
from app.integrations.github import GitHubAdapter
from app.integrations.leetcode import LeetCodeAdapter
from app.integrations.unsupported import HackerEarthAdapter, HackerRankAdapter

_REGISTRY = {
    "leetcode": LeetCodeAdapter,
    "codechef": CodeChefAdapter,
    "codeforces": CodeforcesAdapter,
    "atcoder": AtCoderAdapter,
    "github": GitHubAdapter,
    "hackerrank": HackerRankAdapter,
    "hackerearth": HackerEarthAdapter,
    "geeksforgeeks": GeeksForGeeksAdapter,
}


def get_adapter(
    platform: str, sync_settings: dict | None = None
) -> CodingPlatformAdapter:
    cls = _REGISTRY.get(platform)
    if not cls:
        raise KeyError(f"Unknown platform '{platform}'")
    cfg = sync_settings or {}
    return cls(
        timeout=int(cfg.get("timeout_seconds", 15)),
        max_retries=int(cfg.get("max_retries", 3)),
        retry_delay=float(cfg.get("retry_delay_seconds", 2)),
    )


def available_platforms():
    return sorted(_REGISTRY.keys())
