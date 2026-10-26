"""Batch monitoring is scoped to current members and preserves missing marks."""

from datetime import datetime, timezone

from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_user, get_db
from app.main import app
from app.services.batch_monitor_service import BatchMonitorService


async def test_batch_monitor_counts_only_current_active_roster_and_reports_unmarked(db):
    batch_a, batch_b = ObjectId(), ObjectId()
    a1, a2, legacy, inactive, outside = [ObjectId() for _ in range(5)]
    await db.batches.insert_many([
        {"_id": batch_a, "batch_code": "A", "name": "Batch A"},
        {"_id": batch_b, "batch_code": "B", "name": "Batch B"},
    ])
    await db.students.insert_many([
        {"_id": a1, "batch_id": str(batch_a), "status": "active", "first_name": "A", "roll_number": "1"},
        {"_id": a2, "batch_id": str(batch_a), "status": "active", "first_name": "B", "roll_number": "2"},
        {"_id": legacy, "batch_id": str(batch_a), "first_name": "C", "roll_number": "3"},
        {"_id": inactive, "batch_id": str(batch_a), "status": "inactive", "first_name": "D", "roll_number": "4"},
        {"_id": outside, "batch_id": str(batch_b), "status": "active", "first_name": "E", "roll_number": "5"},
    ])
    marked, pending, other_batch, out_of_range = [ObjectId() for _ in range(4)]
    await db.classes.insert_many([
        {"_id": marked, "batch_id": str(batch_a), "date": datetime(2026, 10, 15, tzinfo=timezone.utc)},
        {"_id": pending, "batch_id": str(batch_a), "date": datetime(2026, 10, 16, tzinfo=timezone.utc)},
        {"_id": other_batch, "batch_id": str(batch_b), "date": datetime(2026, 10, 15, tzinfo=timezone.utc)},
        {"_id": out_of_range, "batch_id": str(batch_a), "date": datetime(2026, 9, 15, tzinfo=timezone.utc)},
    ])
    session, outside_session = ObjectId(), ObjectId()
    await db.attendance_sessions.insert_many([
        {"_id": session, "class_id": marked},
        {"_id": outside_session, "class_id": other_batch},
    ])
    await db.attendance_records.insert_many([
        {"student_id": a1, "class_session_id": session, "status": "present"},
        {"student_id": a2, "class_session_id": session, "status": "absent"},
        {"student_id": inactive, "class_session_id": session, "status": "present"},
        {"student_id": outside, "class_session_id": outside_session, "status": "present"},
    ])
    await db.coding_profiles.insert_many([
        {"student_id": a1, "platform": "leetcode", "sync_status": "success"},
        {"student_id": legacy, "platform": "codeforces", "sync_status": "failed"},
        {"student_id": outside, "platform": "github", "sync_status": "success"},
    ])
    await db.coding_activity.insert_many([
        {"student_id": a1, "platform": "leetcode", "date": "2026-10-15", "metrics": {"problems_solved": 2}},
        {"student_id": a1, "platform": "leetcode", "date": "2026-10-16", "metrics": {"problems_solved": 0}},
        {"student_id": legacy, "platform": "codeforces", "date": "2026-10-15", "metrics": {"problems_solved_delta": 2}, "estimated": True},
        {"student_id": outside, "platform": "github", "date": "2026-10-15", "metrics": {"contributions": 7}},
    ])

    service = BatchMonitorService(db)
    result = await service.summary(str(batch_a), "2026-10-01", "2026-10-31", "Asia/Kolkata")

    assert result["students"] == {
        "total": 4, "active": 3, "inactive": 1, "with_profiles": 2, "active_coders": 1
    }
    assert result["classes"] == {"total": 2, "marked": 1, "pending": 1}
    assert result["attendance"]["present"] == 1
    assert result["attendance"]["absent"] == 1
    assert result["attendance"]["unmarked"] == 1
    assert result["attendance"]["percentage"] == 50.0
    assert result["coding"]["profiles"] == 2
    assert result["coding"]["activity_days"] == 1
    assert result["coding"]["estimated_rows_excluded"] == 1
    assert result["members"][2]["attendance"]["unmarked"] == 1
    assert result["members"][0]["coding"]["last_activity_date"] == "2026-10-15"
    assert all(row["id"] != str(outside) for row in result["members"])

    original_attendance = await db.attendance_records.find({}).to_list(length=None)
    await db.students.update_one({"_id": a1}, {"$set": {"batch_id": None}})
    removed = await service.summary(str(batch_a), "2026-10-01", "2026-10-31", "Asia/Kolkata")
    assert removed["students"]["total"] == 3
    assert removed["attendance"]["present"] == 0
    await db.students.update_one({"_id": a1}, {"$set": {"batch_id": str(batch_a)}})
    restored = await service.summary(str(batch_a), "2026-10-01", "2026-10-31", "Asia/Kolkata")
    assert restored["attendance"]["present"] == 1
    assert await db.attendance_records.find({}).to_list(length=None) == original_attendance


async def test_batch_monitor_empty_batch_and_staff_route(db):
    batch_id = ObjectId()
    await db.batches.insert_one({"_id": batch_id, "batch_code": "EMPTY", "name": "Empty Batch"})
    identity = {"_id": ObjectId(), "role": "ADMIN"}

    async def test_db():
        return db

    async def current_user():
        return identity

    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides[get_current_user] = current_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                f"/api/admin/batches/{batch_id}/monitor?start_date=2026-10-01&end_date=2026-10-31"
            )
            invalid_range = await client.get(
                f"/api/admin/batches/{batch_id}/monitor?start_date=2026-11-01&end_date=2026-10-31"
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["batch"]["id"] == str(batch_id)
    assert data["period"]["start_date"] == "2026-10-01"
    assert data["students"]["total"] == 0
    assert data["attendance"]["percentage"] is None
    assert data["members"] == []
    assert invalid_range.status_code == 400
