"""Coding profiles, sync jobs and statistics data access."""

from datetime import datetime, timezone

from app.repositories.base import oid


class CodingProfileRepository:
    def __init__(self, db):
        self.db = db
        self.profiles = db.coding_profiles
        self.stats = db.coding_statistics

    async def get_profile(self, student_id: str, platform: str) -> dict | None:
        return await self.profiles.find_one(
            {"student_id": oid(student_id), "platform": platform}
        )

    async def upsert_profile(
        self, student_id: str, platform: str, username: str
    ) -> dict:
        now = datetime.now(timezone.utc)
        doc = await self.profiles.find_one_and_update(
            {"student_id": oid(student_id), "platform": platform},
            {
                "$set": {"username": username, "updated_at": now},
                "$setOnInsert": {
                    "student_id": oid(student_id),
                    "platform": platform,
                    "created_at": now,
                    "sync_status": "never_synced",
                    "verified": False,
                },
            },
            upsert=True,
            return_document=True,
        )
        return doc

    async def delete_profile(self, student_id: str, platform: str) -> None:
        await self.profiles.delete_one(
            {"student_id": oid(student_id), "platform": platform}
        )
        await self.stats.delete_one(
            {"student_id": oid(student_id), "platform": platform}
        )

    async def list_profiles(self, student_id: str) -> list[dict]:
        cursor = self.profiles.find({"student_id": oid(student_id)})
        return await cursor.to_list(length=20)

    async def mark_sync_status(
        self, student_id: str, platform: str, status: str, error: str | None = None
    ) -> None:
        update = {"sync_status": status, "last_synced_at": datetime.now(timezone.utc)}
        if error is not None:
            update["sync_error"] = error[:500]
        else:
            update["sync_error"] = None
        await self.profiles.update_one(
            {"student_id": oid(student_id), "platform": platform}, {"$set": update}
        )

    async def set_profile_url(self, student_id: str, platform: str, url: str) -> None:
        await self.profiles.update_one(
            {"student_id": oid(student_id), "platform": platform},
            {"$set": {"profile_url": url}},
        )

    async def save_statistics(
        self, student_id: str, platform: str, normalized: dict, raw: dict | None = None
    ) -> None:
        now = datetime.now(timezone.utc)
        # Keep raw payload small (max 16KB)
        raw_store = None
        if raw:
            import json

            raw_json = json.dumps(raw, default=str)
            if len(raw_json) < 12000:
                raw_store = raw
        await self.stats.update_one(
            {"student_id": oid(student_id), "platform": platform},
            {
                "$set": {
                    "student_id": oid(student_id),
                    "platform": platform,
                    "statistics": normalized,
                    "raw": raw_store,
                    "fetched_at": now,
                }
            },
            upsert=True,
        )

    async def get_statistics(self, student_id: str, platform: str) -> dict | None:
        return await self.stats.find_one(
            {"student_id": oid(student_id), "platform": platform}
        )

    async def all_statistics_for_student(self, student_id: str) -> list[dict]:
        return await self.stats.find({"student_id": oid(student_id)}).to_list(length=20)

    async def profiles_with_username(self, platform: str) -> list[dict]:
        cursor = self.profiles.find(
            {"platform": platform, "username": {"$nin": [None, ""]}}
        )
        return await cursor.to_list(length=100000)


class SyncJobRepository:
    def __init__(self, db):
        self.db = db
        self.jobs = db.coding_sync_jobs
        self.logs = db.coding_sync_logs

    async def create_job(self, platform: str, requested_by: str, total: int) -> dict:
        doc = {
            "platform": platform,
            "requested_by": requested_by,
            "total": total,
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "status": "queued",
            "started_at": None,
            "completed_at": None,
            "error_summary": [],
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.jobs.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def get_job(self, job_id: str) -> dict | None:
        try:
            return await self.jobs.find_one({"_id": oid(job_id)})
        except Exception:
            return None

    async def list_jobs(self, limit: int = 25) -> list[dict]:
        return (
            await self.jobs.find()
            .sort([("created_at", -1)])
            .limit(limit)
            .to_list(length=limit)
        )

    async def update_progress(self, job_id: str, **fields) -> None:
        set_fields = {k: v for k, v in fields.items() if v is not None}
        if set_fields:
            await self.jobs.update_one(
                {"_id": oid(job_id)}, {"$set": set_fields, "$inc": {"processed": 0}}
            )

    async def increment_job(
        self,
        job_id: str,
        success: int = 0,
        failed: int = 0,
        processed: int = 1,
        errors: list[str] | None = None,
    ) -> None:
        update: dict = {
            "$inc": {"processed": processed, "successful": success, "failed": failed}
        }
        if errors:
            update["$push"] = {"error_summary": {"$each": errors[:50], "$slice": -100}}
        await self.jobs.update_one({"_id": oid(job_id)}, update)

    async def finish_job(self, job_id: str, status: str) -> None:
        await self.jobs.update_one(
            {"_id": oid(job_id)},
            {"$set": {"status": status, "completed_at": datetime.now(timezone.utc)}},
        )

    async def add_log(
        self,
        job_id: str,
        student_id: str,
        platform: str,
        ok: bool,
        message: str | None = None,
    ) -> None:
        await self.logs.insert_one(
            {
                "job_id": oid(job_id),
                "student_id": oid(student_id),
                "platform": platform,
                "success": ok,
                "message": (message or "")[:300],
                "created_at": datetime.now(timezone.utc),
            }
        )
