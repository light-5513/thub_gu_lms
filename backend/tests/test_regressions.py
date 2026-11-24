"""Regression coverage for configuration, registration, attendance and monitoring."""

from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from bson import BSON, ObjectId
from httpx import ASGITransport, AsyncClient
from openpyxl import Workbook

from app import config
from app.core import security
from app.core.deps import get_current_user, get_db
from app.core.errors import AppError, ConflictError
from app.database import mongo
from app.main import app
from app.repositories.coding import CodingProfileRepository
from app.repositories.attendance import ClassRepository
from app.services.attendance_service import AttendanceService, ClassService
from app.services.batch_service import BatchService
from app.services.invitation_service import InvitationService
from app.services.student_service import StudentService
from app.services.settings_service import SettingsService
from app.services.batch_monitor_service import BatchMonitorService
from app.integrations.base import CodingPlatformAdapter


@pytest.fixture
def staff():
    return {"_id": ObjectId(), "role": "SUPER_ADMIN", "is_active": True}


@pytest.fixture
async def client(db, staff):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: staff
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        yield api
    app.dependency_overrides.clear()


def test_configuration_uses_repository_env():
    assert config._ROOT_ENV == Path(__file__).resolve().parents[2] / ".env"


async def test_class_date_filter_is_inclusive_and_bson_safe(db, client):
    query = ClassRepository(db).build_filters(date_from=date(2026, 10, 1), date_to=date(2026, 10, 31))
    BSON.encode(query)  # Real MongoDB rejects datetime.date values.
    await db.classes.insert_one({"date": datetime(2026, 10, 31), "subject": "DSA"})
    response = await client.get("/api/admin/classes?date_from=2026-10-01&date_to=2026-10-31")
    assert response.status_code == 200
    assert response.json()["total"] == 1


async def test_rescheduling_class_updates_saved_attendance_dates(db, staff):
    original_date = datetime(2026, 10, 1)
    class_id = (await db.classes.insert_one({"date": original_date, "subject": "DSA"})).inserted_id
    session_id = (await db.attendance_sessions.insert_one({"class_id": class_id})).inserted_id
    await db.attendance_records.insert_one({"class_session_id": session_id, "student_id": ObjectId(), "date": original_date, "status": "present"})
    await ClassService(db).update(str(class_id), {"date": date(2026, 10, 2)}, staff)
    record = await db.attendance_records.find_one({"class_session_id": session_id})
    assert record["date"].date() == date(2026, 10, 2)


async def test_attendance_override_updates_session_timestamp(db, staff, monkeypatch):
    sid = (await db.students.insert_one({"batch_id": "batch", "first_name": "A", "roll_number": "1"})).inserted_id
    cls = (await db.classes.insert_one({"batch_id": "batch", "date": datetime(2026, 10, 1)})).inserted_id
    old = datetime(2026, 1, 1)
    session = (await db.attendance_sessions.insert_one({"class_id": cls, "updated_at": old})).inserted_id
    service = AttendanceService(db)
    monkeypatch.setattr(service.attendance, "save_records", AsyncMock())
    await service.save_attendance(str(cls), [{"student_id": str(sid), "status": "present"}], staff, override=True)
    assert (await db.attendance_sessions.find_one({"_id": session}))["updated_at"] > old


async def test_invalid_class_time_order_is_rejected(client):
    response = await client.post("/api/admin/classes", json={"date": "2026-10-01", "start_time": "11:00", "end_time": "10:00", "subject": "DSA", "batch_id": str(ObjectId())})
    assert response.status_code == 422


async def test_batch_upload_keeps_blank_header_column_positions(db):
    batch = (await db.batches.insert_one({"name": "A"})).inserted_id
    await db.students.insert_one({"roll_number": "R001"})
    workbook = Workbook()
    workbook.active.append([None, "roll_number", "name"])
    workbook.active.append([None, "R001", "Student"])
    content = BytesIO()
    workbook.save(content)
    result = await BatchService(db).parse_and_assign_xlsx(str(batch), content.getvalue())
    assert result["success_count"] == 1


@pytest.mark.parametrize("query", ["page=0", "page_size=0", "page_size=-1"])
async def test_batch_pagination_rejects_invalid_values(client, query):
    response = await client.get(f"/api/admin/batches?{query}")
    assert response.status_code == 422


async def test_invitation_accepts_omitted_optional_profile_fields(db):
    token = "optional-profile-fields-token"
    await db.invitations.insert_one({"email": "student@example.test", "role": "STUDENT", "token_hash": security.hash_token(token), "expires_at": datetime.now(timezone.utc) + timedelta(days=1), "used": False})
    await InvitationService(db).accept(token, {"first_name": "A", "last_name": "B", "roll_number": "R001", "password": "Password123", "course": None, "branch": None, "section": None})
    assert await db.students.count_documents({"email": "student@example.test"}) == 1


async def test_invitation_roll_conflict_leaves_no_orphan_account(db):
    token = "duplicate-roll-invitation-token"
    await db.students.create_index("roll_number", unique=True)
    await db.students.insert_one({"roll_number": "R001"})
    await db.invitations.insert_one({"email": "new@example.test", "role": "STUDENT", "token_hash": security.hash_token(token), "expires_at": datetime.now(timezone.utc) + timedelta(days=1), "used": False})
    with pytest.raises(ConflictError):
        await InvitationService(db).accept(token, {"first_name": "A", "last_name": "B", "roll_number": " R001 ", "password": "Password123", "course": "BTech", "branch": "CSE", "section": "A"})
    assert await db.users.count_documents({"email": "new@example.test"}) == 0


async def test_student_status_controls_login_and_null_batch_unassigns(db, staff):
    uid = (await db.users.insert_one({"email": "a@example.test", "is_active": True, "token_version": 0})).inserted_id
    sid = (await db.students.insert_one({"email": "a@example.test", "user_id": str(uid), "batch_id": "old", "status": "active"})).inserted_id
    service = StudentService(db)
    await service.update_student(str(sid), {"status": "inactive", "batch_id": None}, staff)
    assert (await db.users.find_one({"_id": uid}))["is_active"] is False
    assert (await db.students.find_one({"_id": sid}))["batch_id"] is None
    await service.update_student(str(sid), {"status": "active"}, staff)
    assert (await db.users.find_one({"_id": uid}))["is_active"] is True


async def test_changed_username_clears_old_platform_statistics(db):
    repo = CodingProfileRepository(db)
    sid = str(ObjectId())
    await repo.upsert_profile(sid, "leetcode", "old-handle")
    await repo.save_statistics(sid, "leetcode", {"problems_solved": 50}, daily_activity=[{"date": "2026-10-01", "metrics": {"submissions": 4}}])
    await repo.upsert_profile(sid, "leetcode", "new-handle")
    assert await repo.get_statistics(sid, "leetcode") is None
    assert await repo.activity_for_student(sid, "2026-10-01", "2026-10-31") == []
    assert (await repo.get_profile(sid, "leetcode"))["sync_status"] == "never_synced"


async def test_malformed_signed_session_subject_returns_401(db, monkeypatch):
    monkeypatch.setattr(mongo, "_db", db)
    token = security.create_access_token("invalid-id", "STUDENT")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
        response = await api.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


@pytest.mark.parametrize("payload", [
    {"attendance_threshold": -1},
    {"attendance_threshold": 101},
    {"coding_sync_settings": {"max_retries": 0}},
    {"coding_sync_settings": {"concurrency": 0}},
    {"coding_sync_settings": {"timeout_seconds": -1}},
    {"leaderboard_weights": {"attendance": 0, "coding": 0, "streak": 0}},
    {"timezone": "Invalid/Zone"},
])
async def test_settings_reject_values_that_break_runtime(client, payload):
    assert (await client.put("/api/admin/settings", json=payload)).status_code == 422


async def test_partial_settings_preserve_nested_values_and_nulls_use_defaults(db):
    service = SettingsService(db)
    await service.update({"coding_sync_settings": {"concurrency": 6, "timeout_seconds": 30}})
    await service.update({"coding_sync_settings": {"concurrency": 2}, "attendance_threshold": None})
    saved = await service.all()
    assert saved["coding_sync_settings"]["timeout_seconds"] == 30
    assert saved["coding_sync_settings"]["concurrency"] == 2
    assert await service.attendance_threshold() == 75


async def test_adapter_retries_rate_limit_response(monkeypatch):
    import httpx
    calls = []

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            pass

        async def request(self, method, url, **_kwargs):
            calls.append(url)
            return httpx.Response(429 if len(calls) == 1 else 200, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_kwargs: Client())
    adapter = CodingPlatformAdapter(max_retries=2, retry_delay=0)
    response = await adapter._request("GET", "https://example.test/profile")
    assert response.status_code == 200
    assert len(calls) == 2


async def test_redis_connection_builds_an_enqueue_capable_pool(monkeypatch):
    from app.database import redis as redis_module
    from arq.connections import ArqRedis
    pool = AsyncMock(spec=ArqRedis)
    pool.ping = AsyncMock(return_value=True)
    factory = AsyncMock(return_value=pool)
    monkeypatch.setattr(redis_module, "create_pool", factory)
    monkeypatch.setattr(redis_module, "_redis", None)
    monkeypatch.setattr(redis_module, "worker_healthy", AsyncMock(return_value=True))
    assert await redis_module.connect_to_redis()
    assert await redis_module.enqueue_job("recalc_leaderboard_task")
    pool.enqueue_job.assert_awaited_once_with("recalc_leaderboard_task")
    await redis_module.close_redis()


async def test_batch_monitor_excludes_rows_saved_in_a_different_timezone(db):
    bid, sid = ObjectId(), ObjectId()
    await db.batches.insert_one({"_id": bid, "name": "A"})
    await db.students.insert_one({"_id": sid, "batch_id": str(bid), "status": "active"})
    await db.coding_profiles.insert_one({"student_id": sid, "platform": "leetcode"})
    await db.coding_statistics.insert_one({"student_id": sid, "platform": "leetcode", "activity_metadata": {"available": True, "activity_timezone": "UTC", "metric_key": "submissions"}})
    await db.coding_activity.insert_one({"student_id": sid, "platform": "leetcode", "date": "2026-10-01", "metrics": {"submissions": 7}})
    result = await BatchMonitorService(db).summary(str(bid), "2026-10-01", "2026-10-31", "Asia/Kolkata")
    assert result["students"]["active_coders"] == 0
    assert result["members"][0]["coding"]["activity_days"] == 0


async def test_student_profile_rejects_non_string_fields(db, client, staff):
    staff["role"] = "STUDENT"
    await db.students.insert_one({"user_id": str(staff["_id"]), "first_name": "A", "last_name": "B"})
    response = await client.put("/api/student/profile", json={"first_name": ["invalid"]})
    assert response.status_code == 422


async def test_imported_legacy_batch_lists_and_updates_without_a_code(db, client):
    bid = (await db.batches.insert_one({"name": "Imported", "created_at": datetime.now(timezone.utc)})).inserted_id
    result = await client.get("/api/admin/batches")
    assert result.status_code == 200
    assert result.json()["items"][0]["batch_code"] == ""
    result = await client.patch(f"/api/admin/batches/{bid}", json={"name": "Renamed"})
    assert result.status_code == 200
    assert result.json()["name"] == "Renamed"


async def test_low_attendance_export_includes_percentage_and_student_fields(db):
    from app.api.v1.admin.analytics import _collect_report
    sid = ObjectId()
    await db.students.insert_one({"_id": sid, "first_name": "A", "email": "a@example.test", "course": "BTech", "branch": "CSE", "section": "A"})
    await db.leaderboard_scores.insert_one({"student_id": sid, "platform": "overall", "metrics": {"attendance_percentage": 50}})
    _title, _headers, rows = await _collect_report(db, "low-attendance")
    assert rows[0][2:7] == ["a@example.test", 50, "BTech", "CSE", "A"]


async def test_import_preview_counts_invalid_students_once(db):
    from app.services.import_service import ImportService
    workbook = Workbook()
    workbook.active.append(["first_name", "last_name", "email", "roll_number", "course", "branch", "section"])
    workbook.active.append(["A", None, "invalid", None, "BTech", "CSE", "A"])
    content = BytesIO()
    workbook.save(content)
    result = await ImportService(db).preview(content.getvalue())
    assert result["invalid_records"] == 1
    assert len(result["errors"]) == 3


async def test_registration_rolls_back_user_when_student_write_fails(db):
    from types import SimpleNamespace
    token = "failed-profile-write-token"
    await db.invitations.insert_one({"email": "rollback@example.test", "role": "STUDENT", "token_hash": security.hash_token(token), "expires_at": datetime.now(timezone.utc) + timedelta(days=1), "used": False})
    service = InvitationService(db)
    service.db = SimpleNamespace(
        users=db.users,
        students=SimpleNamespace(
            find_one=AsyncMock(return_value=None),
            insert_one=AsyncMock(side_effect=RuntimeError("write failed")),
        ),
    )
    with pytest.raises(AppError):
        await service.accept(token, {"first_name": "A", "last_name": "B", "roll_number": "R001", "password": "Password123"})
    assert await db.users.count_documents({"email": "rollback@example.test"}) == 0
    assert (await db.invitations.find_one({"email": "rollback@example.test"}))["used"] is False


async def test_invitation_rejects_an_unknown_role(client):
    response = await client.post("/api/admin/invitations", json={
        "email": "invalid-role@example.com", "role": "UNKNOWN",
    })
    assert response.status_code == 422


async def test_coding_profile_rejects_non_string_username(db, client, staff):
    staff["role"] = "STUDENT"
    await db.students.insert_one({"user_id": str(staff["_id"])})
    response = await client.post("/api/student/coding-profiles", json={
        "platform": "leetcode", "username": {"invalid": "value"},
    })
    assert response.status_code == 422


async def test_sync_job_records_unexpected_failure_instead_of_staying_running(db, monkeypatch):
    from app.services.coding_sync_service import CodingSyncService
    service = CodingSyncService(db)
    job = await service.jobs.create_job("leetcode", str(ObjectId()), 1)
    monkeypatch.setattr(service, "_run_sync", AsyncMock(side_effect=RuntimeError("sync interrupted")))
    await service.run_sync(str(job["_id"]), "leetcode")
    saved = await service.jobs.get_job(str(job["_id"]))
    assert saved["status"] == "failed"
    assert saved["completed_at"] is not None
    assert saved["error_summary"]
