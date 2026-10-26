"""Shared test fixtures using mongomock-motor (no external services needed)."""
import asyncio
import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core import security
from app.models.enums import Role


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db():
    client = AsyncMongoMockClient()
    return client["test_lms"]


def make_user(db, email="student@test.local", role=Role.STUDENT, password="Passw0rd!123", must_change=False):
    user = {
        "email": email,
        "role": role.value,
        "full_name": "Test User",
        "password_hash": security.hash_password(password),
        "must_change_password": must_change,
        "is_active": True,
        "token_version": 0,
    }
    return asyncio.get_event_loop().run_until_complete(_insert_user(db, user))


async def _insert_user(db, user):
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    return user
