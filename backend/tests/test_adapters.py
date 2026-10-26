"""Adapter normalization tests (no network calls)."""
import pytest

from app.integrations.base import AdapterNotConfigured
from app.integrations.leetcode import LeetCodeAdapter
from app.integrations.codeforces import CodeforcesAdapter
from app.integrations.github import GitHubAdapter
from app.integrations.unsupported import HackerRankAdapter


def test_leetcode_normalize():
    import asyncio

    adapter = LeetCodeAdapter()
    raw = {
        "matchedUser": {
            "username": "jane",
            "profile": {"ranking": 51234, "reputation": 10},
            "submitStatsGlobal": {
                "acSubmissionNum": [
                    {"difficulty": "Easy", "count": 100},
                    {"difficulty": "Medium", "count": 80},
                    {"difficulty": "Hard", "count": 20},
                ]
            },
        },
        "userContestRanking": {"rating": 1655.4, "globalRanking": 40000, "attendedContestsCount": 12},
    }
    stats = asyncio.get_event_loop().run_until_complete(adapter.normalize(raw))
    assert stats["problems_solved"] == 200.0
    assert stats["rating"] == 1655.4
    assert stats["contests"] == 12.0


def test_codeforces_normalize_shape():
    adapter = CodeforcesAdapter()
    # normalize() also fetches solved counts; test the rating math via monkeypatch-free path:
    # We only validate that rating fields map correctly when status call fails silently.
    import asyncio

    async def fake_request(method, url, **kwargs):
        class R:
            status_code = 200

            def raise_for_status(self):
                pass

            def json(self):
                if "user.info" in url:
                    return {"status": "OK", "result": [{"rating": 1500, "maxRating": 1600, "rank": "specialist", "contribution": 5, "friendOfCount": 9, "handle": "x"}]}
                return {"status": "OK", "result": [{"verdict": "OK", "problem": {"contestId": 1, "index": "A"}}]}

        return R()

    adapter._request = fake_request
    stats = asyncio.get_event_loop().run_until_complete(adapter.get_stats("x"))
    assert stats["rating"] == 1500.0
    assert stats["problems_solved"] == 1.0
    assert stats["rank_name"] == "specialist"


def test_github_normalize_rejects_missing_profile():
    import asyncio

    adapter = GitHubAdapter()
    with pytest.raises(Exception):
        asyncio.get_event_loop().run_until_complete(adapter.normalize({"message": "Not Found"}))


def test_hackerrank_is_explicitly_unconfigured():
    adapter = HackerRankAdapter()
    import asyncio

    with pytest.raises(AdapterNotConfigured):
        asyncio.get_event_loop().run_until_complete(adapter.fetch_profile("someone"))
