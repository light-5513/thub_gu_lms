"""Streak calculation engine.

Pure business logic: given an ordered list of attendance records and
configurable rules, compute current/longest streaks. Dates without a scheduled
class simply do not appear in the input, so they can never count as absences.
"""

from collections.abc import Iterable
from datetime import datetime, timezone
from typing import Any


def _normalize(records: Iterable[dict]) -> list[dict]:
    """Sort records by session date/time ascending."""
    out = []
    for r in records:
        status = (r.get("status") or "").lower()
        date_val = r.get("date") or r.get("session_date")
        if isinstance(date_val, str):
            try:
                from datetime import date as _date

                date_val = datetime.combine(
                    _date.fromisoformat(date_val[:10]),
                    datetime.min.time(),
                    tzinfo=timezone.utc,
                )
            except Exception:
                continue
        out.append({"status": status, "date": date_val})
    out.sort(key=lambda x: x["date"])
    return out


def breaks_streak(status: str, rules: dict[str, Any]) -> bool:
    """Does this status break the attendance streak?"""
    rules = rules or {}
    if status == "absent":
        return bool(rules.get("absent_breaks_streak", True))
    if status == "leave":
        return bool(rules.get("leave_breaks_streak", False))
    if status == "late":
        # Late never breaks; it counts as present when late_counts_as_present.
        return not bool(rules.get("late_counts_as_present", True))
    # present never breaks
    return False


def counts_toward_streak(status: str, rules: dict[str, Any]) -> bool:
    rules = rules or {}
    if status in ("present",):
        return True
    if status == "late":
        return bool(rules.get("late_counts_as_present", True))
    return False


def compute_streaks(records: list[dict], rules: dict[str, Any] | None = None) -> dict:
    """Compute current streak, longest streak, totals for one student."""
    rules = rules or {}
    ordered = _normalize(records)

    current = 0
    longest = 0
    run = 0
    total_sessions = 0
    attended = 0

    for rec in ordered:
        total_sessions += 1
        status = rec["status"]
        counts = counts_toward_streak(status, rules)
        if counts:
            attended += 1
            run += 1
            longest = max(longest, run)
        elif breaks_streak(status, rules):
            run = 0
        else:
            # neutral statuses (e.g. leave configured not to break) keep the run alive
            pass

    # Current streak = trailing consecutive attended sessions.
    current = 0
    for rec in reversed(ordered):
        status = rec["status"]
        if counts_toward_streak(status, rules):
            current += 1
        elif breaks_streak(status, rules):
            break
        else:
            continue

    percentage = round((attended / total_sessions) * 100, 1) if total_sessions else None
    last_activity = ordered[-1]["date"].isoformat() if ordered else None
    return {
        "current_streak": current,
        "longest_streak": longest,
        "total_present_sessions": attended,
        "total_sessions": total_sessions,
        "attendance_percentage": percentage,
        "last_session_date": last_activity,
    }
