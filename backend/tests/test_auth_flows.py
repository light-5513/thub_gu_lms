"""Integration tests for auth + student invitation flow using mongomock."""
import pytest

from app.core import security
from app.models.enums import AuditAction, Role
from app.services.auth_service import AuthService
from app.services.student_service import StudentService


@pytest.fixture
def auth(db):
    return AuthService(db)


@pytest.mark.asyncio
async def test_login_success_and_failure(db, auth):
    await db.users.insert_one(
        {
            "email": "stu@x.com",
            "role": "STUDENT",
            "password_hash": security.hash_password("RightPass!1"),
            "must_change_password": False,
            "is_active": True,
            "token_version": 0,
        }
    )
    from app.core.errors import AuthError

    user = await auth.authenticate("stu@x.com", "RightPass!1")
    assert str(user["_id"])
    tokens = auth.issue_tokens(user)
    assert tokens["access"] and tokens["refresh"]

    with pytest.raises(AuthError):
        await auth.authenticate("stu@x.com", "WrongPass!1")
    with pytest.raises(AuthError):
        await auth.authenticate("ghost@x.com", "RightPass!1")


@pytest.mark.asyncio
async def test_create_student_generates_hashed_temp_password(db, auth):
    admin = {
        "_id": (await db.users.insert_one({"email": "admin@x.com", "role": "ADMIN", "token_version": 0})).inserted_id,
        "role": "ADMIN",
    }
    service = StudentService(db)
    result = await service.create_student(
        {
            "first_name": "Nina",
            "last_name": "Roy",
            "email": "nina@x.com",
            "roll_number": "R100",
            "course": "B.Tech",
            "branch": "CSE",
            "section": "A",
        },
        admin,
    )
    student = result["student"]
    assert student["user_id"]

    stored_user = await db.users.find_one({"email": "nina@x.com"})
    assert stored_user["must_change_password"] is True
    # Only the hash is stored; the plaintext temp password never lands in DB.
    assert stored_user["password_hash"] != ""
    assert not security.verify_password("", stored_user["password_hash"])

    # Duplicate roll number is rejected.
    from app.core.errors import ConflictError

    with pytest.raises(ConflictError):
        await service.create_student(
            {
                "first_name": "Copy",
                "last_name": "Cat",
                "email": "copy@x.com",
                "roll_number": "R100",
                "course": "B.Tech",
                "branch": "CSE",
                "section": "A",
            },
            admin,
        )


@pytest.mark.asyncio
async def test_forgot_reset_flow_single_use_tokens(db, auth):
    await db.users.insert_one(
        {
            "email": "resetme@x.com",
            "role": "STUDENT",
            "password_hash": security.hash_password("OldPass!12"),
            "must_change_password": False,
            "is_active": True,
            "token_version": 0,
        }
    )
    # Capture the reset token by intercepting the email render path.
    captured = {}

    async def fake_send(student_name, email, token):
        captured["token"] = token
        return True

    auth.email.send_password_reset_email = fake_send
    await auth.request_password_reset("resetme@x.com")
    assert captured.get("token")

    await auth.reset_password(captured["token"], "NewPass!234")
    user = await db.users.find_one({"email": "resetme@x.com"})
    assert security.verify_password("NewPass!234", user["password_hash"])

    # Token is single-use: second attempt fails.
    from app.core.errors import AppError

    with pytest.raises(AppError):
        await auth.reset_password(captured["token"], "Another!99")


@pytest.mark.asyncio
async def test_token_invalidation_on_logout(db, auth):
    await db.users.insert_one(
        {
            "email": "logout@x.com",
            "role": "STUDENT",
            "password_hash": security.hash_password("Whatever!1"),
            "must_change_password": False,
            "is_active": True,
            "token_version": 0,
        }
    )
    user = await auth.authenticate("logout@x.com", "Whatever!1")
    tokens = auth.issue_tokens(user)
    payload_before = security.decode_token(tokens["access"])
    await auth.logout(str(user["_id"]))
    refreshed = await db.users.find_one({"_id": user["_id"]})
    assert refreshed["token_version"] == payload_before["ver"] + 1
    # Refresh with old token must now fail.
    assert await auth.refresh(tokens["refresh"]) is None


@pytest.mark.asyncio
async def test_force_password_change_flow(db, auth):
    await db.users.insert_one(
        {
            "email": "forced@x.com",
            "role": "STUDENT",
            "password_hash": security.hash_password("TempPass!9"),
            "must_change_password": True,
            "is_active": True,
            "token_version": 0,
        }
    )
    user = await auth.authenticate("forced@x.com", "TempPass!9")
    assert AuthService.redirect_for(user) == "/force-change-password"
    await auth.force_change_password(user, "BrandNew!22")
    updated = await db.users.find_one({"_id": user["_id"]})
    assert updated["must_change_password"] is False
    assert AuthService.redirect_for(updated) == "/student/dashboard"
