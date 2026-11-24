"""Read-only monitoring of the current members of one batch."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from app.integrations.activity_time import activity_date_key
from app.services.batch_service import BatchService
from app.services.settings_service import SettingsService


def _attendance_counts() -> dict:
    return {"present": 0, "late": 0, "absent": 0, "leave": 0, "unmarked": 0}


def _attendance_view(counts: dict, *, threshold: float | None = None) -> dict:
    marked = sum(counts[status] for status in ("present", "late", "absent", "leave"))
    percentage = round(100 * (counts["present"] + counts["late"]) / marked, 1) if marked else None
    result = {**counts, "percentage": percentage}
    if threshold is not None:
        result["threshold"] = threshold
        result["is_low"] = percentage is not None and percentage < threshold
    return result


class BatchMonitorService:
    def __init__(self, db):
        self.db = db

    async def summary(self, batch_id: str, start_date: str, end_date: str, timezone_name: str) -> dict:
        """Summarize a period using today's batch roster, without changing records.

        Attendance percentages use saved statuses only; missing records for a
        current roster member are reported separately as unmarked. Pending
        classes never create inferred absences. Coding activity days require a
        positive, dated, non-estimated metric.
        """
        batch = await BatchService(self.db).get_batch(batch_id)
        members = await self.db.students.find({"batch_id": batch_id}).sort(
            [("roll_number", 1), ("_id", 1)]
        ).to_list(length=None)
        active = [
            student for student in members
            if student.get("status", "active") == "active"
        ]
        active_ids = [student["_id"] for student in active]
        active_id_set = set(active_ids)
        settings = SettingsService(self.db)
        threshold = await settings.attendance_threshold()

        start_day = date.fromisoformat(start_date)
        end_day = date.fromisoformat(end_date)
        start_dt = datetime.combine(start_day, datetime.min.time(), tzinfo=timezone.utc)
        after_end = datetime.combine(end_day + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        classes = await self.db.classes.find({
            "batch_id": batch_id,
            "date": {"$gte": start_dt, "$lt": after_end},
        }).to_list(length=None)
        class_ids = [item["_id"] for item in classes]
        sessions = await self.db.attendance_sessions.find({
            "class_id": {"$in": class_ids}
        }).to_list(length=None) if class_ids else []
        session_ids = {session["_id"] for session in sessions}
        marked_classes = len({session["class_id"] for session in sessions})

        counts_by_student = {sid: _attendance_counts() for sid in active_ids}
        for counts in counts_by_student.values():
            counts["unmarked"] = marked_classes
        attendance_totals = _attendance_counts()
        attendance_totals["unmarked"] = marked_classes * len(active_ids)
        if session_ids and active_ids:
            records = await self.db.attendance_records.find({
                "class_session_id": {"$in": list(session_ids)},
                "student_id": {"$in": active_ids},
            }).to_list(length=None)
            seen = set()
            for record in records:
                sid = record.get("student_id")
                key = (record.get("class_session_id"), sid)
                status = record.get("status")
                if sid not in active_id_set or key in seen or status not in {
                    "present", "late", "absent", "leave"
                }:
                    continue
                seen.add(key)
                counts_by_student[sid][status] += 1
                counts_by_student[sid]["unmarked"] -= 1
                attendance_totals[status] += 1
                attendance_totals["unmarked"] -= 1

        profile_counts = defaultdict(int)
        platform_profiles = defaultdict(set)
        synced_profiles = 0
        profiles = await self.db.coding_profiles.find({
            "student_id": {"$in": active_ids}
        }).to_list(length=None) if active_ids else []
        for profile in profiles:
            sid = profile["student_id"]
            platform = profile.get("platform")
            profile_counts[sid] += 1
            if platform:
                platform_profiles[platform].add(sid)
            if profile.get("sync_status") == "success":
                synced_profiles += 1

        statistics = await self.db.coding_statistics.find({
            "student_id": {"$in": active_ids}
        }).to_list(length=None) if active_ids else []
        statistics_by_profile = {
            (doc.get("student_id"), doc.get("platform")): doc
            for doc in statistics
        }
        exact_counts = defaultdict(float)
        exact_profiles_with_rows = set()
        estimated_counts = defaultdict(float)
        estimated_intervals = defaultdict(int)
        dates_by_student = defaultdict(set)
        platform_active = defaultdict(set)
        estimated_rows = 0
        if active_ids:
            activity = await self.db.coding_activity.find({
                "student_id": {"$in": active_ids},
                "date": {"$gte": start_date, "$lte": end_date},
            }).to_list(length=None)
            for row in activity:
                sid = row.get("student_id")
                platform = row.get("platform")
                if sid not in active_id_set or not platform:
                    continue
                stats_doc = statistics_by_profile.get((sid, platform)) or {}
                metadata = stats_doc.get("activity_metadata") or {}
                saved_timezone = metadata.get("activity_timezone")
                if saved_timezone and saved_timezone != timezone_name:
                    continue
                metric_key = metadata.get("metric_key")
                metrics = row.get("metrics") or {}
                metric_value = metrics.get(metric_key) if metric_key else None
                if row.get("estimated"):
                    estimated_rows += 1
                    if metric_key == "problems_solved_delta":
                        interval_start = activity_date_key(
                            row.get("interval_start"), timezone_name
                        )
                        interval_end = activity_date_key(
                            row.get("interval_end"), timezone_name
                        )
                        if (
                            metadata.get("activity_timezone") == timezone_name
                            and interval_start
                            and interval_end
                            and start_date <= interval_start <= interval_end <= end_date
                            and isinstance(metric_value, (int, float))
                            and not isinstance(metric_value, bool)
                        ):
                            estimated_counts[(sid, platform)] += metric_value
                            estimated_intervals[(sid, platform)] += 1
                    continue

                if (
                    isinstance(metric_value, (int, float))
                    and not isinstance(metric_value, bool)
                ):
                    exact_counts[(sid, platform)] += metric_value
                    exact_profiles_with_rows.add((sid, platform))
                if any(
                    isinstance(value, (int, float))
                    and not isinstance(value, bool)
                    and value > 0
                    for value in metrics.values()
                ):
                    day = row.get("date")
                    if isinstance(day, str):
                        dates_by_student[sid].add(day)
                        platform_active[platform].add(sid)

        platform_labels = {
            "leetcode": "Submissions (all verdicts)",
            "codeforces": "Unique accepted problems",
            "atcoder": "Unique accepted problems",
            "codechef": "New problems detected between syncs",
            "geeksforgeeks": "New problems detected between syncs",
            "github": "Public commits",
        }
        platform_summaries = []
        member_platform_counts = {sid: {} for sid in active_ids}
        for platform, student_ids in sorted(platform_profiles.items()):
            available_profiles = 0
            estimated_profiles = 0
            label = platform_labels.get(platform, "Dated activity")
            for sid in student_ids:
                metadata = (
                    statistics_by_profile.get((sid, platform), {}).get(
                        "activity_metadata"
                    )
                    or {}
                )
                metric_key = metadata.get("metric_key")
                if metadata.get("metric_label"):
                    label = metadata["metric_label"]
                is_estimated = metric_key == "problems_solved_delta"
                if is_estimated:
                    value = estimated_counts.get((sid, platform))
                    interval_count = estimated_intervals.get((sid, platform), 0)
                    if interval_count:
                        estimated_profiles += 1
                    member_platform_counts[sid][platform] = {
                        "value": int(value) if interval_count else None,
                        "quality": "estimated" if interval_count else "unavailable",
                        "metric_label": label,
                        "intervals": interval_count,
                    }
                    continue

                timezone_matches = metadata.get("activity_timezone") == timezone_name
                has_dated_metric = bool(
                    metadata.get("available") and metric_key and timezone_matches
                )
                coverage_start = metadata.get("coverage_start")
                coverage_end = metadata.get("coverage_end")
                coverage_overlaps = bool(
                    coverage_start
                    and coverage_end
                    and coverage_start <= end_date
                    and coverage_end >= start_date
                )
                has_period_data = bool(
                    has_dated_metric
                    and (
                        coverage_overlaps
                        or (sid, platform) in exact_profiles_with_rows
                    )
                )
                if has_period_data:
                    available_profiles += 1
                complete = bool(
                    has_period_data
                    and coverage_start
                    and coverage_end
                    and coverage_start <= start_date
                    and coverage_end >= end_date
                )
                member_platform_counts[sid][platform] = {
                    "value": int(exact_counts.get((sid, platform), 0))
                    if has_period_data
                    else None,
                    "quality": "complete" if complete else "partial"
                    if has_period_data
                    else "unavailable",
                    "metric_label": label,
                    "coverage_start": coverage_start,
                    "coverage_end": coverage_end,
                    "possibly_truncated": bool(metadata.get("possibly_truncated")),
                }

            platform_summaries.append({
                "platform": platform,
                "profiles": len(student_ids),
                "active_students": len(platform_active[platform]),
                "available_profiles": available_profiles,
                "estimated_profiles": estimated_profiles,
                "metric_label": label,
            })

        member_rows = []
        for student in members:
            sid = student["_id"]
            is_active = sid in active_id_set
            activity_days = sorted(dates_by_student[sid]) if is_active else []
            member_rows.append({
                "id": str(sid),
                "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                "roll_number": student.get("roll_number") or "",
                "status": student.get("status", "active"),
                "attendance": _attendance_view(counts_by_student[sid], threshold=threshold)
                if is_active else _attendance_view(_attendance_counts(), threshold=threshold),
                "coding": {
                    "profiles": profile_counts[sid] if is_active else 0,
                    "activity_days": len(activity_days),
                    "last_activity_date": activity_days[-1] if activity_days else None,
                    "platform_counts": member_platform_counts.get(sid, {})
                    if is_active
                    else {},
                },
            })

        all_activity_days = set().union(*dates_by_student.values()) if dates_by_student else set()
        return {
            "batch": {
                "id": batch["id"],
                "batch_code": batch.get("batch_code") or "",
                "name": batch.get("name") or "",
                "student_count": len(members),
            },
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "timezone": timezone_name,
            },
            "students": {
                "total": len(members),
                "active": len(active),
                "inactive": len(members) - len(active),
                "with_profiles": sum(bool(profile_counts[sid]) for sid in active_ids),
                "active_coders": sum(bool(dates_by_student[sid]) for sid in active_ids),
            },
            "classes": {
                "total": len(classes),
                "marked": marked_classes,
                "pending": max(0, len(classes) - marked_classes),
            },
            "attendance": _attendance_view(attendance_totals, threshold=threshold),
            "coding": {
                "profiles": len(profiles),
                "synced_profiles": synced_profiles,
                "activity_days": len(all_activity_days),
                "estimated_rows_excluded": estimated_rows - sum(estimated_intervals.values()),
                "platforms": platform_summaries,
            },
            "members": member_rows,
        }
