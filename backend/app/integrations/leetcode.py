"""LeetCode adapter via the public GraphQL endpoint (unofficial).

Endpoint: https://leetcode.com/graphql  (configurable via LEETCODE_API_URL)
No auth required for public profiles; rate limited — keep delays configured.
"""

from typing import Any

from app.config import settings
from app.integrations.activity_time import activity_date, today_in_timezone
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
        userCalendar {
          activeYears
          streak
          totalActiveDays
          submissionCalendar
        }
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
        easy = next((int(d["count"]) for d in ac if d.get("difficulty") == "Easy"), 0)
        medium = next(
            (int(d["count"]) for d in ac if d.get("difficulty") == "Medium"), 0
        )
        hard = next((int(d["count"]) for d in ac if d.get("difficulty") == "Hard"), 0)
        all_count = next(
            (int(d["count"]) for d in ac if d.get("difficulty") == "All"), None
        )
        total_submissions = (user.get("submitStatsGlobal") or {}).get(
            "totalSubmissionNum"
        ) or []
        submitted = next(
            (int(d["count"]) for d in total_submissions if d.get("difficulty") == "All"),
            0,
        )
        solved = all_count if all_count is not None else easy + medium + hard
        contest = data.get("userContestRanking") or {}
        profile = user.get("profile") or {}
        calendar = user.get("userCalendar") or {}
        calendar_data = calendar.get("submissionCalendar") or {}
        if isinstance(calendar_data, str):
            try:
                import json

                calendar_data = json.loads(calendar_data)
            except (TypeError, ValueError):
                calendar_data = {}
        daily = []
        if isinstance(calendar_data, dict):
            for timestamp, count in calendar_data.items():
                try:
                    day = activity_date(int(timestamp), self.activity_timezone).isoformat()
                    daily.append({"date": day, "metrics": {"submissions": int(count)}})
                except (TypeError, ValueError, OSError):
                    continue
        result = {
            "problems_solved": float(solved),
            "easy_solved": float(easy),
            "medium_solved": float(medium),
            "hard_solved": float(hard),
            "submissions": float(submitted),
            "rating": float(contest.get("rating", 0) or 0),
            "rank": float(profile.get("ranking", 0) or 0),
            "contest_global_rank": float(contest.get("globalRanking", 0) or 0),
            "contests": float(contest.get("attendedContestsCount", 0) or 0),
            "reputation": float(profile.get("reputation", 0) or 0),
            "total_active_days": float(calendar.get("totalActiveDays", 0) or 0),
            "current_streak": float(calendar.get("streak", 0) or 0),
            "active_years": len(calendar.get("activeYears") or []),
            "_daily_activity": daily,
            "_activity_metadata": {
                "available": True,
                "metric_key": "submissions",
                "metric_label": "Submissions (all verdicts)",
                "note": "LeetCode's public calendar counts submissions, not accepted problems. This calendar comes from LeetCode's undocumented public GraphQL API.",
                "coverage_start": min((row["date"] for row in daily), default=None),
                "coverage_end": today_in_timezone(self.activity_timezone).isoformat(),
            },
        }
        return result

    def profile_url(self, username: str) -> str:
        return f"https://leetcode.com/{username}/"
