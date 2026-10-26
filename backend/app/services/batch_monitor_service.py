"""Read-only monitoring of the current members of one batch."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

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

        dates_by_student = defaultdict(set)
        platform_active = defaultdict(set)
        estimated_rows = 0
        if active_ids:
            activity = await self.db.coding_activity.find({
                "student_id": {"$in": active_ids},
                "date": {"$gte": start_date, "$lte": end_date},
            }).to_list(length=None)
            for row in activity:
                if row.get("estimated"):
                    estimated_rows += 1
                    continue
                metrics = row.get("metrics") or {}
                if not any(
                    isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0
                    for value in metrics.values()
                ):
                    continue
                sid = row.get("student_id")
                day = row.get("date")
                if sid not in active_id_set or not isinstance(day, str):
                    continue
                dates_by_student[sid].add(day)
                if row.get("platform"):
                    platform_active[row["platform"]].add(sid)

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
                "estimated_rows_excluded": estimated_rows,
                "platforms": [
                    {
                        "platform": platform,
                        "profiles": len(ids),
                        "active_students": len(platform_active[platform]),
                    }
                    for platform, ids in sorted(platform_profiles.items())
                ],
            },
            "members": member_rows,
        }
