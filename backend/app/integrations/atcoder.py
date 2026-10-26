"""AtCoder adapter.

AtCoder has no official public API. This adapter uses the widely-used
kenkoooo AtCoder Problems API (configurable via ATCODER_API_URL) which
exposes accepted-problem counts per user, plus the public user rating page
scrape for rating. Fails gracefully when unavailable.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import settings
from app.integrations.activity_time import activity_date, today_in_timezone
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
        cutoff = int((datetime.now(timezone.utc) - timedelta(days=365)).timestamp())
        history = []
        history_limited = False
        history_available = False
        try:
            history_response = await self._request(
                "GET",
                f"{base}/user/submissions",
                params={"user": username, "from_second": cutoff},
            )
            history = history_response.json()
            if not isinstance(history, list):
                history = []
            history_available = True
            history_limited = len(history) >= 500
        except Exception:
            # Preserve profile totals if the optional history endpoint is down.
            history = []
        rating_history = await self._fetch_rating_history(username)
        return {
            "ac_count": data.get("count", 0),
            "ac_rank": data.get("rank"),
            "submission_history": history,
            "history_limited": history_limited,
            "history_available": history_available,
            "history_cutoff": datetime.fromtimestamp(cutoff, timezone.utc)
            .astimezone(self.activity_tz)
            .date()
            .isoformat(),
            "rating_history": rating_history,
        }

    async def _fetch_rating_history(self, username: str) -> list[dict[str, Any]]:
        try:
            resp = await self._request(
                "GET",
                f"https://atcoder.jp/users/{username}/history/json",
                headers={"Accept": "application/json"},
            )
            history = resp.json()
            return history if isinstance(history, list) else []
        except Exception:
            pass
        return []

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        stats: dict[str, Any] = {
            "problems_solved": float(data.get("ac_count", 0) or 0),
            "rank": float(data.get("ac_rank", 0) or 0),
        }
        ratings = data.get("rating_history") or []
        rated = [entry for entry in ratings if entry.get("IsRated")]
        if rated:
            stats["rating"] = float(rated[-1].get("NewRating", 0) or 0)
            stats["max_rating"] = float(
                max((entry.get("NewRating", 0) or 0) for entry in rated)
            )
        stats["contests"] = float(len(rated))
        stats["contest_history_entries"] = float(len(ratings))
        submissions = data.get("submission_history") or []
        daily: dict[str, dict[str, int]] = {}
        solved_problems: set[str] = set()
        for submission in sorted(submissions, key=lambda item: item.get("epoch_second", 0)):
            timestamp = submission.get("epoch_second")
            if not timestamp:
                continue
            day = activity_date(int(timestamp), self.activity_timezone).isoformat()
            result = str(submission.get("result") or "")
            metrics = daily.setdefault(
                day, {"submissions": 0, "accepted_submissions": 0, "problems_solved": 0}
            )
            metrics["submissions"] += 1
            if result == "AC":
                metrics["accepted_submissions"] += 1
                problem_id = str(submission.get("problem_id") or "")
                if problem_id and problem_id not in solved_problems:
                    solved_problems.add(problem_id)
                    metrics["problems_solved"] += 1
        stats["submissions"] = float(sum(day["submissions"] for day in daily.values()))
        stats["accepted_submissions"] = float(
            sum(day["accepted_submissions"] for day in daily.values())
        )
        daily_activity = [
            {"date": day, "metrics": metrics} for day, metrics in sorted(daily.items())
        ]
        stats["_daily_activity"] = daily_activity
        stats["_activity_metadata"] = {
            "available": bool(data.get("history_available")),
            "metric_key": "problems_solved",
            "metric_label": "Unique accepted problems",
            "note": "Daily history covers the last year and is limited to 500 submissions by the AtCoder Problems API.",
            "coverage_start": (
                min(daily, default=None)
                if data.get("history_limited")
                else data.get("history_cutoff")
            ),
            "coverage_end": today_in_timezone(self.activity_timezone).isoformat(),
            "record_limit": 500,
            "possibly_truncated": bool(data.get("history_limited")),
        }
        return stats

    async def get_stats(self, username: str) -> dict[str, Any]:
        raw = await self.fetch_profile(username)
        raw["_username"] = username
        return await self.normalize(raw)

    def profile_url(self, username: str) -> str:
        return f"https://atcoder.jp/users/{username}"
