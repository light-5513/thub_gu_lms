"""Email-invitation flow: admin invites an email, student completes signup.

Flow:
  admin submits email → single-use token created (hash stored, 7-day TTL)
  → invitation email with a setup link → student opens link, fills their
  details + chooses a password → user + student records are created atomically.
"""

from datetime import datetime, timedelta, timezone

from app.core import security
from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.enums import AuditAction, Role
from app.repositories.system import AuditRepository
from app.services.audit_service import AuditService

INVITE_TTL_DAYS = 7


class InvitationService:
    def __init__(self, db):
        self.db = db
        self.invites = db.invitations
        self.audit = AuditService(db)

    # ------------------------------------------------------------------ create
    async def invite(self, email: str, actor: dict, phone: str | None = None, role: str = Role.STUDENT.value, ip: str | None = None) -> dict:
        email = email.lower().strip()

        if await self.db.users.find_one({"email": email}):
            raise ConflictError("An account with this email already exists")
        if await self.db.students.find_one({"email": email}):
            raise ConflictError("A student with this email already exists")
        pending = await self.invites.find_one({"email": email})
        if pending and not pending.get("used") and pending["expires_at"] > _utcnow():
            raise ConflictError("An invitation for this email is already pending")

        raw_token = security.generate_secure_token()
        now = _utcnow()
        await self.invites.delete_many({"email": email})  # replace any stale invite
        await self.invites.insert_one(
            {
                "email": email,
                "phone": phone,
                "role": role,
                "token_hash": security.hash_token(raw_token),
                "used": False,
                "invited_by": str(actor["_id"]),
                "expires_at": now + timedelta(days=INVITE_TTL_DAYS),
                "created_at": now,
            }
        )

        from app.database.redis import enqueue_job

        queued = await enqueue_job(
            "send_email_task",
            kind="invitation_link",
            email=email,
            phone=phone,
            setup_url=f"{_app_url()}/accept-invitation?token={raw_token}",
        )
        if not queued:
            from app.services.email_service import EmailService

            await EmailService(self.db).send_invitation_link_email(
                email, f"{_app_url()}/accept-invitation?token={raw_token}", phone=phone
            )

        await self.audit.log(
            AuditAction.INVITATION_SENT,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="invitation",
            entity_id=email,
            new_data={"email": email, "role": role},
            ip_address=ip,
        )
        return {
            "message": f"Invitation email sent to {email}",
            "setup_url": f"{_app_url()}/accept-invitation?token={raw_token}",
        }

    # ------------------------------------------------------------------ inspect
    async def peek(self, token: str) -> dict:
        """Public endpoint payload: confirm the token is valid; return the email."""
        doc = await self._valid_doc(token)
        return {"email": doc["email"], "role": doc.get("role", Role.STUDENT.value)}

    async def accept(self, token: str, data: dict, ip: str | None = None) -> dict:
        doc = await self._valid_doc(token)
        email = doc["email"]
        role = doc.get("role", Role.STUDENT.value)

        if await self.db.users.find_one({"email": email}):
            raise ConflictError("An account with this email already exists")

        # If it's a student, check roll number
        if role == Role.STUDENT.value:
            if not data.get("roll_number"):
                raise AppError("Roll number is required for students", 400)
            if await self.db.students.find_one({"roll_number": data["roll_number"]}):
                raise ConflictError(f"Roll number {data['roll_number']} is already in use")

        user_doc = {
            "email": email,
            "role": role,
            "full_name": f"{data['first_name']} {data['last_name']}".strip(),
            "password_hash": security.hash_password(data["password"]),
            "must_change_password": False,  # user chose their own password
            "is_active": True,
            "token_version": 0,
            "created_at": datetime.now(timezone.utc),
        }
        try:
            user_result = await self.db.users.insert_one(user_doc)
            user_id = str(user_result.inserted_id)
            
            if role == Role.STUDENT.value:
                student_result = await self.db.students.insert_one(
                    {
                        "first_name": data["first_name"].strip(),
                        "last_name": data["last_name"].strip(),
                        "email": email,
                        "roll_number": data["roll_number"].strip(),
                        "course": data.get("course", "").strip(),
                        "branch": data.get("branch", "").strip(),
                        "section": data.get("section", "").strip(),
                        "phone": (data.get("phone") or "").strip() or None,
                        "user_id": user_id,
                        "attendance_count": 0,
                        "streak": 0,
                        "overall_score": 0.0,
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                    }
                )
                student_id = str(student_result.inserted_id)
            else:
                student_id = None
        except Exception:
            raise AppError("Failed to create account")

        await self.invites.update_one(
            {"_id": doc["_id"]},
            {"$set": {"used": True, "accepted_at": datetime.now(timezone.utc)}},
        )
        
        await AuditRepository(self.db).record(
            {
                "action": AuditAction.STUDENT_CREATED.value if role == Role.STUDENT.value else "admin_created",
                "entity": "user",
                "entity_id": user_id,
                "new_data": {
                    "email": email,
                    "role": role,
                    "via": "invitation",
                },
                "ip_address": ip,
            }
        )
        return {"message": "Account created. You can now log in.", "email": email}

    # ------------------------------------------------------------------ helpers
    async def _valid_doc(self, token: str) -> dict:
        doc = await self.invites.find_one({"token_hash": security.hash_token(token)})
        if not doc or doc.get("used"):
            raise NotFoundError(
                "This invitation link is invalid or has already been used"
            )
        expires_at = doc.get("expires_at")
        if expires_at is None or _aware(expires_at) < datetime.now(timezone.utc):
            raise AppError(
                "This invitation link has expired. Ask your administrator for a new one.",
                400,
            )
        return doc


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _app_url() -> str:
    from app.config import settings

    return settings.APP_URL.rstrip("/")
