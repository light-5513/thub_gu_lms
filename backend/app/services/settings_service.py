"""Database-backed application settings with safe defaults."""

from typing import Any

from app.repositories.system import SettingsRepository

DEFAULTS: dict[str, Any] = {
    "institution_name": "My Institution",
    "logo_url": None,
    "academic_year": "2025-26",
    "attendance_threshold": 75.0,
    "leaderboard_weights": {"attendance": 0.30, "coding": 0.50, "streak": 0.20},
    "streak_rules": {
        "late_counts_as_present": True,
        "leave_breaks_streak": False,
        "absent_breaks_streak": True,
    },
    "late_rules": {"late_counts_as_present": True, "late_penalty_score": 0.5},
    "leave_rules": {"leave_counts_absent": False},
    "coding_sync_settings": {
        "timeout_seconds": 15,
        "max_retries": 3,
        "retry_delay_seconds": 2,
        "request_delay_ms": 250,
        "concurrency": 4,
    },
    "timezone": "Asia/Kolkata",
}


class SettingsService:
    def __init__(self, db):
        self.repo = SettingsRepository(db)
        self._cache: dict[str, Any] = {}

    async def all(self) -> dict:
        doc = await self.repo.get()
        merged = {**DEFAULTS}
        doc.pop("_id", None)
        doc.pop("key", None)
        doc.pop("created_at", None)
        doc.pop("updated_at", None)
        for key, value in doc.items():
            merged[key] = value
        return merged

    async def get(self, key: str, default: Any = None) -> Any:
        settings = await self.all()
        return settings.get(key, default)

    async def update(self, fields: dict, changed_by: str = "system") -> dict:
        old = await self.all()
        allowed = set(DEFAULTS.keys())
        clean = {k: v for k, v in fields.items() if k in allowed}
        await self.repo.update(clean)
        await self.repo.push_history(old, clean, changed_by)
        return await self.all()

    async def streak_rules(self) -> dict:
        return await self.get("streak_rules", DEFAULTS["streak_rules"])

    async def weights(self) -> dict:
        return await self.get("leaderboard_weights", DEFAULTS["leaderboard_weights"])

    async def attendance_threshold(self) -> float:
        return float(await self.get("attendance_threshold", 75.0))

    async def sync_settings(self) -> dict:
        return {
            **DEFAULTS["coding_sync_settings"],
            **(await self.get("coding_sync_settings", {})),
        }


def get_settings_service(db) -> SettingsService:
    return SettingsService(db)
