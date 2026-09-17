"""AtCoder adapter.

AtCoder has no official public API. This adapter uses the widely-used
kenkoooo AtCoder Problems API (configurable via ATCODER_API_URL) which
exposes accepted-problem counts per user, plus the public user rating page
scrape for rating. Fails gracefully when unavailable.
"""

from typing import Any

from app.config import settings
from app.integrations.base import AdapterError, CodingPlatformAdapter


class AtCoderAdapter(CodingPlatformAdapter):
    name = "atcoder"
    display_name = "AtCoder"

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        # Accepted count from kenkoooo API (user_submissions is heavy; use AC count endpoint)
        base = settings.ATCODER_API_URL.rstrip("/")
        url = f"{base}/user/ac_rank?user={username}"
        response = await self._request("GET", url)
        data = response.json()
        if not isinstance(data, dict):
            raise AdapterError("Unexpected AtCoder API response")
        return {"ac_count": data.get("count", 0), "ac_rank": data.get("rank")}

    async def _fetch_rating(self, username: str) -> dict[str, float]:
        result = {}
        try:
            resp = await self._request(
                "GET",
                f"https://atcoder.jp/users/{username}/history/json",
                headers={"Accept": "application/json"},
            )
            history = resp.json()
            rated = [h for h in history if h.get("IsRated")]
            if rated:
                result["rating"] = float(rated[-1]["NewRating"])
                result["max_rating"] = float(max(h["NewRating"] for h in rated))
        except Exception:
            pass
        return result

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        stats: dict[str, Any] = {
            "problems_solved": float(data.get("ac_count", 0) or 0),
            "rank": float(data.get("ac_rank", 0) or 0),
        }
        stats.update(await self._fetch_rating(data.get("_username", "")))
        return stats

    async def get_stats(self, username: str) -> dict[str, Any]:
        raw = await self.fetch_profile(username)
        raw["_username"] = username
        return await self.normalize(raw)

    def profile_url(self, username: str) -> str:
        return f"https://atcoder.jp/users/{username}"
