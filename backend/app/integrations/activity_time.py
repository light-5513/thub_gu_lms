"""Date bucketing helpers for platform activity and date-only filters."""

from datetime import date, datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


DEFAULT_ACTIVITY_TIMEZONE = "Asia/Kolkata"
_FALLBACK_ACTIVITY_TIMEZONE = timezone(
    timedelta(hours=5, minutes=30), name=DEFAULT_ACTIVITY_TIMEZONE
)


def get_activity_timezone(name: str | None = None) -> tzinfo:
    requested = name or DEFAULT_ACTIVITY_TIMEZONE
    try:
        return ZoneInfo(requested)
    except (ZoneInfoNotFoundError, ValueError):
        if requested != DEFAULT_ACTIVITY_TIMEZONE:
            try:
                return ZoneInfo(DEFAULT_ACTIVITY_TIMEZONE)
            except (ZoneInfoNotFoundError, ValueError):
                pass
        return _FALLBACK_ACTIVITY_TIMEZONE


def activity_date(timestamp: int | float, timezone_name: str | None = None) -> date:
    return datetime.fromtimestamp(float(timestamp), timezone.utc).astimezone(
        get_activity_timezone(timezone_name)
    ).date()


def activity_date_key(
    timestamp: datetime | str | None, timezone_name: str | None = None
) -> str | None:
    """Return the calendar date of an ISO timestamp in the activity timezone."""
    if timestamp is None:
        return None
    if isinstance(timestamp, datetime):
        parsed = timestamp
    else:
        value = str(timestamp)
        if len(value) == 10:
            return value
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value[:10] if len(value) >= 10 else None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(get_activity_timezone(timezone_name)).date().isoformat()


def today_in_timezone(timezone_name: str | None = None) -> date:
    return datetime.now(timezone.utc).astimezone(
        get_activity_timezone(timezone_name)
    ).date()
