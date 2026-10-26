"""Adapter normalization tests (no network calls)."""
import pytest

from app.integrations.base import AdapterError, AdapterNotConfigured
from app.integrations.leetcode import LeetCodeAdapter
from app.integrations.codeforces import CodeforcesAdapter
from app.integrations.geeksforgeeks import GeeksForGeeksAdapter
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


def test_geeksforgeeks_normalize_maps_profile_metrics():
    import asyncio

    adapter = GeeksForGeeksAdapter()
    stats = asyncio.get_event_loop().run_until_complete(
        adapter.normalize(
            {
                "name": "Ada",
                "total_problems_solved": 94,
                "score": 224,
                "monthly_score": "18",
                "pod_solved_current_streak": 3,
                "pod_solved_longest_streak": 11,
                "total_articles_published": 2,
            }
        )
    )

    expected_metrics = {
        "problems_solved": 94.0,
        "score": 224.0,
        "monthly_score": 18.0,
        "current_streak": 3.0,
        "longest_streak": 11.0,
        "articles_published": 2.0,
    }
    assert {key: stats[key] for key in expected_metrics} == expected_metrics
    assert stats["_daily_activity"] == []
    assert stats["_activity_metadata"]["available"] is False
    assert stats["_activity_metadata"]["snapshot_delta_key"] == "problems_solved"
    assert adapter.profile_url("ada") == "https://www.geeksforgeeks.org/profile/ada"


def test_geeksforgeeks_fetch_uses_public_profile_json(monkeypatch):
    import asyncio

    adapter = GeeksForGeeksAdapter()
    request = {}

    class Response:
        def json(self):
            return {
                "message": "data retrieved successfully",
                "data": {"name": "Ada", "total_problems_solved": 94},
            }

    async def fake_request(method, url, **kwargs):
        request.update(method=method, url=url, **kwargs)
        return Response()

    monkeypatch.setattr(adapter, "_request", fake_request)
    profile = asyncio.get_event_loop().run_until_complete(
        adapter.fetch_profile(" ada ")
    )

    assert profile["total_problems_solved"] == 94
    assert request["method"] == "GET"
    assert request["params"]["handle"] == "ada"
    assert request["url"].endswith("/api-get/user-profile-info/")


def test_geeksforgeeks_rejects_empty_profile_payload():
    import asyncio

    adapter = GeeksForGeeksAdapter()
    with pytest.raises(AdapterError, match="statistics are missing"):
        asyncio.get_event_loop().run_until_complete(adapter.normalize({}))


def test_hackerrank_is_explicitly_unconfigured():
    adapter = HackerRankAdapter()
    import asyncio

    with pytest.raises(AdapterNotConfigured):
        asyncio.get_event_loop().run_until_complete(adapter.fetch_profile("someone"))
