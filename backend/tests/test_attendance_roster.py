"""Attendance roster compatibility and enrollment scope, using in-memory MongoDB."""

from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId

from app.core import security
from app.core.errors import AppError, ConflictError, NotFoundError
from app.repositories.users import StudentRepository
from app.services.attendance_service import AttendanceService, ClassService
from app.services.batch_service import BatchService
from app.services.invitation_service import InvitationService


def student(roll_number, **overrides):
    return {
        "first_name": "Test",
        "last_name": roll_number,
        "roll_number": roll_number,
        "course": "B.Tech",
        "branch": "CSE",
        "section": "A",
        "batch_id": "batch-a",
        "academic_year_id": "2026-27",
        **overrides,
    }


@pytest.mark.asyncio
async def test_roster_includes_active_batch_members_across_groups(db):
    await db.students.insert_many([
        student("R002", status="active"),
        student("R001"),
        student("R003", status="inactive"),
        student("R004", status="pending"),
        student("R005", status=None),
        student("OTHER-BATCH", status="active", batch_id="batch-b"),
        student("OTHER-COURSE", status="active", course="MCA"),
        student("OTHER-BRANCH", status="active", branch="IT"),
        student("OTHER-SECTION", status="active", section="B"),
        student("OTHER-YEAR", status="active", academic_year_id="2025-26"),
    ])
    class_doc = {
        "course": "B.Tech", "branch": "CSE", "section": "A",
        "batch_id": "batch-a", "academic_year_id": "2026-27",
    }

    roster = await AttendanceService(db).load_roster(class_doc)

    assert [entry["roll_number"] for entry in roster] == [
        "OTHER-BRANCH", "OTHER-COURSE", "OTHER-SECTION", "OTHER-YEAR",
        "R001", "R002",
    ]
    # Loading students must not create a session or mark anybody's attendance.
    assert await db.attendance_sessions.count_documents({}) == 0
    assert await db.attendance_records.count_documents({}) == 0
    assert await db.students.find_one({"roll_number": "R001", "status": {"$exists": False}})
    assert await db.students.find_one({"roll_number": "R003", "status": "inactive"})


@pytest.mark.asyncio
async def test_batch_roster_includes_every_eligible_member_across_groups(db):
    await db.students.insert_many([
        student("R001", status="active"),
        student("R002", course="MCA", branch="IT", section="B"),
        student("R003", status="inactive"),
        student("R004", batch_id="batch-b"),
    ])

    roster = await AttendanceService(db).load_roster({
        "course": None, "branch": None, "section": None, "batch_id": "batch-a",
    })

    assert [entry["roll_number"] for entry in roster] == ["R001", "R002"]


@pytest.mark.asyncio
async def test_explicit_include_inactive_retains_existing_repository_behavior(db):
    await db.students.insert_many([
        student("R001", status="active"),
        student("R002"),
        student("R003", status="inactive"),
        student("R004", status="pending"),
        student("OTHER-BATCH", status="inactive", batch_id="batch-b"),
    ])

    students = await StudentRepository(db).find_by_group(batch_id="batch-a", active_only=False)

    assert [entry["roll_number"] for entry in students] == ["R001", "R002", "R003", "R004"]


@pytest.mark.asyncio
async def test_roster_does_not_silently_stop_at_one_thousand_students(db):
    await db.students.insert_many([
        student(f"R{index:04d}", status="active") for index in range(1001)
    ])

    roster = await AttendanceService(db).load_roster({
        "course": None, "branch": None, "section": None, "batch_id": "batch-a",
    })

    assert len(roster) == 1001
    assert roster[0]["roll_number"] == "R0000"
    assert roster[-1]["roll_number"] == "R1000"


@pytest.mark.asyncio
async def test_saved_attendance_shows_only_current_batch_without_deleting_history(db):
    inserted = await db.students.insert_many([
        student("R001"),
        student("R002", status="active"),
        student("R003", status="inactive"),
        student("R004", status="active", batch_id="batch-b"),
        student("R005"),
        student("R006", status="inactive"),
    ])
    now = datetime.now(timezone.utc)
    class_id = (await db.classes.insert_one({
        "course": None, "branch": None, "section": None, "batch_id": "batch-a",
        "date": now, "attendance_marked": True,
    })).inserted_id
    session_id = (await db.attendance_sessions.insert_one({
        "class_id": class_id, "marked_by": "admin", "updated_at": now,
    })).inserted_id
    await db.attendance_records.insert_many([
        {"class_session_id": session_id, "student_id": inserted.inserted_ids[index], "status": status, "date": now}
        for index, status in [(0, "absent"), (2, "late"), (3, "leave")]
    ])
    original_session = await db.attendance_sessions.find_one({"_id": session_id})
    original_records = await db.attendance_records.find({}).to_list(length=None)

    view = await AttendanceService(db).get_session_view(str(class_id))

    assert [(entry["roll_number"], entry["status"]) for entry in view["records"]] == [
        ("R001", "absent"), ("R002", "unmarked"), ("R005", "unmarked"),
    ]
    assert await db.attendance_sessions.find_one({"_id": session_id}) == original_session
    assert await db.attendance_records.find({}).to_list(length=None) == original_records
    assert await db.students.find_one({"_id": inserted.inserted_ids[2], "status": "inactive"})
    assert await db.students.find_one({"_id": inserted.inserted_ids[4], "status": {"$exists": False}})


@pytest.mark.asyncio
async def test_attendance_save_rejects_partial_duplicate_and_other_batch_rosters(db):
    inserted = await db.students.insert_many([
        student("R001", status="active"),
        student("R002", status="active"),
        student("OTHER", status="active", batch_id="batch-b"),
    ])
    class_id = (await db.classes.insert_one({
        "batch_id": "batch-a", "date": datetime.now(timezone.utc),
    })).inserted_id
    first, second, outsider = [str(value) for value in inserted.inserted_ids]
    service = AttendanceService(db)

    for records in [
        [{"student_id": first, "status": "present"}],
        [{"student_id": first, "status": "present"}, {"student_id": first, "status": "absent"}],
        [{"student_id": first, "status": "present"}, {"student_id": outsider, "status": "absent"}],
    ]:
        with pytest.raises(AppError):
            await service.save_attendance(str(class_id), records, actor={})

    assert await db.attendance_sessions.count_documents({}) == 0
    assert await db.attendance_records.count_documents({}) == 0


@pytest.mark.asyncio
async def test_legacy_attendance_can_be_assigned_only_to_its_students_batch(db):
    batch_a = (await db.batches.insert_one({"batch_code": "A", "name": "Batch A"})).inserted_id
    batch_b = (await db.batches.insert_one({"batch_code": "B", "name": "Batch B"})).inserted_id
    inserted = await db.students.insert_many([
        student("R001", batch_id=str(batch_a), status="active"),
        student("R002", batch_id=str(batch_a), status="active"),
        student("OTHER", batch_id=str(batch_b), status="active"),
    ])
    now = datetime.now(timezone.utc)
    actor = {"_id": ObjectId(), "role": "SUPER_ADMIN"}
    service = ClassService(db)

    matching_class = (await db.classes.insert_one({
        "batch_id": None, "date": now, "subject": "DSC", "attendance_marked": True,
    })).inserted_id
    matching_session = (await db.attendance_sessions.insert_one({
        "class_id": matching_class, "marked_by": "admin", "updated_at": now,
    })).inserted_id
    await db.attendance_records.insert_many([
        {"class_session_id": matching_session, "student_id": inserted.inserted_ids[0], "status": "present", "date": now},
        {"class_session_id": matching_session, "student_id": inserted.inserted_ids[1], "status": "absent", "date": now},
    ])

    updated = await service.update(str(matching_class), {"batch_id": str(batch_a)}, actor)
    assert updated["batch_id"] == str(batch_a)
    view = await AttendanceService(db).get_session_view(str(matching_class))
    assert [(entry["roll_number"], entry["status"]) for entry in view["records"]] == [
        ("R001", "present"), ("R002", "absent"),
    ]
    with pytest.raises(ConflictError, match="cannot be changed"):
        await service.update(str(matching_class), {"batch_id": str(batch_b)}, actor)

    mismatched_class = (await db.classes.insert_one({
        "batch_id": None, "date": now, "subject": "OS", "attendance_marked": True,
    })).inserted_id
    mismatched_session = (await db.attendance_sessions.insert_one({
        "class_id": mismatched_class, "marked_by": "admin", "updated_at": now,
    })).inserted_id
    await db.attendance_records.insert_many([
        {"class_session_id": mismatched_session, "student_id": inserted.inserted_ids[0], "status": "present", "date": now},
        {"class_session_id": mismatched_session, "student_id": inserted.inserted_ids[2], "status": "absent", "date": now},
    ])

    with pytest.raises(ConflictError, match="outside this batch"):
        await service.update(str(mismatched_class), {"batch_id": str(batch_a)}, actor)
    assert (await db.classes.find_one({"_id": mismatched_class}))["batch_id"] is None


@pytest.mark.asyncio
async def test_batch_counts_follow_students_when_reassigned(db):
    first = (await db.batches.insert_one({
        "batch_code": "FIRST", "name": "First", "student_count": 99,
        "created_at": datetime.now(timezone.utc),
    })).inserted_id
    second = (await db.batches.insert_one({
        "batch_code": "SECOND", "name": "Second", "student_count": 0,
        "created_at": datetime.now(timezone.utc),
    })).inserted_id
    await db.students.insert_one(student("R001", batch_id=str(first)))
    service = BatchService(db)

    before = await service.list_batches()
    assert {item["id"]: item["student_count"] for item in before["items"]} == {
        str(first): 1, str(second): 0,
    }

    await service.assign_students(str(second), ["R001"])

    after = await service.list_batches()
    assert {item["id"]: item["student_count"] for item in after["items"]} == {
        str(first): 0, str(second): 1,
    }
    assert (await db.batches.find_one({"_id": first}))["student_count"] == 0
    assert (await db.batches.find_one({"_id": second}))["student_count"] == 1


@pytest.mark.asyncio
async def test_remove_and_readd_batch_student_preserves_profile_and_attendance(db):
    batch_id = (await db.batches.insert_one({
        "batch_code": "EVENING", "name": "Evening", "student_count": 1,
    })).inserted_id
    student_id = (await db.students.insert_one(student(
        "R001", batch_id=str(batch_id), status="active", email="r001@example.test",
    ))).inserted_id
    now = datetime.now(timezone.utc)
    class_id = (await db.classes.insert_one({
        "batch_id": str(batch_id), "date": now, "subject": "DSC",
    })).inserted_id
    session_id = (await db.attendance_sessions.insert_one({
        "class_id": class_id, "marked_by": "admin", "updated_at": now,
    })).inserted_id
    await db.attendance_records.insert_one({
        "class_session_id": session_id, "student_id": student_id,
        "status": "absent", "date": now,
    })
    original_student = await db.students.find_one({"_id": student_id})
    original_attendance = await db.attendance_records.find_one({"student_id": student_id})
    service = BatchService(db)
    attendance = AttendanceService(db)
    assert (await attendance.get_session_view(str(class_id)))["records"][0]["status"] == "absent"

    await service.remove_student(
        str(batch_id), str(student_id),
        actor={"_id": ObjectId(), "role": "SUPER_ADMIN"},
    )

    unassigned = await db.students.find_one({"_id": student_id})
    assert unassigned == {**original_student, "batch_id": None}
    assert (await service.get_batch_students(str(batch_id)))["total"] == 0
    assert (await db.batches.find_one({"_id": batch_id}))["student_count"] == 0
    assert (await db.attendance_records.find_one({"student_id": student_id})) == original_attendance
    assert (await attendance.get_session_view(str(class_id)))["records"] == []
    audit = await db.audit_logs.find_one({"entity": "student", "entity_id": str(student_id)})
    assert audit["old_data"]["batch_id"] == str(batch_id)
    assert audit["new_data"]["batch_id"] is None

    await service.assign_students(str(batch_id), ["R001"])

    assert await db.students.find_one({"_id": student_id}) == original_student
    assert (await service.get_batch_students(str(batch_id)))["total"] == 1
    assert (await db.attendance_records.find_one({"student_id": student_id})) == original_attendance
    assert (await attendance.get_session_view(str(class_id)))["records"][0]["status"] == "absent"


@pytest.mark.asyncio
async def test_remove_batch_student_rejects_wrong_mapping_and_unknown_student(db):
    first = (await db.batches.insert_one({"batch_code": "FIRST", "name": "First"})).inserted_id
    second = (await db.batches.insert_one({"batch_code": "SECOND", "name": "Second"})).inserted_id
    student_id = (await db.students.insert_one(student("R001", batch_id=str(first)))).inserted_id
    service = BatchService(db)

    with pytest.raises(ConflictError, match="not assigned"):
        await service.remove_student(str(second), str(student_id))
    with pytest.raises(NotFoundError, match="Student not found"):
        await service.remove_student(str(first), str(ObjectId()))
    with pytest.raises(AppError, match="Invalid student ID"):
        await service.remove_student(str(first), "invalid")

    assert (await db.students.find_one({"_id": student_id}))["batch_id"] == str(first)


@pytest.mark.asyncio
async def test_accepted_invitation_creates_an_explicitly_active_student(db):
    token = "attendance-roster-invitation-token"
    await db.invitations.insert_one({
        "email": "new-student@example.test",
        "role": "STUDENT",
        "token_hash": security.hash_token(token),
        "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
    })

    await InvitationService(db).accept(token, {
        "first_name": "New", "last_name": "Student", "roll_number": "NEW001",
        "password": "TestPass!123", "course": "B.Tech", "branch": "CSE", "section": "A",
    })

    created = await db.students.find_one({"roll_number": "NEW001"})
    assert created["status"] == "active"
    assert created["user_id"]
    assert await db.users.find_one({"email": "new-student@example.test", "is_active": True})
