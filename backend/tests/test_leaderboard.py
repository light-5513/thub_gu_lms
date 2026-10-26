"""Leaderboard ranking behavior for ties, zero scores and limited results."""

from bson import ObjectId
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_user, get_db
from app.main import app
from app.services.leaderboard_service import LeaderboardService


async def test_leaderboard_total_and_off_page_rank_match_tied_rows(db):
    students = [ObjectId() for _ in range(4)]
    rows = [
        {"student_id": students[0], "student_name": "Ava", "platform": "overall", "score": 100, "course": "CSE", "metrics": {}},
        {"student_id": students[1], "student_name": "Ben", "platform": "overall", "score": 100, "course": "CSE", "metrics": {}},
        {"student_id": students[2], "student_name": "Cleo", "platform": "overall", "score": 0, "course": "CSE", "metrics": {}},
        {"student_id": students[3], "student_name": "Drew", "platform": "overall", "score": 0, "course": "CSE", "metrics": {}},
    ]
    await db.leaderboard_scores.insert_many(rows)
    service = LeaderboardService(db)

    result = await service.get_leaderboard(limit=2)

    assert result["total"] == 4
    assert [entry["rank"] for entry in result["entries"]] == [1, 1]
    assert await service.repo.rank_of(str(students[2])) == 3
    assert await service.repo.rank_of(str(students[3])) == 3


async def test_rank_of_respects_filters_and_zero_score_ties(db):
    first, second, outside_scope = ObjectId(), ObjectId(), ObjectId()
    await db.leaderboard_scores.insert_many(
        [
            {"student_id": first, "platform": "leetcode", "score": 25, "course": "CSE"},
            {"student_id": second, "platform": "leetcode", "score": 0, "course": "CSE"},
            {"student_id": outside_scope, "platform": "leetcode", "score": 100, "course": "ECE"},
        ]
    )
    service = LeaderboardService(db)

    assert await service.repo.rank_of(
        str(second), "leetcode", {"course": "CSE"}
    ) == 2
    assert await service.repo.rank_of(
        str(outside_scope), "leetcode", {"course": "CSE"}
    ) is None


async def test_lifetime_batch_rank_uses_current_membership_without_recalculation(db):
    batch_a, batch_b = str(ObjectId()), str(ObjectId())
    first, second, third = ObjectId(), ObjectId(), ObjectId()
    await db.students.insert_many([
        {"_id": first, "batch_id": batch_a, "status": "active"},
        {"_id": second, "batch_id": batch_a},  # legacy active profile
        {"_id": third, "batch_id": batch_b, "status": "active"},
    ])
    await db.leaderboard_scores.insert_many([
        {"student_id": first, "student_name": "Ava", "platform": "overall", "score": 50, "batch_id": batch_b},
        {"student_id": second, "student_name": "Ben", "platform": "overall", "score": 50, "batch_id": batch_a},
        {"student_id": third, "student_name": "Cleo", "platform": "overall", "score": 100, "batch_id": batch_a},
    ])
    service = LeaderboardService(db)

    initial = await service.get_leaderboard(filters={"batch_id": batch_a}, limit=1)
    assert initial["total"] == 2
    assert [row["student_name"] for row in initial["entries"]] == ["Ava"]
    assert await service.rank_of(str(second), filters={"batch_id": batch_a}) == 1
    assert await service.rank_of(str(third), filters={"batch_id": batch_a}) is None

    await db.students.update_one({"_id": first}, {"$set": {"batch_id": batch_b}})
    after_move = await service.get_leaderboard(filters={"batch_id": batch_a})
    assert [row["student_id"] for row in after_move["entries"]] == [str(second)]
    assert await service.rank_of(str(first), filters={"batch_id": batch_b}) == 2

    await db.students.update_one({"_id": first}, {"$set": {"batch_id": None}})
    assert (await service.get_leaderboard(filters={"batch_id": batch_b}))["total"] == 1
    await db.students.update_one({"_id": first}, {"$set": {"batch_id": batch_b}})
    assert (await service.get_leaderboard(filters={"batch_id": batch_b}))["total"] == 2


async def test_date_leaderboard_is_limited_to_current_batch(db):
    batch_a, batch_b = str(ObjectId()), str(ObjectId())
    first, second = ObjectId(), ObjectId()
    await db.students.insert_many([
        {"_id": first, "batch_id": batch_a, "first_name": "Ava"},  # legacy active profile
        {"_id": second, "batch_id": batch_b, "status": "active", "first_name": "Ben"},
    ])
    metadata = {
        "available": True,
        "metric_key": "problems_solved",
        "metric_label": "Problems solved",
        "activity_timezone": "Asia/Kolkata",
        "coverage_start": "2026-10-01",
        "coverage_end": "2026-10-31",
        "fill_gaps": True,
    }
    for sid, solved in ((first, 3), (second, 8)):
        await db.coding_profiles.insert_one({"student_id": sid, "platform": "leetcode"})
        await db.coding_statistics.insert_one({"student_id": sid, "platform": "leetcode", "activity_metadata": metadata})
        await db.coding_activity.insert_one({"student_id": sid, "platform": "leetcode", "date": "2026-10-15", "metrics": {"problems_solved": solved}})
    service = LeaderboardService(db)

    result = await service.get_date_leaderboard("leetcode", "2026-10-01", "2026-10-31", {"batch_id": batch_a})
    assert result["total"] == 1
    assert result["entries"][0]["student_id"] == str(first)
    assert result["entries"][0]["score"] == 3


async def test_leaderboard_routes_require_batch_and_student_cannot_override_scope(db):
    batch_a, batch_b = ObjectId(), ObjectId()
    await db.batches.insert_many([
        {"_id": batch_a, "batch_code": "A", "name": "Batch A"},
        {"_id": batch_b, "batch_code": "B", "name": "Batch B"},
    ])
    student_user, first, second = ObjectId(), ObjectId(), ObjectId()
    await db.students.insert_many([
        {"_id": first, "user_id": str(student_user), "batch_id": str(batch_a), "status": "active", "first_name": "Ava"},
        {"_id": second, "batch_id": str(batch_b), "status": "active", "first_name": "Ben"},
    ])
    await db.leaderboard_scores.insert_many([
        {"student_id": first, "student_name": "Ava", "platform": "overall", "score": 10},
        {"student_id": second, "student_name": "Ben", "platform": "overall", "score": 90},
    ])
    identity = {"_id": ObjectId(), "role": "SUPER_ADMIN"}

    async def test_db():
        return db

    async def current_user():
        return identity

    app.dependency_overrides[get_db] = test_db
    app.dependency_overrides[get_current_user] = current_user
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            missing = await client.get("/api/admin/leaderboards")
            invalid = await client.get("/api/admin/leaderboards?batch_id=invalid")
            admin = await client.get(f"/api/admin/leaderboards?batch_id={batch_a}")
            identity = {"_id": student_user, "role": "STUDENT"}
            own = await client.get(f"/api/student/leaderboard?batch_id={batch_b}&course=Other")
            dashboard = await client.get("/api/student/dashboard")
            await db.students.update_one({"_id": first}, {"$set": {"batch_id": None}})
            unassigned = await client.get("/api/student/leaderboard")
    finally:
        app.dependency_overrides.clear()

    assert missing.status_code == 422
    assert invalid.status_code == 400
    assert admin.status_code == 200
    assert admin.json()["batch"]["name"] == "Batch A"
    assert [row["student_id"] for row in admin.json()["entries"]] == [str(first)]
    assert own.status_code == 200
    assert own.json()["batch"]["id"] == str(batch_a)
    assert [row["student_id"] for row in own.json()["entries"]] == [str(first)]
    assert dashboard.status_code == 200
    assert dashboard.json()["overall_rank"] == 1
    assert unassigned.status_code == 409
