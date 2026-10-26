"""GitHub adapter via the official REST API.

Auth: optional GITHUB_API_TOKEN raises rate limits from 60/hr to 5000/hr.
"""

from datetime import datetime
from datetime import timedelta, timezone
from typing import Any

from app.config import settings
from app.integrations.activity_time import today_in_timezone
from app.integrations.base import AdapterError, CodingPlatformAdapter


class GitHubAdapter(CodingPlatformAdapter):
    name = "github"
    display_name = "GitHub"

    def _headers(self) -> dict:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.GITHUB_API_TOKEN and not getattr(
            self, "_github_token_rejected", False
        ):
            headers["Authorization"] = f"Bearer {settings.GITHUB_API_TOKEN}"
        return headers

    async def _github_request(self, method: str, url: str, **kwargs):
        headers = dict(kwargs.pop("headers", None) or self._headers())
        try:
            return await self._request(method, url, headers=headers, **kwargs)
        except AdapterError as exc:
            if (
                "HTTP 401" not in str(exc)
                or "Authorization" not in headers
            ):
                raise
            # Public profiles and public events are readable without a token.
            # A stale optional token must not make those requests fail.
            self._github_token_rejected = True
            headers.pop("Authorization", None)
            return await self._request(method, url, headers=headers, **kwargs)

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        url = f"https://api.github.com/users/{username}"
        response = await self._github_request("GET", url)
        return response.json()

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        if "message" in data and data.get("message") == "Not Found":
            raise AdapterError("GitHub profile not found")
        result = {
            "public_repos": float(data.get("public_repos", 0) or 0),
            "followers": float(data.get("followers", 0) or 0),
            "following": float(data.get("following", 0) or 0),
            "public_gists": float(data.get("public_gists", 0) or 0),
        }
        # Events expose recent public activity, not the full private contribution
        # graph. Keep the underlying event types visible in both totals and chart.
        daily: dict[str, dict[str, int]] = {}
        records = []
        events_available = False
        try:
            events_url = data.get("events_url").replace("{/privacy}", "")
            for page in range(1, 4):
                resp = await self._github_request(
                    "GET",
                    events_url,
                    params={"per_page": 100, "page": page},
                )
                events = resp.json()
                if not isinstance(events, list) or not events:
                    events_available = isinstance(events, list)
                    break
                events_available = True
                records.extend(events)
                if len(events) < 100:
                    break
        except Exception:
            records = []
            events_available = False

        for event in records:
            event_type = event.get("type")
            created_at = event.get("created_at")
            if not created_at:
                continue
            try:
                created = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                day = created.astimezone(self.activity_tz).date().isoformat()
            except (TypeError, ValueError):
                continue
            metrics = daily.setdefault(
                day,
                {
                    "commits": 0,
                    "pushes": 0,
                    "pull_requests": 0,
                    "repository_creations": 0,
                    "public_events": 0,
                },
            )
            metrics["public_events"] += 1
            if event_type == "PushEvent":
                metrics["pushes"] += 1
                metrics["commits"] += len((event.get("payload") or {}).get("commits") or [])
            elif event_type == "PullRequestEvent":
                metrics["pull_requests"] += 1
            elif event_type == "CreateEvent":
                metrics["repository_creations"] += 1

        result["commits"] = float(sum(day["commits"] for day in daily.values()))
        result["pushes"] = float(sum(day["pushes"] for day in daily.values()))
        result["pull_requests"] = float(sum(day["pull_requests"] for day in daily.values()))
        result["repository_creations"] = float(
            sum(day["repository_creations"] for day in daily.values())
        )
        result["public_activity_events"] = float(
            sum(day["public_events"] for day in daily.values())
        )
        result["contributions"] = (
            result["commits"] + result["pull_requests"] + result["repository_creations"]
        )
        today = today_in_timezone(self.activity_timezone)
        daily_activity = [
            {"date": day, "metrics": metrics} for day, metrics in sorted(daily.items())
        ]
        observed_start = min(daily, default=None)
        ninety_day_start = (today - timedelta(days=89)).isoformat()
        coverage_start = observed_start if len(records) >= 300 else ninety_day_start
        result["_daily_activity"] = daily_activity
        result["_activity_metadata"] = {
            "available": events_available,
            "metric_key": "commits",
            "metric_label": "Public commits",
            "note": "GitHub's public events API returns recent public activity only (up to 300 events). This is not the full contribution graph.",
            "coverage_start": coverage_start if events_available else None,
            "coverage_end": today.isoformat() if events_available else None,
            "records_returned": len(records),
            "record_limit": 300,
            "possibly_truncated": len(records) >= 300,
        }
        created = data.get("created_at")
        if created:
            try:
                years = max(
                    (
                        datetime.utcnow()
                        - datetime.strptime(created, "%Y-%m-%dT%H:%M:%SZ")
                    ).days
                    / 365.25,
                    0.5,
                )
                result["repos_per_year"] = round(result["public_repos"] / years, 2)
            except Exception:
                pass
        return result

    def profile_url(self, username: str) -> str:
        return f"https://github.com/{username}"
