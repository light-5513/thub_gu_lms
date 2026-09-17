"""Scoring engine tests."""
from app.services.scoring_engine import (
    attendance_score,
    compute_coding_score,
    compute_overall,
    normalize,
    platform_coding_score,
    streak_score,
)


def test_normalize_clamps():
    assert normalize(50, 100) == 50.0
    assert normalize(150, 100) == 100.0
    assert normalize(None, 100) == 0.0
    assert normalize(-5, 100) == 0.0


def test_attendance_score_bounds():
    assert attendance_score(120) == 100.0
    assert attendance_score(None) == 0.0
    assert attendance_score(87.5) == 87.5


def test_streak_score_cap():
    assert streak_score(30, 30) == 100.0
    assert streak_score(60, 30) == 100.0
    assert streak_score(15, 30) == 50.0
    assert streak_score(0, 30) == 0.0


def test_platform_scores():
    leetcode = {"problems_solved": 400, "rating": 2000}
    score = platform_coding_score("leetcode", leetcode)
    assert 0 < score <= 100

    empty = platform_coding_score("leetcode", {})
    assert empty == 0.0


def test_compute_coding_score_averages_platforms():
    stats = [
        {"platform": "leetcode", "statistics": {"problems_solved": 800, "rating": 2500}},  # ~100
        {"platform": "github", "statistics": {"contributions": 600, "public_repos": 30, "followers": 150}},  # ~50
    ]
    combined = compute_coding_score(stats)
    assert 60 < combined < 90


def test_overall_weighting():
    result = compute_overall(
        attendance_pct=80,
        coding=100,
        current_streak=30,
        weights={"attendance": 0.3, "coding": 0.5, "streak": 0.2},
        streak_cap=30,
    )
    # 80*0.3 + 100*0.5 + 100*0.2 = 24 + 50 + 20 = 94
    assert abs(result["overall_score"] - 94.0) < 0.01
    assert result["attendance_score"] == 80.0
    assert result["coding_score"] == 100.0
    assert result["streak_score"] == 100.0


def test_weights_are_normalized_if_they_do_not_sum_to_one():
    result = compute_overall(100, 100, 30, weights={"attendance": 1, "coding": 1, "streak": 1})
    assert abs(result["overall_score"] - 100.0) < 0.01
