"""Coding profile snapshots and date-bounded activity for portal views."""

from datetime import date, datetime, timedelta, timezone

from app.integrations import available_platforms
from app.integrations.activity_time import activity_date_key, get_activity_timezone
from app.repositories.coding import CodingProfileRepository


def normalize_activity_range(
    start_date: date | None,
    end_date: date | None,
    timezone_name: str = "Asia/Kolkata",
) -> tuple[str, str]:
    activity_tz = get_activity_timezone(timezone_name)
    end = end_date or datetime.now(timezone.utc).astimezone(activity_tz).date()
    start = start_date or (end - timedelta(days=29))
    if start > end:
        from app.core.errors import AppError

        raise AppError("Start date must be on or before end date")
    if (end - start).days > 729:
        from app.core.errors import AppError

        raise AppError("Date range cannot exceed 730 days")
    return start.isoformat(), end.isoformat()


class CodingActivityService:
    def __init__(self, db):
        self.db = db
        self.profiles = CodingProfileRepository(db)

    async def for_student(
        self,
        student_id: str,
        start_date: str,
        end_date: str,
        timezone_name: str = "Asia/Kolkata",
    ) -> dict:
        timezone_name = get_activity_timezone(timezone_name).key
        profiles = await self.profiles.list_profiles(student_id)
        profiles_by_platform = {profile["platform"]: profile for profile in profiles}
        stats_docs = await self.profiles.all_statistics_for_student(student_id)
        stats_by_platform = {doc["platform"]: doc for doc in stats_docs}
        activity_docs = await self.profiles.activity_for_student(
            student_id, start_date, end_date
        )
        activity_by_platform: dict[str, list[dict]] = {}
        for row in activity_docs:
            activity_by_platform.setdefault(row["platform"], []).append(
                {
                    "date": row["date"],
                    "metrics": row.get("metrics") or {},
                    "interval_start": row.get("interval_start"),
                    "interval_end": row.get("interval_end"),
                    "interval_start_date": activity_date_key(
                        row.get("interval_start"), timezone_name
                    ),
                    "interval_end_date": activity_date_key(
                        row.get("interval_end"), timezone_name
                    ),
                    "estimated": bool(row.get("estimated", False)),
                }
            )

        platforms = []
        for platform in available_platforms():
            profile = profiles_by_platform.get(platform)
            stats_doc = stats_by_platform.get(platform) or {}
            metadata = dict(stats_doc.get("activity_metadata") or {})
            if not metadata:
                metadata = {
                    "available": False,
                    "metric_key": None,
                    "metric_label": None,
                    "note": (
                        "This platform does not expose a public profile API that this portal can use."
                        if platform in {"hackerrank", "hackerearth"}
                        else (
                            "Connect and sync this profile to load its current statistics."
                            if profile
                            else "No profile is connected."
                        )
                    ),
                }
            timezone_matches = metadata.get("activity_timezone") == timezone_name
            if metadata.get("available") and not timezone_matches:
                metadata["available"] = False
                metadata["note"] = (
                    "Daily history was saved using a different or unknown timezone. "
                    "Run a fresh profile sync to rebuild dates in the current institution timezone."
                )
            fetched = stats_doc.get("fetched_at")
            coverage_start = metadata.get("coverage_start")
            coverage_end = metadata.get("coverage_end")
            range_complete = bool(
                metadata.get("available")
                and timezone_matches
                and coverage_start
                and coverage_end
                and coverage_start <= start_date
                and coverage_end >= end_date
            )
            platforms.append(
                {
                    "platform": platform,
                    "connected": bool(profile),
                    "username": (profile or {}).get("username"),
                    "profile_url": (profile or {}).get("profile_url"),
                    "sync_status": (profile or {}).get("sync_status", "not_connected"),
                    "sync_error": (profile or {}).get("sync_error"),
                    "last_synced_at": fetched.isoformat()
                    if isinstance(fetched, datetime)
                    else None,
                    "statistics": stats_doc.get("statistics") or {},
                    "activity_metadata": metadata,
                    "activity_range": {
                        "complete": range_complete,
                        "coverage_start": coverage_start,
                        "coverage_end": coverage_end,
                        "daily_complete": metadata.get("fill_gaps") is not False,
                        "timezone_matches": timezone_matches,
                    },
                    "daily_activity": activity_by_platform.get(platform, [])
                    if timezone_matches
                    else [],
                }
            )

        return {
            "student_id": student_id,
            "start_date": start_date,
            "end_date": end_date,
            "activity_timezone": timezone_name,
            "supported_platforms": available_platforms(),
            "platforms": platforms,
        }
