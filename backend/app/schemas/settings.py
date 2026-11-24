"""Analytics, reports and settings schemas."""

from typing import Any
import math
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator


class CodingSyncSettings(BaseModel):
    timeout_seconds: float = Field(default=15, gt=0, le=300, allow_inf_nan=False)
    max_retries: int = Field(default=3, ge=1, le=10)
    retry_delay_seconds: float = Field(default=2, ge=0, le=60, allow_inf_nan=False)
    request_delay_ms: float = Field(default=250, ge=0, le=60000, allow_inf_nan=False)
    concurrency: int = Field(default=4, ge=1, le=32)


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
    attendance_threshold: float | None = Field(default=None, ge=0, le=100, allow_inf_nan=False)
    leaderboard_weights: dict[str, float] | None = None
    streak_rules: dict[str, Any] | None = None
    late_rules: dict[str, Any] | None = None
    leave_rules: dict[str, Any] | None = None
    coding_sync_settings: dict[str, Any] | None = None
    timezone: str | None = None

    @field_validator("coding_sync_settings")
    @classmethod
    def valid_sync_settings(cls, value):
        if value is None:
            return value
        return CodingSyncSettings.model_validate(value).model_dump(exclude_unset=True)

    @field_validator("leaderboard_weights")
    @classmethod
    def valid_weights(cls, value):
        if value is None:
            return value
        if set(value) != {"attendance", "coding", "streak"}:
            raise ValueError("Provide attendance, coding and streak weights")
        if any(not math.isfinite(weight) or weight < 0 for weight in value.values()) or sum(value.values()) <= 0:
            raise ValueError("Weights must be nonnegative with a positive total")
        return value

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        if value is not None:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as exc:
                raise ValueError("Choose a valid timezone") from exc
        return value
