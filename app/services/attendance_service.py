"""Class management and attendance marking/editing with audit trail."""

from datetime import datetime, timezone

from bson import ObjectId

from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.enums import AttendanceStatus, AuditAction
from app.repositories.attendance import AttendanceRepository, ClassRepository
from app.repositories.users import StudentRepository
from app.services.audit_service import AuditService


def oid_safe(value: str) -> ObjectId:
    """Parse a string into a BSON ObjectId, or raise a 400 AppError."""
    try:
        return ObjectId(value)
    except Exception:
        raise AppError("Invalid id format", 400)


class ClassService:
    def __init__(self, db):
        self.db = db
        self.classes = ClassRepository(db)
        self.attendance = AttendanceRepository(db)
        self.audit = AuditService(db)

    @staticmethod
    def _normalize_class_doc(data: dict) -> dict:
        """Convert date/time to BSON-friendly types: date→datetime (midnight UTC), time→HH:MM:SS string."""
        from datetime import date as _date
        from datetime import time as _time

        doc = dict(data)
        # date: date/datetime/ISO string → datetime at midnight UTC
        d = doc.get("date")
        if d is not None:
            if isinstance(d, str):
                try:
                    d = _date.fromisoformat(d[:10])
                except Exception:
                    pass
            if isinstance(d, _date) and not isinstance(d, datetime):
                doc["date"] = datetime.combine(
                    d, datetime.min.time(), tzinfo=timezone.utc
                )
            elif isinstance(d, datetime):
                doc["date"] = d.replace(
                    hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc
                )
        # start_time / end_time: time/ISO string → "HH:MM:SS" string
        for key in ("start_time", "end_time"):
            t = doc.get(key)
            if t is not None:
                if isinstance(t, str):
                    try:
                        t = _time.fromisoformat(t[:8])
                    except Exception:
                        pass
                if isinstance(t, _time):
                    doc[key] = t.strftime("%H:%M:%S")
        return doc

    async def create(self, data: dict, actor: dict, ip=None) -> dict:
        doc = {
            **self._normalize_class_doc(data),
            "created_by": str(actor["_id"]),
            "created_at": datetime.now(timezone.utc),
        }
        created = await self.classes.create(doc)
        await self.audit.log(
            AuditAction.CLASS_CREATED,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="class",
            entity_id=str(created["_id"]),
            new_data={"subject": data.get("subject"), "date": str(data.get("date"))},
            ip_address=ip,
        )
        return created

    async def get(self, class_id: str) -> dict:
        doc = await self.classes.get(class_id)
        if not doc:
            raise NotFoundError("Class not found")
        return doc

    async def update(self, class_id: str, fields: dict, actor: dict, ip=None) -> dict:
        existing = await self.get(class_id)
        clean = {k: v for k, v in fields.items() if v is not None}
        if clean:
            clean = self._normalize_class_doc(clean)
            await self.classes.update(class_id, clean)
        await self.audit.log(
            AuditAction.CLASS_UPDATED,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="class",
            entity_id=class_id,
            old_data={
                "date": str(existing.get("date")),
                "subject": existing.get("subject"),
            },
            new_data={k: str(v) for k, v in clean.items()},
            ip_address=ip,
        )
        return await self.classes.get(class_id)

    async def delete(self, class_id: str, actor: dict, ip=None) -> None:
        await self.get(class_id)
        await self.attendance.delete_for_class(class_id)
        await self.classes.delete(class_id)
        await self.audit.log(
            AuditAction.CLASS_DELETED,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="class",
            entity_id=class_id,
            ip_address=ip,
        )

    @staticmethod
    def serialize(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "date": doc["date"].isoformat()
            if hasattr(doc["date"], "isoformat")
            else str(doc["date"]),
            "start_time": str(doc.get("start_time", "")),
            "end_time": str(doc.get("end_time", "")),
            "course": doc.get("course"),
            "branch": doc.get("branch"),
            "section": doc.get("section"),
            "subject": doc.get("subject"),
            "faculty": doc.get("faculty"),
            "topic": doc.get("topic"),
            "academic_year_id": doc.get("academic_year_id"),
            "batch_id": doc.get("batch_id"),
            "attendance_marked": bool(doc.get("attendance_marked")),
            "created_at": doc.get("created_at").isoformat()
            if isinstance(doc.get("created_at"), datetime)
            else None,
        }


class AttendanceService:
    def __init__(self, db):
        self.db = db
        self.attendance = AttendanceRepository(db)
        self.students = StudentRepository(db)
        self.audit = AuditService(db)

    async def load_roster(self, class_doc: dict) -> list[dict]:
        students = await self.students.find_by_group(
            class_doc["course"],
            class_doc["branch"],
            class_doc["section"],
            class_doc.get("batch_id"),
            class_doc.get("academic_year_id"),
        )
        return [
            {
                "student_id": str(s["_id"]),
                "roll_number": s.get("roll_number", ""),
                "name": f"{s.get('first_name', '')} {s.get('last_name', '')}".strip(),
                "status": "present",
            }
            for s in students
        ]

    async def get_session_view(self, class_id: str) -> dict | None:
        cls = await self._get_class(class_id)
        session = await self.attendance.get_session_by_class(class_id)
        if not session:
            return None
        records = await self.attendance.get_records_for_session(str(session["_id"]))
        by_student = {}
        for r in records:
            by_student[str(r["student_id"])] = r["status"]
        roster = await self.load_roster(cls)
        entries = []
        for entry in roster:
            status = by_student.get(entry["student_id"])
            entries.append({**entry, "status": status or "unmarked"})
        return {
            "class_session_id": str(session["_id"]),
            "marked_by": session.get("marked_by"),
            "updated_at": session["updated_at"].isoformat()
            if isinstance(session.get("updated_at"), datetime)
            else None,
            "records": entries,
        }

    async def save_attendance(
        self,
        class_id: str,
        records: list[dict],
        actor: dict,
        override: bool = False,
        ip=None,
    ) -> dict:
        cls = await self._get_class(class_id)
        existing_session = await self.attendance.get_session_by_class(class_id)
        if existing_session and not override:
            raise ConflictError(
                "Attendance has already been saved for this class. Use edit to change it."
            )

        valid_statuses = {s.value for s in AttendanceStatus}
        student_ids = set()
        for r in records:
            if r["status"] not in valid_statuses:
                raise ConflictError(f"Invalid attendance status '{r['status']}'")
            try:
                student_ids.add(r["student_id"])
            except Exception:
                raise NotFoundError("Unknown student in attendance records")

        session = existing_session or await self.attendance.create_session(
            class_id, str(actor["_id"])
        )
        class_date = cls["date"]
        await self.attendance.save_records(str(session["_id"]), class_date, records)
        action = (
            AuditAction.ATTENDANCE_UPDATED
            if existing_session
            else AuditAction.ATTENDANCE_CREATED
        )
        await self.audit.log(
            action,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="attendance_session",
            entity_id=str(session["_id"]),
            new_data={"class_id": class_id, "count": len(records)},
            ip_address=ip,
        )
        await self._get_classes_collection().update_one(
            {"_id": cls["_id"]}, {"$set": {"attendance_marked": True}}
        )
        return {"saved": True, "records": len(records)}

    async def edit_record(
        self, class_id: str, student_id: str, new_status: str, actor: dict, ip=None
    ) -> None:
        """Edit a single student's status; every change is audited."""
        from app.repositories.base import oid

        cls = await self._get_class(class_id)
        session = await self.attendance.get_session_by_class(class_id)
        if not session:
            raise NotFoundError("No attendance saved for this class")
        if new_status not in {s.value for s in AttendanceStatus}:
            raise ConflictError(f"Invalid status '{new_status}'")
        record = await self.attendance.records.find_one(
            {"class_session_id": session["_id"], "student_id": oid(student_id)}
        )
        old_status = record["status"] if record else "unmarked"
        await self.attendance.save_records(
            str(session["_id"]),
            cls["date"],
            [{"student_id": student_id, "status": new_status}],
        )
        await self.attendance.touch_session(str(session["_id"]))
        student = await self.students.get_by_id(student_id)
        await self.audit.log(
            AuditAction.ATTENDANCE_UPDATED,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="attendance_record",
            entity_id=f"{session['_id']}:{student_id}",
            old_data={
                "student": (student or {}).get("first_name"),
                "status": old_status,
            },
            new_data={"status": new_status},
            ip_address=ip,
        )

    async def _get_class(self, class_id: str):
        cls = await self._get_classes_collection().find_one({"_id": oid_safe(class_id)})
        if not cls:
            raise NotFoundError("Class not found")
        return cls

    def _get_classes_collection(self):
        return self.db.classes
