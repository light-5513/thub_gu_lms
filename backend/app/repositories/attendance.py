"""Class sessions and attendance data access."""

from datetime import datetime, timezone
from typing import Any

from app.repositories.base import oid


class ClassRepository:
    def __init__(self, db):
        self.db = db
        self.col = db.classes

    async def create(self, data: dict) -> dict:
        result = await self.col.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    async def get(self, class_id: str) -> dict | None:
        try:
            return await self.col.find_one({"_id": oid(class_id)})
        except Exception:
            return None

    async def update(self, class_id: str, update: dict) -> None:
        await self.col.update_one({"_id": oid(class_id)}, {"$set": update})

    async def delete(self, class_id: str) -> None:
        await self.col.delete_one({"_id": oid(class_id)})

    def build_filters(
        self,
        course=None,
        branch=None,
        section=None,
        batch_id=None,
        academic_year_id=None,
        date_from=None,
        date_to=None,
    ) -> dict:
        filters: dict[str, Any] = {}
        if course:
            filters["course"] = course
        if branch:
            filters["branch"] = branch
        if section:
            filters["section"] = section
        if batch_id:
            filters["batch_id"] = batch_id
        if academic_year_id:
            filters["academic_year_id"] = academic_year_id
        if date_from or date_to:
            date_filter: dict[str, Any] = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            filters["date"] = date_filter
        return filters

    async def list(self, filters=None, page=1, page_size=20) -> tuple[list[dict], int]:
        filters = filters or {}
        total = await self.col.count_documents(filters)
        cursor = (
            self.col.find(filters)
            .sort([("date", -1), ("start_time", 1)])
            .skip((max(page, 1) - 1) * page_size)
            .limit(page_size)
        )
        return await cursor.to_list(length=page_size), total

    async def count_today(self) -> int:
        today = datetime.now(timezone.utc).date()
        start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
        end = datetime(
            today.year, today.month, today.day, 23, 59, 59, tzinfo=timezone.utc
        )
        return await self.col.count_documents({"date": {"$gte": start, "$lte": end}})


class AttendanceRepository:
    def __init__(self, db):
        self.db = db
        self.sessions = db.attendance_sessions
        self.records = db.attendance_records

    async def get_session_by_class(self, class_id: str) -> dict | None:
        return await self.sessions.find_one({"class_id": oid(class_id)})

    async def get_session(self, session_id: str) -> dict | None:
        try:
            return await self.sessions.find_one({"_id": oid(session_id)})
        except Exception:
            return None

    async def create_session(self, class_id: str, marked_by: str) -> dict:
        doc = {
            "class_id": oid(class_id),
            "marked_by": marked_by,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await self.sessions.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def touch_session(self, session_id: str) -> None:
        await self.sessions.update_one(
            {"_id": oid(session_id)},
            {"$set": {"updated_at": datetime.now(timezone.utc)}},
        )

    async def save_records(
        self, session_id: str, class_date, records: list[dict]
    ) -> None:
        """Upsert one record per student per session (unique student+session)."""
        from pymongo import UpdateOne

        bulk = []
        for r in records:
            bulk.append(
                UpdateOne(
                    {
                        "student_id": oid(r["student_id"]),
                        "class_session_id": oid(session_id),
                    },
                    {
                        "$set": {
                            "student_id": oid(r["student_id"]),
                            "class_session_id": oid(session_id),
                            "status": r["status"],
                            "date": class_date,
                            "updated_at": datetime.now(timezone.utc),
                        },
                        "$setOnInsert": {"created_at": datetime.now(timezone.utc)},
                    },
                    upsert=True,
                )
            )
        if bulk:
            await self.records.bulk_write(bulk, ordered=False)

    async def get_records_for_session(self, session_id: str) -> list[dict]:
        cursor = self.records.find({"class_session_id": oid(session_id)})
        return await cursor.to_list(length=5000)

    async def get_records_for_student(self, student_id: str) -> list[dict]:
        cursor = self.records.find({"student_id": oid(student_id)}).sort([("date", 1)])
        return await cursor.to_list(length=20000)

    async def count_student_stats(self, student_id: str) -> dict[str, int]:
        pipeline = [
            {"$match": {"student_id": oid(student_id)}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
        rows = await self.records.aggregate(pipeline).to_list(length=10)
        stats = {row["_id"]: row["count"] for row in rows}
        present = stats.get("present", 0)
        late = stats.get("late", 0)
        leave = stats.get("leave", 0)
        absent = stats.get("absent", 0)
        total = present + late + leave + absent
        attended = (
            present + late
        )  # late counts attended; leave configurable at service layer
        pct = round((attended / total) * 100, 1) if total else None
        return {
            "present": present,
            "late": late,
            "leave": leave,
            "absent": absent,
            "total": total,
            "attended": attended,
            "percentage": pct,
        }

    async def delete_for_class(self, class_id: str) -> None:
        session = await self.get_session_by_class(class_id)
        if session:
            await self.records.delete_many({"class_session_id": session["_id"]})
            await self.sessions.delete_one({"_id": session["_id"]})
