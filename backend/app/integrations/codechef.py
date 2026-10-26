"""CodeChef adapter.

CodeChef has no official public profile API. The unofficial endpoint used by
their website is scraped here through the configurable CODECHEF_API_URL base
(default https://www.codechef.com/users/<username>) which returns the HTML
profile page; we extract embedded JSON. If CodeChef changes their page, this
adapter fails gracefully and the platform shows a sync error.
"""

import json
import re
from typing import Any

from app.config import settings
from app.integrations.base import AdapterError, CodingPlatformAdapter


class CodeChefAdapter(CodingPlatformAdapter):
    name = "codechef"
    display_name = "CodeChef"

    STAR_RE = re.compile(r"(\d)\u2605")  # e.g. 3★

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        url = settings.CODECHEF_API_URL.rstrip("/")
        if not url.endswith(username):
            url = f"{url}/{username}"
        response = await self._request("GET", url)
        html = response.text
        if "not found" in html.lower()[:2000] or response.status_code == 404:
            raise AdapterError("CodeChef profile not found")
        return {"html": html}

    def _extract_rating_section(self, html: str) -> dict[str, Any]:
        data: dict[str, Any] = {}
        m = re.search(r"var all_rating = (\[.*?\]);", html, re.DOTALL)
        ratings = []
        if m:
            try:
                ratings = json.loads(m.group(1))
            except Exception:
                pass
        if ratings:
            latest = ratings[-1]
            data["rating"] = float(latest.get("rating", 0) or 0)
            data["highest_rating"] = float(latest.get("highest_rating", 0) or 0)
            data["global_rank"] = latest.get("global_rank")
        m2 = re.search(r"stars-rating[^>]*>\s*(\d)", html)
        stars = re.findall(r"(\d)(?:&#9733|\u2605|★)", html)
        if stars:
            data["stars"] = int(stars[0])
        m3 = re.search(r"Fully Accepted \(100\)[^\d]*(\d+)", html)
        problems = re.findall(r">(\d{2,6})</b>", html)
        solved_m = re.search(r"Solved[^0-9]{0,20}(\d+)", html, re.IGNORECASE)
        if solved_m:
            data["problems_solved"] = int(solved_m.group(1))
        ranks = re.search(r"Global rank:\s*([\d,]+)", html)
        if ranks:
            data["global_rank"] = int(ranks.group(1).replace(",", ""))
        div_rank = re.search(r"Country rank:\s*([\d,]+)", html)
        if div_rank:
            data["country_rank"] = int(div_rank.group(1).replace(",", ""))
        return data

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        stats = self._extract_rating_section(data.get("html", ""))
        if not stats:
            raise AdapterError(
                "Could not parse CodeChef profile (site layout may have changed)"
            )
        return {
            "rating": float(stats.get("rating", 0) or 0),
            "max_rating": float(stats.get("highest_rating", 0) or 0),
            "problems_solved": float(stats.get("problems_solved", 0) or 0),
            "stars": float(stats.get("stars", 0) or 0),
            "rank": float(stats.get("global_rank") or 0)
            if stats.get("global_rank")
            else 0.0,
        }

    def profile_url(self, username: str) -> str:
        return f"https://www.codechef.com/users/{username}"
