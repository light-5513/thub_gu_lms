"""GeeksForGeeks adapter using the JSON endpoint used by public profiles.

GeeksforGeeks does not document this endpoint as a public developer API, so it
may change without notice. It only reads public profile fields and requires no
account credentials.
"""

from typing import Any

from app.config import settings
from app.integrations.base import AdapterError, CodingPlatformAdapter


class GeeksForGeeksAdapter(CodingPlatformAdapter):
    name = "geeksforgeeks"
    display_name = "GeeksForGeeks"
    PROFILE_ENDPOINT = "api-get/user-profile-info/"

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        handle = username.strip()
        if not handle:
            raise AdapterError("GeeksforGeeks username is required")

        base_url = settings.GEEKSFORGEEKS_API_URL.rstrip("/")
        url = f"{base_url}/{self.PROFILE_ENDPOINT}"
        try:
            response = await self._request(
                "GET",
                url,
                params={
                    "handle": handle,
                    "article_count": "false",
                    "redirect": "true",
                },
                headers={
                    "Accept": "application/json",
                    "Referer": "https://www.geeksforgeeks.org/",
                },
            )
        except AdapterError as exc:
            # GfG responds with HTTP 400 for unknown handles.
            if "HTTP 400" in str(exc):
                raise AdapterError("GeeksforGeeks profile not found") from exc
            raise

        try:
            payload = response.json()
        except ValueError as exc:
            raise AdapterError("GeeksforGeeks returned invalid profile data") from exc

        profile = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(profile, dict) or not any(
            key in profile for key in ("total_problems_solved", "score")
        ):
            message = payload.get("message") if isinstance(payload, dict) else None
            raise AdapterError(message or "GeeksforGeeks profile not found")
        return profile

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise AdapterError("GeeksforGeeks returned invalid profile data")

        def number(value: Any) -> float:
            try:
                return float(value or 0)
            except (TypeError, ValueError):
                return 0.0

        stats = {
            "problems_solved": number(data.get("total_problems_solved")),
            "score": number(data.get("score")),
            "monthly_score": number(data.get("monthly_score")),
            "current_streak": number(data.get("pod_solved_current_streak")),
            "longest_streak": number(data.get("pod_solved_longest_streak")),
            "articles_published": number(data.get("total_articles_published")),
            "_daily_activity": [],
            "_activity_metadata": {
                "available": False,
                "metric_key": None,
                "metric_label": None,
                "snapshot_delta_key": "problems_solved",
                "fill_gaps": False,
                "note": "The public GeeksforGeeks profile endpoint gives current totals and streaks, but does not expose dated accepted-problem history.",
            },
        }
        if not any(key in data for key in ("total_problems_solved", "score")):
            raise AdapterError("GeeksforGeeks profile statistics are missing")
        return stats

    def profile_url(self, username: str) -> str:
        return f"https://www.geeksforgeeks.org/profile/{username}"
