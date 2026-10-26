"""Codeforces adapter via the official public API.

Endpoint: https://codeforces.com/api/user.info  (configurable CODEFORCES_API_URL)
Official, unauthenticated, rate limited to ~1 req/sec per IP.
"""

from typing import Any

from app.config import settings
from app.integrations.base import AdapterError, CodingPlatformAdapter


class CodeforcesAdapter(CodingPlatformAdapter):
    name = "codeforces"
    display_name = "Codeforces"

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        url = f"{settings.CODEFORCES_API_URL.rstrip('/')}/user.info"
        response = await self._request(
            "GET", url, params={"handles": username, "checkHistoricHandles": "false"}
        )
        payload = response.json()
        if payload.get("status") != "OK":
            raise AdapterError(payload.get("comment", "Codeforces API error"))
        users = payload.get("result") or []
        if not users:
            raise AdapterError("Codeforces profile not found")
        return users[0]

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        # Official API provides rating/rank/maxRating; problems_solved needs user.status.
        result = {
            "rating": float(data.get("rating", 0) or 0),
            "max_rating": float(data.get("maxRating", 0) or 0),
            "rank_name": None,
            "contribution": float(data.get("contribution", 0) or 0),
            "friend_count": float(data.get("friendOfCount", 0) or 0),
        }
        rank = data.get("rank")
        if rank:
            result["rank_name"] = rank
        try:
            status_url = f"{settings.CODEFORCES_API_URL.rstrip('/')}/user.status"
            resp = await self._request(
                "GET",
                status_url,
                params={"handle": data.get("handle"), "from": "1", "count": "10000"},
            )
            subs = resp.json().get("result") or []
            unique = set()
            for s in subs:
                p = s.get("problem") or {}
                key = f"{p.get('contestId')}:{p.get('index')}"
                if s.get("verdict") == "OK":
                    unique.add(key)
            result["problems_solved"] = float(len(unique))
        except Exception:
            result["problems_solved"] = 0.0
        return result

    def profile_url(self, username: str) -> str:
        return f"https://codeforces.com/profile/{username}"
