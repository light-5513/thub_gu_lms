"""LeetCode adapter via the public GraphQL endpoint (unofficial).

Endpoint: https://leetcode.com/graphql  (configurable via LEETCODE_API_URL)
No auth required for public profiles; rate limited — keep delays configured.
"""

from typing import Any

from app.config import settings
from app.integrations.base import AdapterError, CodingPlatformAdapter


class LeetCodeAdapter(CodingPlatformAdapter):
    name = "leetcode"
    display_name = "LeetCode"

    QUERY = """
    query userProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile { ranking reputation }
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
          totalSubmissionNum { difficulty count }
        }
        tagProblemCounts { advanced { tagSlug problemsSolved } intermediate { tagSlug problemsSolved } fundamental { tagSlug problemsSolved } }
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
        attendedContestsCount
      }
    }
    """

    async def fetch_profile(self, username: str) -> dict[str, Any]:
        response = await self._request(
            "POST",
            settings.LEETCODE_API_URL,
            json={"query": self.QUERY, "variables": {"username": username}},
            headers={
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com",
            },
        )
        data = response.json()
        if data.get("errors"):
            raise AdapterError(
                f"LeetCode API error: {data['errors'][0].get('message', 'unknown')}"
            )
        return data.get("data") or {}

    async def normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        user = data.get("matchedUser") or {}
        if not user:
            raise AdapterError("LeetCode profile not found")
        ac = ((user.get("submitStatsGlobal") or {}).get("acSubmissionNum")) or []
        solved = next((int(d["count"]) for d in ac if d.get("difficulty") == "All"), 0)
        easy = next((int(d["count"]) for d in ac if d.get("difficulty") == "Easy"), 0)
        medium = next(
            (int(d["count"]) for d in ac if d.get("difficulty") == "Medium"), 0
        )
        hard = next((int(d["count"]) for d in ac if d.get("difficulty") == "Hard"), 0)
        contest = data.get("userContestRanking") or {}
        profile = user.get("profile") or {}
        return {
            "problems_solved": float(solved),
            "easy_solved": float(easy),
            "medium_solved": float(medium),
            "hard_solved": float(hard),
            "rating": float(contest.get("rating", 0) or 0),
            "rank": float(profile.get("ranking", 0) or 0),
            "contests": float(contest.get("attendedContestsCount", 0) or 0),
            "reputation": float(profile.get("reputation", 0) or 0),
        }

    def profile_url(self, username: str) -> str:
        return f"https://leetcode.com/{username}/"
