"""Drop every collection in the application database (full clean slate).

Run:  python -m scripts.reset_db
Requires MONGODB_URI / MONGODB_DATABASE in .env. Indexes are recreated
afterwards so the app can start fresh.
"""

import asyncio

from app.config import settings
from app.core.logging import setup_logging
from app.database import mongo
from app.database.mongo import ensure_indexes


async def reset() -> None:
    setup_logging()
    ok = await mongo.connect_to_mongo()
    if not ok:
        print("ERROR: Cannot connect to MongoDB. Check MONGODB_URI in .env.")
        return
    db = mongo.get_db()

    collections = await db.list_collection_names()
    if not collections:
        print("Database is already empty.")
        return

    print(
        f"Dropping {len(collections)} collections from '{settings.MONGODB_DATABASE}':"
    )
    for name in sorted(collections):
        await db.drop_collection(name)
        print(f"  - dropped {name}")

    await ensure_indexes(db)
    print("\nAll data removed. Indexes recreated. Database is clean.")


if __name__ == "__main__":
    asyncio.run(reset())
