"""Cleanup script for a public deployment.

  1. Drop transient / test data (email_logs, attendance, coding, leaderboard,
     sync_jobs, invitations, audit_logs, import_previews, notifications).
  2. Dedupe institutional data: users (by email), students (by user_id),
     classes (by date+start_time+course+branch+section+subject). Keep the
     most recent in each group.
  3. Ensure settings is a single document.
  4. Create (or refresh) the super admin from environment variables.

Admin identity and password are read from the environment so a deploy never
ships a known secret in source:

    ADMIN_EMAIL=mendoza99858@gmail.com
    ADMIN_PASSWORD=Thub@1234
    ADMIN_FULL_NAME="Site Admin"   # optional

Idempotent: safe to re-run.
"""

import asyncio
import os
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.core import security
from app.database.mongo import ensure_indexes
from app.models.enums import Role

# Transient collections to drop entirely
TRANSIENT = [
    "email_logs",
    "attendance_sessions",
    "attendance_records",
    "coding_profiles",
    "coding_statistics",
    "coding_sync_jobs",
    "coding_sync_logs",
    "leaderboard_scores",
    "leaderboard_snapshots",
    "sync_jobs",
    "invitations",
    "audit_logs",
    "import_previews",
    "notifications",
    "password_resets",
]


async def main() -> None:
    if not settings.MONGODB_URI:
        print("ERROR: MONGODB_URI is not set in .env")
        return

    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    admin_name = os.environ.get("ADMIN_FULL_NAME", "Site Admin").strip() or "Site Admin"

    if not admin_email or not admin_password:
        print(
            "ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.\n"
            "       Example:\n"
            "         ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='YourSecureP@ssw0rd' \\\n"
            "         python -m backend.scripts.cleanup_and_create_admin"
        )
        return

    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=8000)
    db = client[settings.MONGODB_DATABASE]

    print(f"Connecting to MongoDB: {settings.MONGODB_DATABASE}")
    try:
        await db.command("ping")
    except Exception as exc:
        print(f"ERROR: Cannot reach MongoDB Atlas: {exc}")
        return

    print("\n=== BEFORE ===")
    for col in await db.list_collection_names():
        count = await db[col].estimated_document_count()
        if count > 0:
            print(f"  {col:30s} {count:>6d}")

    # ----------------------------------------------------------------- 1. Drop transient
    print("\n=== Dropping transient collections ===")
    for col in TRANSIENT:
        if col in await db.list_collection_names():
            n = await db[col].estimated_document_count()
            await db.drop_collection(col)
            print(f"  dropped {col:30s} ({n} docs)")

    # ----------------------------------------------------------------- 2. Dedupe users
    print("\n=== Dedupe users (by email) ===")
    pipeline = [
        {"$group": {"_id": "$email", "ids": {"$push": "$_id"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    dups_removed = 0
    async for grp in db.users.aggregate(pipeline):
        ids = grp["ids"]
        if not ids:
            continue
        cursor = db.users.find({"_id": {"$in": ids}}, {"created_at": 1})
        docs = [d async for d in cursor]
        docs.sort(
            key=lambda d: (
                d.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)
            ),
            reverse=True,
        )
        remove_ids = [d["_id"] for d in docs[1:]]
        if remove_ids:
            res = await db.users.delete_many({"_id": {"$in": remove_ids}})
            dups_removed += res.deleted_count
            print(f"  email={grp['_id']}: kept 1, removed {res.deleted_count}")
    if dups_removed == 0:
        print("  no duplicate users found")

    # Dedupe students by user_id
    print("\n=== Dedupe students (by user_id) ===")
    pipeline = [
        {"$group": {"_id": "$user_id", "ids": {"$push": "$_id"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    dups_removed = 0
    async for grp in db.students.aggregate(pipeline):
        ids = grp["ids"]
        cursor = db.students.find({"_id": {"$in": ids}}, {"created_at": 1})
        docs = [d async for d in cursor]
        docs.sort(
            key=lambda d: (
                d.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)
            ),
            reverse=True,
        )
        remove_ids = [d["_id"] for d in docs[1:]]
        if remove_ids:
            res = await db.students.delete_many({"_id": {"$in": remove_ids}})
            dups_removed += res.deleted_count
            print(f"  user_id={grp['_id']}: kept 1, removed {res.deleted_count}")
    if dups_removed == 0:
        print("  no duplicate students found")

    # Dedupe classes
    print("\n=== Dedupe classes (by date+time+course+branch+section+subject) ===")
    pipeline = [
        {
            "$group": {
                "_id": {
                    "date": "$date",
                    "start_time": "$start_time",
                    "course": "$course",
                    "branch": "$branch",
                    "section": "$section",
                    "subject": "$subject",
                },
                "ids": {"$push": "$_id"},
                "count": {"$sum": 1},
            }
        },
        {"$match": {"count": {"$gt": 1}}},
    ]
    dups_removed = 0
    async for grp in db.classes.aggregate(pipeline):
        ids = grp["ids"]
        cursor = db.classes.find({"_id": {"$in": ids}}, {"created_at": 1})
        docs = [d async for d in cursor]
        docs.sort(
            key=lambda d: (
                d.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)
            ),
            reverse=True,
        )
        remove_ids = [d["_id"] for d in docs[1:]]
        if remove_ids:
            res = await db.classes.delete_many({"_id": {"$in": remove_ids}})
            dups_removed += res.deleted_count
            print(f"  {grp['_id']}: kept 1, removed {res.deleted_count}")
    if dups_removed == 0:
        print("  no duplicate classes found")

    # ----------------------------------------------------------------- 3. Settings singleton
    print("\n=== Settings: keep only the one ===")
    n_settings = await db.settings.estimated_document_count()
    if n_settings > 1:
        cursor = db.settings.find({}, {"updated_at": 1}).sort([("updated_at", -1)])
        docs = [d async for d in cursor]
        remove_ids = [d["_id"] for d in docs[1:]]
        await db.settings.delete_many({"_id": {"$in": remove_ids}})
        print(f"  {n_settings} settings docs -> 1 (removed {len(remove_ids)})")
    elif n_settings == 0:
        print("  no settings (will be created on first GET)")
    else:
        print("  already a single settings doc")

    # ----------------------------------------------------------------- 4. Create / refresh admin
    print(f"\n=== Admin: {admin_email} ===")
    existing = await db.users.find_one({"email": admin_email})
    now = datetime.now(timezone.utc)
    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "password_hash": security.hash_password(admin_password),
                    "role": Role.SUPER_ADMIN.value,
                    "full_name": existing.get("full_name") or admin_name,
                    "is_active": True,
                    "must_change_password": False,
                    "token_version": 0,
                    "updated_at": now,
                }
            },
        )
        print(
            f"  UPDATED existing user: {admin_email} (role=SUPER_ADMIN, password refreshed)"
        )
    else:
        await db.users.insert_one(
            {
                "email": admin_email,
                "role": Role.SUPER_ADMIN.value,
                "full_name": admin_name,
                "password_hash": security.hash_password(admin_password),
                "must_change_password": False,
                "is_active": True,
                "token_version": 0,
                "created_at": now,
                "updated_at": now,
            }
        )
        print(f"  CREATED new super admin: {admin_email}")

    # ----------------------------------------------------------------- 5. Recreate indexes
    print("\n=== Recreating indexes ===")
    await ensure_indexes(db)
    print("  done")

    # ----------------------------------------------------------------- 6. AFTER
    print("\n=== AFTER ===")
    for col in sorted(await db.list_collection_names()):
        count = await db[col].estimated_document_count()
        if count > 0 or col in {"users", "students", "classes", "settings"}:
            print(f"  {col:30s} {count:>6d}")

    print("\n=== DONE ===")
    print("  Login at https://your-app.onrender.com/login")
    print(f"  Email:    {admin_email}")
    print("  Password: <from your env — not echoed here>")


if __name__ == "__main__":
    asyncio.run(main())
