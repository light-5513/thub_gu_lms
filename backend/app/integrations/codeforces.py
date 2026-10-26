"""Codeforces adapter via the official public API.

Endpoint: https://codeforces.com/api/user.info  (configurable CODEFORCES_API_URL)
Official, unauthenticated, rate limited to ~1 req/sec per IP.
"""

import asyncio
import time
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.integrations.activity_time import activity_date, today_in_timezone
from app.integrations.base import AdapterError, CodingPlatformAdapter


class CodeforcesAdapter(CodingPlatformAdapter):
    name = "codeforces"
    display_name = "Codeforces"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._request_lock = asyncio.Lock()
        self._last_request_at = 0.0

    async def _request(self, method: str, url: str, **kwargs):
        # Codeforces asks clients to keep API traffic modest. Serialize requests
        # across all handles handled by this adapter instance.
        async with self._request_lock:
            wait = 2.0 - (time.monotonic() - self._last_request_at)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request_at = time.monotonic()
            return await super()._request(method, url, **kwargs)

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
            "registration_year": float(data.get("registrationTimeSeconds", 0) or 0),
        }
        if result["registration_year"]:
            result["registration_year"] = float(
                datetime.fromtimestamp(
                    result["registration_year"], timezone.utc
                ).year
            )
        rank = data.get("rank")
        if rank:
            result["rank_name"] = rank

        base_url = settings.CODEFORCES_API_URL.rstrip("/")
        status_response = await self._request(
            "GET",
            f"{base_url}/user.status",
            params={"handle": data.get("handle"), "from": "1", "count": "10000"},
        )
        status_payload = status_response.json()
        if status_payload.get("status") != "OK":
            raise AdapterError(status_payload.get("comment", "Codeforces submissions unavailable"))
        submissions = status_payload.get("result") or []
        unique_solved: set[str] = set()
        days: dict[str, dict[str, int]] = {}
        ordered_submissions = sorted(
            submissions, key=lambda row: row.get("creationTimeSeconds", 0)
        )
        for submission in ordered_submissions:
            problem = submission.get("problem") or {}
            problem_id = f"{problem.get('contestId')}:{problem.get('index')}"
            verdict = submission.get("verdict")
            timestamp = submission.get("creationTimeSeconds")
            if timestamp:
                day = activity_date(int(timestamp), self.activity_timezone).isoformat()
                daily = days.setdefault(
                    day,
                    {"submissions": 0, "accepted_submissions": 0, "problems_solved": 0},
                )
                daily["submissions"] += 1
                if verdict == "OK":
                    daily["accepted_submissions"] += 1
                    if problem_id not in unique_solved:
                        daily["problems_solved"] += 1
            if verdict == "OK":
                unique_solved.add(problem_id)

        result["problems_solved"] = float(len(unique_solved))
        result["submissions"] = float(len(submissions))
        accepted = sum(day["accepted_submissions"] for day in days.values())
        result["accepted_submissions"] = float(accepted)
        result["acceptance_rate"] = round(accepted / len(submissions) * 100, 2) if submissions else 0.0

        contest_count = None
        try:
            rating_response = await self._request(
                "GET", f"{base_url}/user.rating", params={"handle": data.get("handle")}
            )
            rating_payload = rating_response.json()
            if rating_payload.get("status") == "OK":
                history = rating_payload.get("result") or []
                contest_count = len(history)
                result["max_contest_rank"] = float(
                    min((h.get("rank", 0) for h in history if h.get("rank")), default=0)
                )
            elif "not participated" in str(rating_payload.get("comment", "")).lower():
                contest_count = 0
        except Exception:
            # The profile and submission history remain useful if contest history
            # is unavailable (for example, a user has never joined a rated round).
            pass
        if contest_count is not None:
            result["contests"] = float(contest_count)

        daily_activity = [
            {"date": day, "metrics": metrics} for day, metrics in sorted(days.items())
        ]
        coverage_start = min(days, default=None)
        registration_time = data.get("registrationTimeSeconds")
        if coverage_start is None and registration_time:
            coverage_start = activity_date(
                int(registration_time), self.activity_timezone
            ).isoformat()
        result["_daily_activity"] = daily_activity
        result["_activity_metadata"] = {
            "available": True,
            "metric_key": "problems_solved",
            "metric_label": "Unique accepted problems",
            "note": "Daily history is built from up to the latest 10,000 submissions returned by Codeforces.",
            "coverage_start": coverage_start,
            "coverage_end": today_in_timezone(self.activity_timezone).isoformat(),
            "records_returned": len(submissions),
            "record_limit": 10000,
            "possibly_truncated": len(submissions) >= 10000,
        }
        return result

    def profile_url(self, username: str) -> str:
        return f"https://codeforces.com/profile/{username}"
