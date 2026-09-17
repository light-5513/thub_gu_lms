"""Admin settings + audit log viewing."""

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from app.core.deps import get_db, require_admin, require_staff
from app.models.enums import AuditAction
from app.repositories.system import AuditRepository
from app.schemas.settings import SettingsUpdate
from app.services.audit_service import AuditService
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/admin", tags=["admin-settings"])


@router.get("/settings")
async def get_settings(user=Depends(require_admin), db=Depends(get_db)):
    service = SettingsService(db)
    return await service.all()


@router.put("/settings")
async def update_settings(
    payload: SettingsUpdate,
    request: Request,
    user=Depends(require_admin),
    db=Depends(get_db),
):
    from app.core.rate_limit import client_ip

    service = SettingsService(db)
    old = await service.all()
    updated = await service.update(
        payload.model_dump(exclude_unset=True), changed_by=str(user["_id"])
    )
    await AuditService(db).log(
        AuditAction.SETTINGS_CHANGED,
        user_id=str(user["_id"]),
        role=user["role"],
        entity="settings",
        old_data={k: old.get(k) for k in payload.model_dump(exclude_unset=True).keys()},
        new_data=payload.model_dump(exclude_unset=True),
        ip_address=client_ip(request),
    )
    return {"message": "Settings saved", "settings": updated}


@router.get("/audit-logs")
async def audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    action: str | None = None,
    user_id: str | None = None,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    filters: dict[str, Any] = {}
    if action:
        filters["action"] = action.upper()
    if user_id:
        try:
            from bson import ObjectId

            filters["user_id"] = ObjectId(user_id)
        except Exception:
            pass
    repo = AuditRepository(db)
    docs, total = await repo.list(filters, page, page_size)
    # Enrich with actor emails
    items = []
    for d in docs:
        actor_email = None
        uid = d.get("user_id")
        if uid:
            u = await db.users.find_one({"_id": uid}, {"email": 1})
            actor_email = (u or {}).get("email")
        items.append(
            {
                "id": str(d["_id"]),
                "action": d.get("action"),
                "user_email": actor_email,
                "role": d.get("role"),
                "entity": d.get("entity"),
                "entity_id": str(d.get("entity_id")) if d.get("entity_id") else None,
                "old_data": d.get("old_data"),
                "new_data": d.get("new_data"),
                "ip_address": d.get("ip_address"),
                "created_at": d["created_at"].isoformat()
                if d.get("created_at")
                else None,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
