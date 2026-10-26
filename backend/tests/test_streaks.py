"""Streak engine tests: business rules for current/longest streaks."""
from datetime import datetime, timedelta, timezone

from app.services.streak_service import compute_streaks

RULES = {"late_counts_as_present": True, "leave_breaks_streak": False, "absent_breaks_streak": True}


def d(days_ago: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def test_no_records():
    result = compute_streaks([], RULES)
    assert result["current_streak"] == 0
    assert result["longest_streak"] == 0
    assert result["attendance_percentage"] is None


def test_all_present():
    records = [{"status": "present", "date": d(i)} for i in range(10)]
    result = compute_streaks(records, RULES)
    assert result["current_streak"] == 10
    assert result["longest_streak"] == 10
    assert result["attendance_percentage"] == 100.0


def test_absent_breaks_streak():
    records = [
        {"status": "present", "date": d(5)},
        {"status": "present", "date": d(4)},
        {"status": "absent", "date": d(3)},
        {"status": "present", "date": d(2)},
        {"status": "present", "date": d(1)},
        {"status": "present", "date": d(0)},
    ]
    result = compute_streaks(records, RULES)
    assert result["current_streak"] == 3
    assert result["longest_streak"] == 3
    assert result["attendance_percentage"] == 83.3


def test_late_counts_as_present_when_configured():
    records = [{"status": "late", "date": d(i)} for i in range(4)]
    result = compute_streaks(records, {**RULES, "late_counts_as_present": True})
    assert result["current_streak"] == 4
    assert result["longest_streak"] == 4
    # And when late does NOT count as present, it breaks the streak
    result2 = compute_streaks(records, {**RULES, "late_counts_as_present": False})
    assert result2["current_streak"] == 0


def test_leave_does_not_break_streak_by_default():
    records = [
        {"status": "present", "date": d(3)},
        {"status": "leave", "date": d(2)},
        {"status": "present", "date": d(1)},
        {"status": "present", "date": d(0)},
    ]
    result = compute_streaks(records, RULES)
    assert result["current_streak"] == 3  # leave neutral, run continues
    assert result["longest_streak"] == 3


def test_leave_breaks_streak_when_configured():
    records = [
        {"status": "present", "date": d(2)},
        {"status": "leave", "date": d(1)},
        {"status": "present", "date": d(0)},
    ]
    result = compute_streaks(records, {**RULES, "leave_breaks_streak": True})
    assert result["current_streak"] == 1
    assert result["longest_streak"] == 1


def test_longest_streak_earlier_than_current():
    records = [
        {"status": "present", "date": d(6)},
        {"status": "present", "date": d(5)},
        {"status": "present", "date": d(4)},
        {"status": "absent", "date": d(3)},
        {"status": "present", "date": d(1)},
    ]
    result = compute_streaks(records, RULES)
    assert result["longest_streak"] == 3
    assert result["current_streak"] == 1


def test_dates_without_class_are_neutral():
    """A gap of dates with no class must not count as absence."""
    records = [
        {"status": "present", "date": d(10)},
        {"status": "present", "date": d(2)},  # 8-day gap (holidays) in between
        {"status": "present", "date": d(1)},
    ]
    result = compute_streaks(records, RULES)
    assert result["current_streak"] == 3
    assert result["longest_streak"] == 3
    assert result["total_sessions"] == 3
