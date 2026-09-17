"""Student lifecycle: creation with invitation flow, updates, listing."""

from datetime import datetime, timezone

from app.core import security
from app.core.errors import ConflictError, NotFoundError
from app.models.enums import AuditAction, Role
from app.repositories.users import StudentRepository, UserRepository
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService


class StudentService:
    def __init__(self, db):
        self.db = db
        self.students = StudentRepository(db)
        self.users = UserRepository(db)
        self.auth = AuthService(db)
        self.audit = AuditService(db)

    async def create_student(
        self, data: dict, created_by: dict, ip=None, user_agent=None
    ) -> dict:
        email = data["email"].lower().strip()
        if await self.students.get_by_email(email):
            raise ConflictError("A student with this email already exists")
        if await self.students.get_by_roll(data["roll_number"]):
            raise ConflictError(f"Roll number {data['roll_number']} is already in use")

        temp_password = security.generate_temp_password()

        # User account (only hash is stored)
        user = await self.auth.create_user_for_student(
            email, Role.STUDENT, temp_password
        )

        try:
            student = await self.students.create(
                {
                    **data,
                    "email": email,
                    "user_id": str(user["_id"]),
                    "status": "active",
                    "created_by": str(created_by["_id"]),
                    "created_at": datetime.now(timezone.utc),
                }
            )
        except Exception:
            await self.db.users.delete_one({"_id": user["_id"]})
            raise

        await self.audit.log(
            AuditAction.STUDENT_CREATED,
            user_id=str(created_by["_id"]),
            role=created_by["role"],
            entity="student",
            entity_id=str(student["_id"]),
            new_data={"email": email, "roll_number": data["roll_number"]},
            ip_address=ip,
            user_agent=user_agent,
        )

        # Queue the invitation email (worker); fall back inline if no worker.
        from app.database.redis import enqueue_job

        queued = await enqueue_job(
            "send_email_task",
            kind="invitation",
            student_name=f"{data['first_name']} {data['last_name']}",
            email=email,
            temporary_password=temp_password,
        )
        if not queued:
            await self.auth.email.send_invitation_email(
                f"{data['first_name']} {data['last_name']}", email, temp_password
            )

        return {"student": student, "temporary_password": None}  # never echo password

    async def resend_invitation(self, student_id: str, actor: dict, ip=None) -> dict:
        student = await self.students.get_by_id(student_id)
        if not student:
            raise NotFoundError("Student not found")
        user = (
            await self.users.get_by_id(student.get("user_id"))
            if student.get("user_id")
            else None
        )
        if not user:
            raise NotFoundError("Student has no user account to invite")

        temp_password = security.generate_temp_password()
        await self.auth.reset_student_account(str(user["_id"]), temp_password)
        await self.audit.log(
            AuditAction.INVITATION_RESENT,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="student",
            entity_id=student_id,
            ip_address=ip,
        )

        from app.database.redis import enqueue_job

        queued = await enqueue_job(
            "send_email_task",
            kind="invitation",
            student_name=f"{student['first_name']} {student['last_name']}",
            email=student["email"],
            temporary_password=temp_password,
        )
        if not queued:
            await self.auth.email.send_invitation_email(
                f"{student['first_name']} {student['last_name']}",
                student["email"],
                temp_password,
            )
        return {"resent": True}

    async def reset_account(self, student_id: str, actor: dict, ip=None) -> dict:
        """Generate a fresh temporary password; student must change at next login."""
        student = await self.students.get_by_id(student_id)
        if not student or not student.get("user_id"):
            raise NotFoundError("Student account not found")
        temp_password = security.generate_temp_password()
        await self.auth.reset_student_account(student["user_id"], temp_password)
        await self.audit.log(
            AuditAction.PASSWORD_RESET,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="student",
            entity_id=student_id,
            ip_address=ip,
        )
        from app.database.redis import enqueue_job

        queued = await enqueue_job(
            "send_email_task",
            kind="invitation",
            student_name=f"{student['first_name']} {student['last_name']}",
            email=student["email"],
            temporary_password=temp_password,
        )
        if not queued:
            await self.auth.email.send_invitation_email(
                f"{student['first_name']} {student['last_name']}",
                student["email"],
                temp_password,
            )
        return {"reset": True}

    async def update_student(
        self, student_id: str, fields: dict, actor: dict, ip=None, user_agent=None
    ) -> dict:
        student = await self.students.get_by_id(student_id)
        if not student:
            raise NotFoundError("Student not found")
        clean = {k: v for k, v in fields.items() if v is not None}
        status = clean.pop("status", None)
        if clean.get("roll_number") and clean["roll_number"] != student["roll_number"]:
            existing = await self.students.get_by_roll(clean["roll_number"])
            if existing and str(existing["_id"]) != student_id:
                raise ConflictError(
                    f"Roll number {clean['roll_number']} is already in use"
                )
        if clean:
            await self.students.update(student_id, clean)
        if status in ("active", "inactive"):
            await self.students.update(student_id, {"status": status})
            if status == "inactive":
                await self.audit.log(
                    AuditAction.STUDENT_DEACTIVATED,
                    user_id=str(actor["_id"]),
                    role=actor["role"],
                    entity="student",
                    entity_id=student_id,
                    ip_address=ip,
                )
        await self.audit.log(
            AuditAction.STUDENT_UPDATED,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="student",
            entity_id=student_id,
            old_data={k: student.get(k) for k in clean},
            new_data=clean,
            ip_address=ip,
            user_agent=user_agent,
        )
        return await self.students.get_by_id(student_id)

    async def delete_student(self, student_id: str, actor: dict, ip=None) -> None:
        student = await self.students.get_by_id(student_id)
        if not student:
            raise NotFoundError("Student not found")
        await self.students.delete(student_id)
        if student.get("user_id"):
            await self.users.update(student["user_id"], {"is_active": False})
        await self.audit.log(
            AuditAction.STUDENT_DEACTIVATED,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="student",
            entity_id=student_id,
            ip_address=ip,
        )

    @staticmethod
    def serialize(doc: dict, extras: dict | None = None) -> dict:
        out = {
            "id": str(doc["_id"]),
            "user_id": doc.get("user_id"),
            "first_name": doc.get("first_name", ""),
            "last_name": doc.get("last_name", ""),
            "email": doc.get("email"),
            "roll_number": doc.get("roll_number"),
            "course": doc.get("course"),
            "branch": doc.get("branch"),
            "section": doc.get("section"),
            "phone": doc.get("phone"),
            "batch_id": doc.get("batch_id"),
            "academic_year_id": doc.get("academic_year_id"),
            "status": doc.get("status", "active"),
            "created_at": doc.get("created_at").isoformat()
            if isinstance(doc.get("created_at"), datetime)
            else None,
        }
        if extras:
            out.update(extras)
        return out

    async def list_students(
        self,
        page=1,
        page_size=20,
        search=None,
        course=None,
        branch=None,
        section=None,
        batch_id=None,
        academic_year_id=None,
        status=None,
        sort_by="first_name",
        sort_dir=1,
    ):
        filters = self.students.build_filters(
            search, course, branch, section, batch_id, academic_year_id, status
        )
        docs, total = await self.students.list(
            filters, page, page_size, sort_by or "first_name", sort_dir
        )
        return [self.serialize(d) for d in docs], total
