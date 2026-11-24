"""GitHub adapter via the official REST and GraphQL APIs.

Auth: optional GITHUB_API_TOKEN raises rate limits from 60/hr to 5000/hr and
enables the contribution calendar, which GitHub serves only through GraphQL.
Without a usable token the adapter counts pushes from the public events feed.
"""

import logging
from datetime import datetime
from datetime import timedelta, timezone
from typing import Any

from app.config import settings
from app.integrations.activity_time import today_in_timezone
from app.integrations.base import AdapterError, CodingPlatformAdapter

logger = logging.getLogger(__name__)


class GitHubAdapter(CodingPlatformAdapter):
    name = "github"
    display_name = "GitHub"

    GRAPHQL_URL = "https://api.github.com/graphql"
    CONTRIBUTIONS_QUERY = """
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalRepositoryContributions
          restrictedContributionsCount
          contributionCalendar {
            totalContributions
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
    """

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
        contributions = await self._fetch_contributions(data.get("login") or "")
        if contributions is not None:
            self._apply_contribution_calendar(result, contributions)
        else:
            await self._apply_public_feed(result, data)
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

    async def _fetch_contributions(self, login: str) -> dict[str, Any] | None:
        """Return the contribution calendar, or None when no usable token is set."""
        if not login or "Authorization" not in self._headers():
            return None
        try:
            response = await self._request(
                "POST",
                self.GRAPHQL_URL,
                json={"query": self.CONTRIBUTIONS_QUERY, "variables": {"login": login}},
                headers=self._headers(),
            )
            payload = response.json()
        except AdapterError as exc:
            if "HTTP 401" in str(exc):
                # GraphQL has no anonymous access; use the public feed from now on.
                self._github_token_rejected = True
            logger.warning("GitHub contribution calendar unavailable: %s", exc)
            return None
        if not isinstance(payload, dict) or payload.get("errors"):
            errors = payload.get("errors") if isinstance(payload, dict) else None
            message = (errors or [{}])[0].get("message") or "unexpected response"
            logger.warning("GitHub contribution calendar query failed: %s", message)
            return None
        user = (payload.get("data") or {}).get("user") or {}
        collection = user.get("contributionsCollection")
        return collection if isinstance(collection, dict) else None

    def _apply_contribution_calendar(
        self, result: dict[str, Any], collection: dict[str, Any]
    ) -> None:
        calendar = collection.get("contributionCalendar") or {}
        days = sorted(
            (
                day
                for week in calendar.get("weeks") or []
                for day in week.get("contributionDays") or []
                if day.get("date")
            ),
            key=lambda day: day["date"],
        )

        def total(key: str) -> float:
            return float(collection.get(key) or 0)

        result["contributions"] = float(calendar.get("totalContributions") or 0)
        result["commits"] = total("totalCommitContributions")
        result["pull_requests"] = total("totalPullRequestContributions")
        result["issues"] = total("totalIssueContributions")
        result["reviews"] = total("totalPullRequestReviewContributions")
        result["repository_creations"] = total("totalRepositoryContributions")
        result["private_contributions"] = total("restrictedContributionsCount")
        result["_daily_activity"] = [
            {"date": day["date"], "metrics": {"contributions": int(day["contributionCount"])}}
            for day in days
            if day.get("contributionCount")
        ]
        result["_activity_metadata"] = {
            "available": bool(days),
            "metric_key": "contributions",
            "metric_label": "Contributions",
            "note": "GitHub's contribution calendar for the last year: the count on the student's profile (commits, pull requests, issues and reviews). Private work counts only if the student shares private contributions on their profile.",
            "coverage_start": days[0]["date"] if days else None,
            "coverage_end": days[-1]["date"] if days else None,
            "records_returned": len(days),
        }

    async def _apply_public_feed(self, result: dict[str, Any], data: dict[str, Any]) -> None:
        # Events expose recent public activity only. GitHub no longer lists the
        # commits inside a push event, so this fallback counts pushes instead.
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
                    "pushes": 0,
                    "pull_requests": 0,
                    "repository_creations": 0,
                    "public_events": 0,
                },
            )
            metrics["public_events"] += 1
            if event_type == "PushEvent":
                metrics["pushes"] += 1
            elif event_type == "PullRequestEvent":
                metrics["pull_requests"] += 1
            elif event_type == "CreateEvent":
                metrics["repository_creations"] += 1

        result["pushes"] = float(sum(day["pushes"] for day in daily.values()))
        result["pull_requests"] = float(sum(day["pull_requests"] for day in daily.values()))
        result["repository_creations"] = float(
            sum(day["repository_creations"] for day in daily.values())
        )
        result["public_activity_events"] = float(
            sum(day["public_events"] for day in daily.values())
        )
        result["contributions"] = (
            result["pushes"] + result["pull_requests"] + result["repository_creations"]
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
            "metric_key": "pushes",
            "metric_label": "Public pushes",
            "note": "Without a working GITHUB_API_TOKEN this uses GitHub's public events feed (up to 300 recent events). GitHub no longer lists the commits inside a push, so pushes are counted. Set a token to use the contribution calendar.",
            "coverage_start": coverage_start if events_available else None,
            "coverage_end": today.isoformat() if events_available else None,
            "records_returned": len(records),
            "record_limit": 300,
            "possibly_truncated": len(records) >= 300,
        }

    def profile_url(self, username: str) -> str:
        return f"https://github.com/{username}"
