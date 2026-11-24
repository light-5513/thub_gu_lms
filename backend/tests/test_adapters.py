"""Adapter normalization tests (no network calls)."""
import re

import pytest

from app.integrations.atcoder import AtCoderAdapter
from app.integrations.base import AdapterError, AdapterNotConfigured
from app.integrations.codechef import CodeChefAdapter
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


def test_leetcode_submissions_count_every_submission():
    import asyncio

    # totalSubmissionNum.count is the number of problems attempted; .submissions
    # is the number of submissions, which the portal labels "All submissions".
    assert re.search(r"totalSubmissionNum\s*\{[^}]*\bsubmissions\b", LeetCodeAdapter.QUERY)
    raw = {
        "matchedUser": {
            "submitStatsGlobal": {
                "acSubmissionNum": [{"difficulty": "All", "count": 709, "submissions": 2139}],
                "totalSubmissionNum": [{"difficulty": "All", "count": 773, "submissions": 4962}],
            },
        },
    }
    stats = asyncio.get_event_loop().run_until_complete(LeetCodeAdapter().normalize(raw))
    assert stats["problems_solved"] == 709.0
    assert stats["submissions"] == 4962.0


CODECHEF_RATED_PROFILE = """
<span class='rating' style='display: inline-block; margin-right: 2px;'>4&#9733;</span><span class='m-username--link'>ada</span>
<div class="rating-header text-center">
    <div class="rating-number">
1912                </div>
    <div>(Div 2)</div>
    <div class="rating-star"><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span></div>
    <a href="/ratings"><strong>CodeChef Rating</strong></a>
    <small>(Highest Rating 2016)</small>
</div>
<div class="rating-ranks">
    <ul class="inline-list">
        <li>
            <a href="/ratings/all">
                <strong>
{global_rank}                            </strong>
            </a>
            Global Rank
        </li>
        <li>
            <a href="/ratings/all?filterBy=Country%3DIndia">
                <strong>
{country_rank}                            </strong>
            </a>
            Country Rank
        </li>
    </ul>
</div>
<div class="rating-header text-center">
    <small>(Highest Rating 0)</small>
</div>
<h3>Total Problems Solved: 87</h3>
<script>var all_rating = [{"code":"START1","rating":"1850","rank":"500"},{"code":"START2","rating":"1912","rank":"300"}];</script>
"""


def test_codechef_parses_peak_rating_and_ranks_from_profile_page():
    import asyncio

    html = CODECHEF_RATED_PROFILE.replace("{global_rank}", "12,345").replace("{country_rank}", "6789")
    stats = asyncio.get_event_loop().run_until_complete(CodeChefAdapter().normalize({"html": html}))

    assert stats["rating"] == 1912.0
    assert stats["max_rating"] == 2016.0
    assert stats["stars"] == 4.0
    assert stats["rank"] == 12345.0
    assert stats["country_rank"] == 6789.0
    assert stats["problems_solved"] == 87.0
    assert stats["contests"] == 2.0


def test_codechef_inactive_ranks_are_left_empty():
    import asyncio

    html = CODECHEF_RATED_PROFILE.replace("{global_rank}", "Inactive").replace("{country_rank}", "Inactive")
    stats = asyncio.get_event_loop().run_until_complete(CodeChefAdapter().normalize({"html": html}))

    assert stats["rank"] == 0.0
    assert stats["country_rank"] == 0.0
    assert stats["max_rating"] == 2016.0


class _JsonResponse:
    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


def test_atcoder_user_without_accepted_problems_is_not_missing(monkeypatch):
    import asyncio

    adapter = AtCoderAdapter()
    calls = []

    async def fake_request(method, url, **kwargs):
        calls.append(url)
        if "/user/ac_rank" in url:
            # AtCoder Problems only ranks users with at least one accepted submission.
            raise AdapterError("Profile not found on platform")
        if url == "https://atcoder.jp/users/newbie":
            return _JsonResponse(None)
        if url.endswith("/user/submissions") or url.endswith("/history/json"):
            return _JsonResponse([])
        raise AssertionError(f"unexpected request {url}")

    monkeypatch.setattr(adapter, "_request", fake_request)
    stats = asyncio.get_event_loop().run_until_complete(adapter.get_stats("newbie"))

    assert stats["problems_solved"] == 0.0
    assert stats["rank"] == 0.0
    assert "https://atcoder.jp/users/newbie" in calls


def test_atcoder_unknown_user_is_reported_missing(monkeypatch):
    import asyncio

    adapter = AtCoderAdapter()

    async def fake_request(method, url, **kwargs):
        raise AdapterError("Profile not found on platform")

    monkeypatch.setattr(adapter, "_request", fake_request)
    with pytest.raises(AdapterError, match="AtCoder profile not found"):
        asyncio.get_event_loop().run_until_complete(adapter.get_stats("ghost"))


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


GITHUB_PROFILE = {
    "login": "ada",
    "public_repos": 3,
    "followers": 2,
    "following": 1,
    "public_gists": 0,
    "events_url": "https://api.github.com/users/ada/events{/privacy}",
    "created_at": "2020-01-01T00:00:00Z",
}


def test_github_uses_contribution_calendar_when_token_is_configured(monkeypatch):
    import asyncio

    from app.config import settings

    monkeypatch.setattr(settings, "GITHUB_API_TOKEN", "test-token")
    adapter = GitHubAdapter()
    calls = []
    calendar = {
        "totalCommitContributions": 40,
        "totalIssueContributions": 2,
        "totalPullRequestContributions": 5,
        "totalPullRequestReviewContributions": 3,
        "totalRepositoryContributions": 1,
        "restrictedContributionsCount": 4,
        "contributionCalendar": {
            "totalContributions": 55,
            "weeks": [
                {"contributionDays": [
                    {"date": "2026-01-04", "contributionCount": 0},
                    {"date": "2026-01-05", "contributionCount": 7},
                ]},
                {"contributionDays": [{"date": "2026-11-24", "contributionCount": 2}]},
            ],
        },
    }

    async def fake_request(method, url, **kwargs):
        calls.append((method, url, (kwargs.get("headers") or {}).get("Authorization")))
        if url == "https://api.github.com/graphql":
            assert kwargs["json"]["variables"] == {"login": "ada"}
            return _JsonResponse({"data": {"user": {"contributionsCollection": calendar}}})
        raise AssertionError(f"unexpected request {url}")

    monkeypatch.setattr(adapter, "_request", fake_request)
    stats = asyncio.get_event_loop().run_until_complete(adapter.normalize(dict(GITHUB_PROFILE)))

    assert stats["contributions"] == 55.0
    assert stats["commits"] == 40.0
    assert stats["pull_requests"] == 5.0
    assert stats["issues"] == 2.0
    assert stats["reviews"] == 3.0
    assert stats["repository_creations"] == 1.0
    assert stats["private_contributions"] == 4.0
    assert stats["_daily_activity"] == [
        {"date": "2026-01-05", "metrics": {"contributions": 7}},
        {"date": "2026-11-24", "metrics": {"contributions": 2}},
    ]
    metadata = stats["_activity_metadata"]
    assert metadata["available"] is True
    assert metadata["metric_key"] == "contributions"
    assert (metadata["coverage_start"], metadata["coverage_end"]) == ("2026-01-04", "2026-11-24")
    assert calls == [("POST", "https://api.github.com/graphql", "Bearer test-token")]


def test_github_counts_public_pushes_without_a_token(monkeypatch):
    import asyncio

    from app.config import settings

    monkeypatch.setattr(settings, "GITHUB_API_TOKEN", None)
    adapter = GitHubAdapter()
    # GitHub's public events no longer list the commits inside a push.
    events = [
        {"type": "PushEvent", "created_at": "2026-11-20T10:00:00Z", "payload": {"before": "a", "head": "b", "push_id": 1, "ref": "refs/heads/main", "repository_id": 9}},
        {"type": "PushEvent", "created_at": "2026-11-20T12:00:00Z", "payload": {"before": "b", "head": "c", "push_id": 2, "ref": "refs/heads/main", "repository_id": 9}},
        {"type": "PullRequestEvent", "created_at": "2026-11-21T09:00:00Z", "payload": {}},
    ]

    async def fake_request(method, url, **kwargs):
        if "/events" in url:
            return _JsonResponse(events)
        raise AssertionError(f"unexpected request {url}")

    monkeypatch.setattr(adapter, "_request", fake_request)
    stats = asyncio.get_event_loop().run_until_complete(adapter.normalize(dict(GITHUB_PROFILE)))

    assert stats["pushes"] == 2.0
    assert stats["pull_requests"] == 1.0
    assert stats["contributions"] == 3.0
    assert "commits" not in stats
    assert stats["_activity_metadata"]["metric_key"] == "pushes"
    assert stats["_daily_activity"][0] == {
        "date": "2026-11-20",
        "metrics": {"pushes": 2, "pull_requests": 0, "repository_creations": 0, "public_events": 2},
    }


def test_github_falls_back_to_public_feed_when_token_is_rejected(monkeypatch):
    import asyncio

    from app.config import settings

    monkeypatch.setattr(settings, "GITHUB_API_TOKEN", "stale-token")
    adapter = GitHubAdapter()
    graphql_calls = 0

    async def fake_request(method, url, **kwargs):
        nonlocal graphql_calls
        if url == "https://api.github.com/graphql":
            graphql_calls += 1
            raise AdapterError("github request rejected with HTTP 401: Bad credentials")
        if "/events" in url:
            assert "Authorization" not in kwargs["headers"]
            return _JsonResponse([])
        raise AssertionError(f"unexpected request {url}")

    monkeypatch.setattr(adapter, "_request", fake_request)
    stats = asyncio.get_event_loop().run_until_complete(adapter.normalize(dict(GITHUB_PROFILE)))

    assert graphql_calls == 1
    assert stats["_activity_metadata"]["metric_key"] == "pushes"
    assert stats["contributions"] == 0.0


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
