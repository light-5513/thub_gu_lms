"""Public contact-us endpoint.

Stores the submission in the `contact_messages` collection and emails the
the site administrator (if SMTP is configured). Anonymous, rate-limited,
no auth required.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field

from app.core.deps import get_db
from app.core.errors import AppError
from app.core.rate_limit import client_ip, is_rate_limited
from app.services.email_service import EmailService

router = APIRouter(tags=["public"])


class ContactSubmission(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=10, max_length=4000)


@router.post("/contact")
async def submit_contact(
    payload: ContactSubmission,
    request: Request,
    db=Depends(get_db),
) -> dict:
    # 5 submissions per IP per 10 minutes — plenty for legitimate use,
    # blocks casual scraping.
    limited, retry_after = await is_rate_limited(
        f"contact:{client_ip(request)}", limit=5, window_seconds=600
    )
    if limited:
        raise AppError(
            f"Too many submissions. Please try again in {retry_after} seconds.",
            429,
        )

    now = datetime.now(timezone.utc)
    doc = {
        "name": payload.name.strip(),
        "email": payload.email.lower().strip(),
        "subject": payload.subject.strip(),
        "message": payload.message.strip(),
        "ip": client_ip(request),
        "user_agent": (request.headers.get("user-agent") or "")[:300],
        "created_at": now,
        "status": "new",
    }
    await db.contact_messages.insert_one(doc)

    # Best-effort notification email to the first super admin.
    admin = await db.users.find_one(
        {"role": "SUPER_ADMIN"}, {"email": 1, "full_name": 1}
    )
    if admin and admin.get("email"):
        email_svc = EmailService(db)
        body = (
            f"New contact form submission:\n\n"
            f"Name:    {doc['name']}\n"
            f"Email:   {doc['email']}\n"
            f"Subject: {doc['subject']}\n\n"
            f"Message:\n{doc['message']}\n"
        )
        try:
            await email_svc.send_notification_email(
                admin["email"],
                f"[Contact] {doc['subject']}",
                body,
            )
        except Exception:
            # Email failure must not block the user — message is already saved.
            pass

    return {
        "message": "Thanks! Your message has been received. We'll get back to you soon."
    }
