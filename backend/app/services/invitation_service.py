"""Email and WhatsApp invitations share a secure student setup link."""

import asyncio
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.core import security
from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.enums import AuditAction, Role
from app.repositories.system import AuditRepository
from app.services.audit_service import AuditService
from app.services.whatsapp_service import WhatsAppService

INVITE_TTL_DAYS = 7


class InvitationService:
    def __init__(self, db):
        self.db = db
        self.invites = db.invitations
        self.audit = AuditService(db)

    # ------------------------------------------------------------------ create
    async def invite(
        self,
        email: str,
        actor: dict,
        phone: str | None = None,
        role: str = Role.STUDENT.value,
        ip: str | None = None,
        channels: list[str] | None = None,
    ) -> dict:
        email = email.lower().strip()
        requested_channels = list(dict.fromkeys(channels or ["email"]))
        if not requested_channels or set(requested_channels) - {"email", "whatsapp"}:
            raise AppError("Select email, WhatsApp, or both delivery channels", 400)
        if "whatsapp" in requested_channels and (
            not phone or not 8 <= sum(char.isdigit() for char in phone) <= 15
        ):
            raise AppError("Enter a WhatsApp number with country code, such as +919876543210", 400)

        if await self.db.users.find_one({"email": email}):
            raise ConflictError("An account with this email already exists")
        if await self.db.students.find_one({"email": email}):
            raise ConflictError("A student with this email already exists")
        pending = await self.invites.find_one({"email": email})
        if pending and not pending.get("used") and pending["expires_at"] > _utcnow():
            raise ConflictError("An invitation for this email is already pending")

        raw_token = security.generate_secure_token()
        now = _utcnow()
        expires_at = now + timedelta(days=INVITE_TTL_DAYS)
        await self.invites.delete_many({"email": email})  # replace any stale invite
        invitation = await self.invites.insert_one(
            {
                "email": email,
                "phone": phone,
                "role": role,
                "token_hash": security.hash_token(raw_token),
                "used": False,
                "email_status": "queued" if "email" in requested_channels else None,
                "whatsapp_status": "queued" if "whatsapp" in requested_channels else None,
                "invited_by": str(actor["_id"]),
                "expires_at": expires_at,
                "created_at": now,
            }
        )

        setup_url = f"{_app_url()}/accept-invitation?token={raw_token}"
        message = (
            f"You're invited to create your {settings.APP_NAME} student account. "
            f"Complete registration using this link: {setup_url} "
            f"The link can be used once and expires in {INVITE_TTL_DAYS} days."
        )

        async def queue_email() -> tuple[str, str | None]:
            try:
                from app.database.redis import enqueue_job

                queued = await enqueue_job(
                    "send_email_task",
                    kind="invitation_link",
                    email=email,
                    phone=None,
                    setup_url=setup_url,
                    invitation_id=str(invitation.inserted_id),
                )
                if queued:
                    return "queued", None

                from app.services.email_service import EmailService

                sent = await EmailService(self.db).send_invitation_link_email(
                    email, setup_url
                )
                return ("sent", None) if sent else (
                    "failed",
                    "Email could not be sent; check the email delivery logs and configuration.",
                )
            except Exception as exc:
                from app.core.logging import get_logger

                get_logger(__name__).exception("Invitation email could not be queued or sent")
                return (
                    "failed",
                    "Email could not be queued or sent; check email delivery logs and configuration.",
                )

        async def queue_whatsapp() -> tuple[str, str | None, str | None]:
            try:
                job_id = await WhatsAppService.queue_invitation(
                    phone or "",
                    message,
                    invitation_id=str(invitation.inserted_id),
                    expires_at=expires_at,
                )
                if job_id:
                    return "queued", job_id, None
                return "failed", None, "WhatsApp could not queue the invitation."
            except Exception as exc:
                from app.core.logging import get_logger

                get_logger(__name__).exception("WhatsApp invitation could not be queued")
                return "failed", None, "WhatsApp could not queue the invitation."

        email_status = None
        email_error = None
        whatsapp_status = None
        whatsapp_error = None
        whatsapp_job_id = None
        pending = []
        if "email" in requested_channels:
            pending.append(("email", queue_email()))
        if "whatsapp" in requested_channels:
            pending.append(("whatsapp", queue_whatsapp()))
        results = await asyncio.gather(*(task for _, task in pending))
        for (channel, _), result in zip(pending, results):
            if channel == "email":
                email_status, email_error = result
            else:
                whatsapp_status, whatsapp_job_id, whatsapp_error = result

        successful = any(status in {"queued", "sent"} for status in (email_status, whatsapp_status))
        if not successful:
            await self.invites.delete_one({"_id": invitation.inserted_id})
            details = "; ".join(error for error in (email_error, whatsapp_error) if error)
            raise AppError(
                details or "The invitation could not be sent through the selected channels.",
                503,
            )

        delivery_update = {}
        if whatsapp_job_id:
            delivery_update["whatsapp_job_id"] = whatsapp_job_id
        # Queued states may already have changed to sent in their workers; avoid
        # overwriting a faster worker result. Only persist inline outcomes here.
        if email_status in {"sent", "failed"}:
            delivery_update["email_status"] = email_status
            delivery_update["email_error"] = email_error
        if whatsapp_status == "failed":
            delivery_update["whatsapp_status"] = whatsapp_status
            delivery_update["whatsapp_error"] = whatsapp_error
        if delivery_update:
            await self.invites.update_one(
                {"_id": invitation.inserted_id},
                {"$set": delivery_update},
            )

        channel_results = {
            "email": email_status,
            "whatsapp": whatsapp_status,
        }
        parts = []
        if email_status:
            parts.append(f"Email {email_status}")
        if whatsapp_status:
            parts.append(f"WhatsApp {whatsapp_status}")
        partial = any(status == "failed" for status in (email_status, whatsapp_status))

        await self.audit.log(
            AuditAction.INVITATION_SENT,
            user_id=str(actor["_id"]),
            role=actor["role"],
            entity="invitation",
            entity_id=email,
            new_data={"email": email, "role": role, "channels": channel_results},
            ip_address=ip,
        )
        return {
            "message": "; ".join(parts) + f" for {email}.",
            "channels": channel_results,
            "partial": partial,
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
                        "status": "active",
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
