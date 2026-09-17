"""Audit trail service."""

from app.models.enums import AuditAction
from app.repositories.system import AuditRepository


class AuditService:
    def __init__(self, db):
        self.repo = AuditRepository(db)

    async def log(
        self,
        action: AuditAction | str,
        user_id: str | None = None,
        role: str | None = None,
        entity: str | None = None,
        entity_id: str | None = None,
        old_data: dict | None = None,
        new_data: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        await self.repo.record(
            {
                "action": action.value
                if isinstance(action, AuditAction)
                else str(action),
                "user_id": user_id,
                "role": role,
                "entity": entity,
                "entity_id": entity_id,
                "old_data": _scrub(old_data or {}),
                "new_data": _scrub(new_data or {}),
                "ip_address": ip_address,
                "user_agent": (user_agent or "")[:300],
            }
        )


SENSITIVE_FIELDS = {
    "password",
    "new_password",
    "current_password",
    "token",
    "reset_token",
    "temporary_password",
    "hash",
}


def _scrub(data: dict) -> dict:
    return {
        k: ("***" if k in SENSITIVE_FIELDS else v)
        for k, v in data.items()
        if k
        not in {
            "password",
            "new_password",
            "current_password",
            "token",
            "reset_token",
            "temporary_password",
        }
    }
