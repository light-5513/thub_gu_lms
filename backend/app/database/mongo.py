"""MongoDB (Atlas) connection management via Motor.

The client is created during application startup, verified with a ping and
closed on shutdown. Health status is exposed without leaking credentials.
"""

import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB is not connected")
    return _db


def get_client() -> AsyncIOMotorClient | None:
    return _client


async def connect_to_mongo() -> bool:
    """Connect to MongoDB Atlas. Returns True on verified connection."""
    global _client, _db
    uri = settings.MONGODB_URI
    if not uri:
        logger.warning("MONGODB_URI is not configured; running without database")
        return False
    # Atlas connections should use TLS. The mongodb+srv:// scheme normally implies
    # this, but we force it explicitly for hosts that pass a plain mongodb:// URI
    # through a proxy/SSH tunnel.
    kwargs = {"serverSelectionTimeoutMS": 8000}
    if settings.is_production:
        kwargs["tls"] = True
        kwargs["tlsAllowInvalidCertificates"] = False
    try:
        _client = AsyncIOMotorClient(uri, **kwargs)
        await _client.admin.command("ping")
        _db = _client[settings.MONGODB_DATABASE]
        logger.info("Connected to MongoDB database '%s'", settings.MONGODB_DATABASE)
        return True
    except Exception as exc:  # pragma: no cover - depends on external service
        logger.error("MongoDB connection failed: %s", exc)
        _client = None
        _db = None
        return False


async def close_mongo() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def mongo_healthy() -> bool:
    if _client is None or _db is None:
        return False
    try:
        await _db.command("ping")
        return True
    except Exception:
        return False


INDEX_SPEC: dict[str, list[tuple]] = {
    # collection: [(keys, options)]
    "users": [
        ([("email", 1)], {"unique": True}),
        ([("role", 1)], {}),
        ([("student_id", 1)], {}),
    ],
    "students": [
        ([("email", 1)], {"unique": True}),
        ([("roll_number", 1)], {"unique": True}),
        ([("course", 1)], {}),
        ([("branch", 1)], {}),
        ([("section", 1)], {}),
        ([("batch_id", 1)], {}),
        ([("academic_year_id", 1)], {}),
        ([("status", 1)], {}),
        ([("first_name", 1)], {}),
        ([("last_name", 1)], {}),
    ],
    "classes": [
        ([("date", -1)], {}),
        ([("course", 1)], {}),
        ([("branch", 1)], {}),
        ([("section", 1)], {}),
        ([("academic_year_id", 1)], {}),
        ([("batch_id", 1)], {}),
    ],
    "attendance_sessions": [
        ([("class_id", 1)], {"unique": True}),
        ([("date", -1)], {}),
    ],
    "attendance_records": [
        ([("student_id", 1), ("class_session_id", 1)], {"unique": True}),
        ([("student_id", 1)], {}),
        ([("class_session_id", 1)], {}),
        ([("date", -1)], {}),
    ],
    "coding_profiles": [
        ([("student_id", 1), ("platform", 1)], {"unique": True}),
        ([("platform", 1)], {}),
        ([("username", 1)], {}),
        ([("student_id", 1)], {}),
    ],
    "coding_statistics": [
        ([("student_id", 1), ("platform", 1)], {"unique": True}),
        ([("student_id", 1)], {}),
        ([("platform", 1)], {}),
    ],
    "leaderboard_scores": [
        ([("student_id", 1)], {}),
        ([("platform", 1), ("score", -1)], {}),
        ([("student_id", 1), ("platform", 1)], {"unique": True}),
    ],
    "leaderboard_snapshots": [
        ([("created_at", -1)], {}),
    ],
    "streaks": [
        ([("student_id", 1)], {"unique": True}),
    ],
    "password_reset_tokens": [
        ([("token_hash", 1)], {"unique": True}),
        ([("user_id", 1)], {}),
        ([("expires_at", 1)], {"expireAfterSeconds": 0}),
    ],
    "invitations": [
        ([("token_hash", 1)], {"unique": True}),
        ([("email", 1)], {}),
        ([("expires_at", 1)], {"expireAfterSeconds": 0}),
    ],
    "email_logs": [
        ([("status", 1)], {}),
        ([("created_at", -1)], {}),
    ],
    "audit_logs": [
        ([("user_id", 1)], {}),
        ([("action", 1)], {}),
        ([("created_at", -1)], {}),
    ],
    "coding_sync_jobs": [
        ([("status", 1)], {}),
        ([("platform", 1)], {}),
        ([("created_at", -1)], {}),
    ],
    "coding_sync_logs": [
        ([("job_id", 1)], {}),
    ],
    "notifications": [
        ([("user_id", 1)], {}),
        ([("read", 1)], {}),
        ([("created_at", -1)], {}),
    ],
    "settings": [
        ([("key", 1)], {"unique": True}),
    ],
    "academic_years": [
        ([("name", 1)], {"unique": True}),
    ],
    "batches": [
        ([("name", 1)], {}),
    ],
    "contact_messages": [
        ([("created_at", -1)], {}),
        ([("status", 1)], {}),
        ([("email", 1)], {}),
    ],
}


async def ensure_indexes(db: Any) -> None:
    for collection, indexes in INDEX_SPEC.items():
        col = db[collection]
        for keys, opts in indexes:
            try:
                await col.create_index(keys, **opts)
            except Exception as exc:  # pragma: no cover
                logger.warning(
                    "Index creation failed on %s %s: %s", collection, keys, exc
                )
