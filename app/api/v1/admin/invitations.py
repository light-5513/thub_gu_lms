"""Invitations: admin invites by email (single or bulk paste); students complete their own profile."""

import asyncio
from datetime import datetime, timezone
from typing import Any

import bson
from fastapi import APIRouter, Depends, Request

from app.core.deps import get_db, require_admin
from app.core.errors import AppError
from app.core.rate_limit import client_ip, is_rate_limited
from app.models.enums import (  # EmailStatus mirrors email_logs vocabulary
    AuditAction,
)
from app.schemas.auth import BulkInviteRequest, InviteRequest
from app.services.audit_service import AuditService
from app.services.invitation_service import InvitationService

router = APIRouter(prefix="/admin/invitations", tags=["admin-invitations"])


@router.post("")
async def invite_student(
    payload: InviteRequest,
    request: Request,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    service = InvitationService(db)
    return await service.invite(payload.email, user, phone=payload.phone, role=payload.role, ip=client_ip(request))


@router.post("/bulk")
async def bulk_invite(
    payload: BulkInviteRequest,
    request: Request,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    """Invite many emails at once. One failure never stops the batch."""
    limited, retry_after = await is_rate_limited(
        f"bulk-invite:{client_ip(request)}", limit=10, window_seconds=600
    )
    if limited:
        raise AppError(
            f"Too many bulk invites. Try again in {retry_after} seconds.", 429
        )

    service = InvitationService(db)
    results: list[dict] = []
    seen: set = set()

    for raw in payload.emails:
        email = str(raw).lower().strip()
        if not email:
            continue
        if email in seen:
            results.append(
                {"email": email, "ok": False, "message": "Duplicate in your list"}
            )
            continue
        seen.add(email)
        try:
            res = await service.invite(email, user, role=payload.role, ip=client_ip(request))
            results.append(
                {
                    "email": email,
                    "ok": True,
                    "message": "Invitation sent",
                    "setup_url": res.get("setup_url"),
                }
            )
        except AppError as exc:
            # Already registered / already pending — skip without aborting the batch.
            asyncio.ensure_future(
                AuditService(db).log(
                    AuditAction.INVITATION_SENT,
                    user_id=str(user["_id"]),
                    role=user["role"],
                    entity="invitation",
                    entity_id=email,
                    new_data={"email": email, "skipped": exc.message},
                )
            )
            results.append({"email": email, "ok": False, "message": exc.message})
        except Exception:
            results.append({"email": email, "ok": False, "message": "Failed to send"})

    sent = sum(1 for r in results if r["ok"])
    return {
        "total": len(results),
        "sent": sent,
        "failed": len(results) - sent,
        "results": results,
    }


@router.get("/pending")
async def pending_invitations(user=Depends(require_admin), db=Depends(get_db)):
    """List pending (unused, unexpired) invitations for visibility."""
    cursor = (
        db.invitations.find(
            {
                "used": False,
                "expires_at": {"$gt": datetime.now(timezone.utc).replace(tzinfo=None)},
            }
        )
        .sort([("created_at", -1)])
        .limit(200)
    )
    items: list[Any] = []
    async for doc in cursor:
        items.append(
            {
                "id": str(doc["_id"]),
                "email": doc["email"],
                "created_at": _iso(doc.get("created_at")),
                "expires_at": _iso(doc.get("expires_at")),
            }
        )
    return {"items": items}


@router.delete("/{invitation_id}")
async def revoke_invitation(
    invitation_id: str, user=Depends(require_admin), db=Depends(get_db)
):
    try:
        result = await db.invitations.delete_one({"_id": bson.ObjectId(invitation_id)})
    except Exception:
        raise AppError("Invalid invitation id", 400)
    if result.deleted_count == 0:
        raise AppError("Invitation not found", 404)
    return {"message": "Invitation revoked"}


def _iso(dt) -> Any:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return None
