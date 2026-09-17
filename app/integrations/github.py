"""GitHub adapter via the official REST API.

Auth: optional GITHUB_API_TOKEN raises rate limits from 60/hr to 5000/hr.
"""

from datetime import datetime
from typing import Any

from app.config import settings
from app.integrations.base import AdapterError, CodingPlatformAdapter


class GitHubAdapter(CodingPlatformAdapter):
    name = "github"
    display_name = "GitHub"

    def _headers(self) -> dict:
        headers = {"Accept": "application/vnd.github+json"}
        if settings.GITHUB_API_TOKEN:
            headers["Authorization"] = f"Bearer {settings.GITHUB_API_TOKEN}"
        return headers

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        url = f"https://api.github.com/users/{username}"
        response = await self._request("GET", url, headers=self._headers())
        return response.json()

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        if "message" in data and data.get("message") == "Not Found":
            raise AdapterError("GitHub profile not found")
        result = {
            "public_repos": float(data.get("public_repos", 0) or 0),
            "followers": float(data.get("followers", 0) or 0),
            "following": float(data.get("following", 0) or 0),
        }
        # Contributions come from the events API (approximate recent activity).
        try:
            events_url = data.get("events_url").replace("{/privacy}", "")
            resp = await self._request(
                "GET", f"{events_url}?per_page=100", headers=self._headers()
            )
            events = resp.json()
            contributions = sum(
                e.get("payload", {}).get("commits")
                and len(e["payload"]["commits"])
                or (1 if e.get("type") == "CreateEvent" else 0)
                for e in events
                if e.get("type") in ("PushEvent", "CreateEvent", "PullRequestEvent")
            )
            result["contributions"] = float(contributions)
        except Exception:
            result["contributions"] = 0.0
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
