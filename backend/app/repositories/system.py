"""Leaderboard scores/snapshots, audit logs, settings, tokens data access."""

from datetime import datetime, timedelta, timezone

from app.repositories.base import oid


class LeaderboardRepository:
    def __init__(self, db):
        self.db = db
        self.scores = db.leaderboard_scores
        self.snapshots = db.leaderboard_snapshots

    async def replace_scores(self, entries: list[dict]) -> None:
        """Replace overall + per-platform scores for all students."""
        await self.scores.delete_many({})
        if entries:
            await self.scores.insert_many(entries)

    async def save_snapshot(self, payload: dict) -> dict:
        doc = {"created_at": datetime.now(timezone.utc), **payload}
        result = await self.snapshots.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def latest_snapshot(self) -> dict | None:
        return await self.snapshots.find_one(sort=[("created_at", -1)])

    async def top_scores(
        self, platform: str = "overall", limit: int = 100
    ) -> list[dict]:
        cursor = (
            self.scores.find({"platform": platform}).sort([("score", -1)]).limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def student_score(
        self, student_id: str, platform: str = "overall"
    ) -> dict | None:
        return await self.scores.find_one(
            {"student_id": oid(student_id), "platform": platform}
        )

    async def rank_of(self, student_id: str, platform: str = "overall") -> int | None:
        higher = await self.scores.count_documents(
            {
                "platform": platform,
                "score": {"$gt": 0},
                "student_id": {"$ne": oid(student_id)},
            }
        )
        own = await self.scores.find_one(
            {"student_id": oid(student_id), "platform": platform}
        )
        if not own:
            return None
        return higher + 1

    async def count_scores(self, platform: str = "overall") -> int:
        return await self.scores.count_documents({"platform": platform})


class AuditRepository:
    def __init__(self, db):
        self.db = db
        self.col = db.audit_logs

    async def record(self, entry: dict) -> None:
        entry = dict(entry)
        if "user_id" in entry and isinstance(entry["user_id"], str):
            try:
                entry["user_id"] = oid(entry["user_id"])
            except Exception:
                pass
        entry.setdefault("created_at", datetime.now(timezone.utc))
        # Strip sensitive fields defensively.
        for k in ("password", "new_password", "token", "reset_token"):
            entry.pop(k, None)
        await self.col.insert_one(entry)

    async def list(self, filters=None, page=1, page_size=50) -> tuple[list[dict], int]:
        filters = filters or {}
        total = await self.col.count_documents(filters)
        cursor = (
            self.col.find(filters)
            .sort([("created_at", -1)])
            .skip((max(page, 1) - 1) * page_size)
            .limit(page_size)
        )
        return await cursor.to_list(length=page_size), total


class SettingsRepository:
    DEFAULTS_KEY = "app"

    def __init__(self, db):
        self.db = db
        self.col = db.settings

    async def get(self) -> dict:
        doc = await self.col.find_one({"key": self.DEFAULTS_KEY})
        return doc or {}

    async def update(self, fields: dict) -> dict:
        now = datetime.now(timezone.utc)
        await self.col.update_one(
            {"key": self.DEFAULTS_KEY},
            {
                "$set": {**fields, "updated_at": now},
                "$setOnInsert": {"key": self.DEFAULTS_KEY, "created_at": now},
            },
            upsert=True,
        )
        return await self.get()

    async def history(self, limit: int = 50) -> list[dict]:
        col = self.db.settings_history
        return (
            await col.find()
            .sort([("changed_at", -1)])
            .limit(limit)
            .to_list(length=limit)
        )

    async def push_history(
        self, old_data: dict, new_data: dict, changed_by: str
    ) -> None:
        await self.db.settings_history.insert_one(
            {
                "old_data": old_data,
                "new_data": new_data,
                "changed_by": changed_by,
                "changed_at": datetime.now(timezone.utc),
            }
        )


class PasswordResetTokenRepository:
    EXPIRY_MINUTES = 30

    def __init__(self, db):
        self.db = db
        self.col = db.password_reset_tokens

    async def create(self, user_id: str, token_hash: str) -> None:
        now = datetime.now(timezone.utc)
        # Invalidate previous tokens for the user (single active token).
        await self.col.delete_many({"user_id": oid(user_id)})
        await self.col.insert_one(
            {
                "user_id": oid(user_id),
                "token_hash": token_hash,
                "used": False,
                "expires_at": now + timedelta(minutes=self.EXPIRY_MINUTES),
                "created_at": now,
            }
        )

    async def find_valid(self, token_hash: str) -> dict | None:
        doc = await self.col.find_one({"token_hash": token_hash})
        if not doc:
            return None
        expires_at = doc.get("expires_at")
        # pymongo/mongomock return naive UTC datetimes.
        if expires_at.tzinfo is not None:
            expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
        if doc.get("used") or expires_at < datetime.now(timezone.utc).replace(
            tzinfo=None
        ):
            return None
        return doc

    async def consume(self, token_hash: str) -> None:
        await self.col.update_one({"token_hash": token_hash}, {"$set": {"used": True}})


class AcademicRepository:
    def __init__(self, db):
        self.db = db
        self.years = db.academic_years
        self.batches = db.batches

    async def ensure_year(self, name: str) -> dict:
        doc = await self.years.find_one_and_update(
            {"name": name},
            {"$setOnInsert": {"name": name, "created_at": datetime.now(timezone.utc)}},
            upsert=True,
            return_document=True,
        )
        return doc

    async def list_years(self) -> list[dict]:
        return await self.years.find().sort([("name", 1)]).to_list(length=100)

    async def ensure_batch(
        self, name: str, academic_year_id: str | None = None
    ) -> dict:
        doc = await self.batches.find_one_and_update(
            {"name": name},
            {
                "$setOnInsert": {
                    "name": name,
                    "academic_year_id": academic_year_id,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
            return_document=True,
        )
        return doc

    async def list_batches(self) -> list[dict]:
        return await self.batches.find().sort([("name", 1)]).to_list(length=500)
