"""Remove the demo data the seed_demo_data.py script inserted into Atlas.

Keeps:
  - users (incl. the super admin)
  - students
  - invitations
  - settings
  - audit_logs

Removes:
  - classes
  - attendance_sessions
  - attendance_records
  - coding_profiles
  - coding_statistics
  - leaderboard_scores (all platforms)
  - leaderboard_snapshots
  - sync_jobs
  - sync_logs
  - email_logs
  - notifications
  - import_previews

Idempotent.
"""

import asyncio

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

DEMO_COLLECTIONS = [
    "classes",
    "attendance_sessions",
    "attendance_records",
    "coding_profiles",
    "coding_statistics",
    "leaderboard_scores",
    "leaderboard_snapshots",
    "sync_jobs",
    "coding_sync_jobs",
    "coding_sync_logs",
    "sync_logs",
    "email_logs",
    "notifications",
    "import_previews",
    "password_resets",
]


async def main() -> None:
    if not settings.MONGODB_URI:
        print("ERROR: MONGODB_URI not set")
        return
    client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=8000)
    db = client[settings.MONGODB_DATABASE]

    print("=== Before ===")
    for col in sorted(await db.list_collection_names()):
        n = await db[col].estimated_document_count()
        if n > 0 or col in {"users", "students", "settings"}:
            print(f"  {col:30s} {n:>6d}")

    print("\n=== Removing demo data ===")
    for col in DEMO_COLLECTIONS:
        if col not in await db.list_collection_names():
            continue
        n = await db[col].estimated_document_count()
        if n == 0:
            await db.drop_collection(col)
            print(f"  dropped {col:30s} (empty)")
            continue
        # Drop and recreate the collection (cheaper than deleteMany and frees disk).
        await db.drop_collection(col)
        print(f"  dropped {col:30s} ({n} docs removed)")

    print("\n=== After ===")
    for col in sorted(await db.list_collection_names()):
        n = await db[col].estimated_document_count()
        if n > 0 or col in {"users", "students", "settings"}:
            print(f"  {col:30s} {n:>6d}")

    # Re-create indexes on the collections we just dropped.
    print("\n=== Re-creating indexes ===")
    from app.database.mongo import ensure_indexes

    await ensure_indexes(db)
    print("  done")

    print("\n=== Done ===")
    print("  Demo data removed.")
    print("  Kept: users (admin), students, settings, audit logs, invitations.")


if __name__ == "__main__":
    asyncio.run(main())
