"""Create the first super admin user.

Run:  python -m scripts.create_admin <email> <password>
"""

import asyncio
import sys

from app.core import security
from app.core.logging import setup_logging
from app.database import mongo
from app.database.mongo import ensure_indexes
from app.models.enums import Role


async def create_admin(email: str, password: str) -> None:
    setup_logging()
    ok = await mongo.connect_to_mongo()
    if not ok:
        print("ERROR: Cannot connect to MongoDB.")
        return
    db = mongo.get_db()
    await ensure_indexes(db)

    if await db.users.find_one({"email": email}):
        print(f"User {email} already exists — nothing to do.")
        return

    from datetime import datetime, timezone

    await db.users.insert_one(
        {
            "email": email,
            "role": Role.SUPER_ADMIN.value,
            "full_name": "Super Admin",
            "password_hash": security.hash_password(password),
            "must_change_password": False,
            "is_active": True,
            "token_version": 0,
            "created_at": datetime.now(timezone.utc),
        }
    )
    print(f"Super admin created: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python -m scripts.create_admin <email> <password>")
        sys.exit(1)
    asyncio.run(create_admin(sys.argv[1], sys.argv[2]))
