"""Scoring engine: configurable weighted overall score.

Components:
  - attendance_score : 0-100 from attendance percentage
  - coding_score     : 0-100 normalized across connected platforms
  - streak_score     : 0-100 from current streak relative to cap
Weights are stored in MongoDB settings (leaderboard_weights) and must sum to
1.0; the engine normalizes defensively if they do not.
"""

from typing import Any

PLATFORM_MAXES = {
    # Rough normalization ceilings per platform metric.
    "leetcode": {"problems_solved": 800, "rating": 2500},
    "codechef": {"problems_solved": 500, "rating": 2500},
    "codeforces": {"problems_solved": 1000, "rating": 2500},
    "atcoder": {"rating": 2800},
    "github": {"contributions": 1200, "public_repos": 60, "followers": 300},
}


def normalize(value: float | None, ceiling: float) -> float:
    if value is None or ceiling <= 0:
        return 0.0
    return max(0.0, min(100.0, (float(value) / ceiling) * 100.0))


def platform_coding_score(platform: str, stats: dict[str, Any]) -> float:
    """Score one platform's stats on a 0-100 scale."""
    maxes = PLATFORM_MAXES.get(platform)
    if not maxes:
        return 0.0
    parts = []
    for metric, ceiling in maxes.items():
        if metric in stats and stats[metric] is not None:
            parts.append(normalize(stats.get(metric), ceiling))
    return round(sum(parts) / len(parts), 2) if parts else 0.0


def compute_coding_score(platform_stats: list[dict]) -> float:
    """Average of each connected platform's score."""
    scores = []
    for entry in platform_stats:
        platform = entry.get("platform")
        stats = entry.get("statistics") or {}
        s = platform_coding_score(platform, stats)
        if s > 0:
            scores.append(s)
    return round(sum(scores) / len(scores), 2) if scores else 0.0


def streak_score(current_streak: int, streak_cap: int = 30) -> float:
    if streak_cap <= 0:
        streak_cap = 30
    return round(min(100.0, (current_streak / streak_cap) * 100.0), 2)


def attendance_score(percentage: float | None) -> float:
    if percentage is None:
        return 0.0
    return max(0.0, min(100.0, float(percentage)))


def compute_overall(
    attendance_pct: float | None,
    coding: float,
    current_streak: int,
    weights: dict[str, float] | None = None,
    streak_cap: int = 30,
) -> dict:
    weights = weights or {"attendance": 0.30, "coding": 0.50, "streak": 0.20}
    total_weight = sum(weights.values()) or 1.0

    a = attendance_score(attendance_pct)
    c = float(coding or 0.0)
    s = streak_score(current_streak, streak_cap)

    wa = weights.get("attendance", 0.3) / total_weight
    wc = weights.get("coding", 0.5) / total_weight
    ws = weights.get("streak", 0.2) / total_weight

    overall = a * wa + c * wc + s * ws
    return {
        "attendance_score": round(a, 2),
        "coding_score": round(c, 2),
        "streak_score": round(s, 2),
        "overall_score": round(overall, 2),
    }
