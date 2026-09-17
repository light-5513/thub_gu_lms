"""Email service: Gmail SMTP with HTML templates, retries and delivery logs."""

import logging
import os
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

import aiosmtplib
import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import settings
from app.database.redis import enqueue_job
from app.models.enums import EmailStatus

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
_jinja_env: Environment | None = None


def _env() -> Environment:
    global _jinja_env
    if _jinja_env is None:
        _jinja_env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


class EmailService:
    def __init__(self, db):
        self.db = db
        self.logs = db.email_logs

    # ------------------------------------------------------------- logging
    async def _log(
        self,
        recipient: str,
        subject: str,
        template: str,
        status: EmailStatus,
        error: str | None = None,
    ) -> None:
        try:
            await self.logs.insert_one(
                {
                    "recipient": recipient,
                    "subject": subject,
                    "template": template,
                    "status": status.value,
                    "error": (error or "")[:500],
                    "created_at": datetime.now(timezone.utc),
                }
            )
        except Exception:
            logger.exception("Failed to write email log")

    # ------------------------------------------------------------- sending
    def render(self, template_name: str, **variables) -> tuple[str, str]:
        """Return (html, plain_text) for a template with variables."""
        template = _env().get_template(template_name)
        context = {
            "application_name": settings.APP_NAME,
            "app_url": settings.APP_URL,
            **variables,
        }
        html = template.render(**context)
        # naive plain-text fallback
        import re

        text = re.sub(r"<style[\s\S]*?</style>", "", html)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return html, text

    async def _send_via_resend(
        self,
        recipient: str,
        subject: str,
        html: str,
        text: str,
        template: str,
        api_key: str,
    ) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "from": "LMS <onboarding@resend.dev>",
                        "to": recipient,
                        "subject": subject,
                        "html": html,
                        "text": text,
                    },
                )
                if response.status_code in (200, 201):
                    await self._log(recipient, subject, template, EmailStatus.SENT)
                    return True
                else:
                    error_msg = (
                        f"Resend API error: {response.status_code} {response.text}"
                    )
                    logger.warning(error_msg)
                    await self._log(
                        recipient, subject, template, EmailStatus.FAILED, error_msg
                    )
                    return False
        except Exception as exc:
            logger.warning(f"Resend exception: {exc}")
            await self._log(recipient, subject, template, EmailStatus.FAILED, str(exc))
            return False

    async def send(
        self,
        recipient: str,
        subject: str,
        html: str,
        text: str,
        template: str = "custom",
        phone: str | None = None,
    ) -> bool:
        resend_key = os.environ.get("RESEND_API_KEY")
        email_success = False

        if resend_key:
            email_success = await self._send_via_resend(
                recipient, subject, html, text, template, resend_key
            )
        elif not settings.smtp_configured:
            logger.warning("SMTP not configured; skipping email to %s", recipient)
            await self._log(
                recipient, subject, template, EmailStatus.FAILED, "SMTP not configured"
            )
        else:
            msg = EmailMessage()
            msg["From"] = settings.SMTP_FROM or settings.SMTP_USERNAME
            msg["To"] = recipient
            msg["Subject"] = subject
            msg.set_content(text)
            msg.add_alternative(html, subtype="html")

            last_error = None
            for attempt in range(1, 4):
                try:
                    await aiosmtplib.send(
                        msg,
                        hostname=settings.SMTP_HOST,
                        port=settings.SMTP_PORT,
                        username=settings.SMTP_USERNAME,
                        password=settings.SMTP_PASSWORD,
                        start_tls=settings.SMTP_USE_TLS,
                        timeout=20,
                    )
                    await self._log(recipient, subject, template, EmailStatus.SENT)
                    email_success = True
                    break
                except Exception as exc:
                    last_error = str(exc)
                    logger.warning(
                        "Email attempt %d failed to %s: %s", attempt, recipient, exc
                    )
                    if attempt == 3:
                        await self._log(
                            recipient, subject, template, EmailStatus.FAILED, last_error
                        )

        # Fallback to WhatsApp if email failed or skipped
        if not email_success:
            if not phone:
                # Attempt to look up the phone in the db if not provided explicitly
                student = await self.db.students.find_one({"email": recipient})
                if student and student.get("phone"):
                    phone = student["phone"]

            if phone:
                from app.services.whatsapp_service import WhatsAppService
                wa_text = f"*{subject}*\n\n{text}"
                return await WhatsAppService.send_message(phone, wa_text)
            else:
                logger.info("No phone number available for WhatsApp fallback to %s", recipient)

        return email_success

    # ------------------------------------------------------------- queued helpers
    async def queue(self, task_name: str, **payload) -> bool:
        """Queue an email job on the worker; returns False if worker unavailable."""
        return await enqueue_job(task_name, **payload)

    async def send_invitation_email(
        self, student_name: str, email: str, temporary_password: str, phone: str | None = None
    ) -> bool:
        html, text = self.render(
            "invitation.html",
            student_name=student_name,
            email=email,
            temporary_password=temporary_password,
            login_url=f"{settings.APP_URL}/login",
        )
        return await self.send(
            email, f"You're invited to {settings.APP_NAME}", html, text, "invitation", phone=phone
        )

    async def send_invitation_link_email(self, email: str, setup_url: str, phone: str | None = None) -> bool:
        """Email-only invite: the student completes their own profile via the link."""
        html, text = self.render(
            "invitation.html",
            student_name="there",
            email=email,
            setup_url=setup_url,
            expires_days=7,
        )
        return await self.send(
            email, f"You're invited to {settings.APP_NAME}", html, text, "invitation", phone=phone
        )

    async def send_password_reset_email(
        self, student_name: str, email: str, reset_token: str, phone: str | None = None
    ) -> bool:
        reset_url = f"{settings.APP_URL}/reset-password?token={reset_token}"
        html, text = self.render(
            "password_reset.html",
            student_name=student_name,
            email=email,
            reset_url=reset_url,
            expires_minutes=30,
        )
        return await self.send(
            email,
            f"Reset your {settings.APP_NAME} password",
            html,
            text,
            "password_reset",
            phone=phone
        )

    async def send_account_created_email(self, student_name: str, email: str, phone: str | None = None) -> bool:
        html, text = self.render(
            "account_created.html",
            student_name=student_name,
            email=email,
            login_url=f"{settings.APP_URL}/login",
        )
        return await self.send(
            email, f"Welcome to {settings.APP_NAME}", html, text, "account_created", phone=phone
        )

    async def send_notification_email(
        self, recipient: str, subject: str, body: str, phone: str | None = None
    ) -> bool:
        html, text = self.render(
            "notification.html"
            if (TEMPLATE_DIR / "notification.html").exists()
            else "account_created.html",
            student_name="there",
            email=recipient,
            custom_body=body,
            login_url=f"{settings.APP_URL}/login",
        )
        return await self.send(recipient, subject, html, text, "notification", phone=phone)

    async def send_sync_completed_email(
        self, recipient: str, platform: str, total: int, successful: int, failed: int, phone: str | None = None
    ) -> bool:
        """Notify an admin that a coding-platform sync job has finished."""
        subject = f"Coding sync complete on {platform}: {successful}/{total} succeeded"
        html, text = self.render(
            "sync_completed.html",
            platform=platform,
            total=total,
            successful=successful,
            failed=failed,
        )
        return await self.send(recipient, subject, html, text, "sync_completed", phone=phone)
