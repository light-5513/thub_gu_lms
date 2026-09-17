"""Analytics, reports and settings schemas."""

from typing import Any

from pydantic import BaseModel


class SettingsOut(BaseModel):
    institution_name: str = "My Institution"
    logo_url: str | None = None
    academic_year: str | None = None
    attendance_threshold: float = 75.0
    leaderboard_weights: dict[str, float] = {
        "attendance": 0.30,
        "coding": 0.50,
        "streak": 0.20,
    }
    streak_rules: dict[str, Any] = {
        "late_counts_as_present": True,
        "leave_breaks_streak": False,
        "absent_breaks_streak": True,
    }
    late_rules: dict[str, Any] = {
        "late_counts_as_present": True,
        "late_penalty_score": 0.5,
    }
    leave_rules: dict[str, Any] = {"leave_counts_absent": False}
    coding_sync_settings: dict[str, Any] = {
        "timeout_seconds": 15,
        "max_retries": 3,
        "retry_delay_seconds": 2,
        "request_delay_ms": 250,
        "concurrency": 4,
    }
    timezone: str = "Asia/Kolkata"


class SettingsUpdate(BaseModel):
    institution_name: str | None = None
    logo_url: str | None = None
    academic_year: str | None = None
    attendance_threshold: float | None = None
    leaderboard_weights: dict[str, float] | None = None
    streak_rules: dict[str, Any] | None = None
    late_rules: dict[str, Any] | None = None
    leave_rules: dict[str, Any] | None = None
    coding_sync_settings: dict[str, Any] | None = None
    timezone: str | None = None
