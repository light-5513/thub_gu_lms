"""Student portal APIs: dashboard, profile, attendance, streaks, coding profiles, leaderboard."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_db, require_student
from app.core.errors import AppError, ConflictError, NotFoundError
from app.integrations import available_platforms
from app.repositories.coding import CodingProfileRepository
from app.services.leaderboard_service import LeaderboardService
from app.services.settings_service import SettingsService
from app.services.streak_service import compute_streaks

router = APIRouter(prefix="/student", tags=["student"])


async def _require_student_doc(db, user):

    doc = await db.students.find_one({"user_id": str(user["_id"])})
    if not doc:
        raise NotFoundError("Student profile not found for this account")
    return doc


@router.get("/dashboard")
async def dashboard(user=Depends(require_student), db=Depends(get_db)):
    student = await _require_student_doc(db, user)
    records = (
        await db.attendance_records.find({"student_id": student["_id"]})
        .sort([("date", 1)])
        .to_list(50000)
    )

    settings_svc = SettingsService(db)
    rules = await settings_svc.streak_rules()
    streak_info = compute_streaks(records, rules)
    threshold = await settings_svc.attendance_threshold()

    present = sum(1 for r in records if r["status"] == "present")
    late = sum(1 for r in records if r["status"] == "late")
    absent = sum(1 for r in records if r["status"] == "absent")
    leave = sum(1 for r in records if r["status"] == "leave")
    total = len(records)

    # Coding stats
    profiles_repo = CodingProfileRepository(db)
    stats_docs = await profiles_repo.all_statistics_for_student(str(student["_id"]))
    platform_stats = []
    for d in stats_docs:
        platform_stats.append(
            {
                "platform": d["platform"],
                "statistics": d.get("statistics", {}),
                "fetched_at": d["fetched_at"].isoformat()
                if isinstance(d.get("fetched_at"), datetime)
                else None,
            }
        )
    from app.services.scoring_engine import compute_coding_score, compute_overall

    coding_score = compute_coding_score(platform_stats)
    scores = compute_overall(
        streak_info.get("attendance_percentage"),
        coding_score,
        streak_info["current_streak"],
        await settings_svc.weights(),
    )

    return {
        "student": {
            "id": str(student["_id"]),
            "first_name": student.get("first_name"),
            "last_name": student.get("last_name"),
            "course": student.get("course"),
            "branch": student.get("branch"),
            "section": student.get("section"),
            "roll_number": student.get("roll_number"),
        },
        "attendance": {
            "percentage": streak_info.get("attendance_percentage"),
            "present": present,
            "late": late,
            "absent": absent,
            "leave": leave,
            "total_classes": total,
            "threshold": threshold,
        },
        "streaks": {
            "current_streak": streak_info["current_streak"],
            "longest_streak": streak_info["longest_streak"],
        },
        "coding": {
            "score": coding_score,
            "platforms": platform_stats,
        },
        "scores": scores,
        "overall_rank": await LeaderboardService(db).repo.rank_of(
            str(student["_id"]), "overall"
        ),
    }


@router.get("/profile")
async def get_profile(user=Depends(require_student), db=Depends(get_db)):
    student = await _require_student_doc(db, user)
    return {
        "id": str(student["_id"]),
        "first_name": student.get("first_name"),
        "last_name": student.get("last_name"),
        "email": student.get("email"),
        "roll_number": student.get("roll_number"),
        "course": student.get("course"),
        "branch": student.get("branch"),
        "section": student.get("section"),
        "phone": student.get("phone"),
        "batch_id": student.get("batch_id"),
        "academic_year_id": student.get("academic_year_id"),
        "permissions": {
            "email_editable": False,
            "everything_else_editable": True,
        },
    }


@router.put("/profile")
async def update_profile(
    payload: dict, user=Depends(require_student), db=Depends(get_db)
):
    """Students may edit everything except their email."""
    student = await _require_student_doc(db, user)
    allowed = {
        "first_name",
        "last_name",
        "phone",
        "roll_number",
        "course",
        "branch",
        "section",
    }
    updates = {
        k: (v.strip() if isinstance(v, str) else v)
        for k, v in payload.items()
        if k in allowed
    }
    if not updates:
        raise AppError("No editable fields provided", 400)
    if "email" in payload or "user_id" in payload:
        raise AppError("Email cannot be changed", 400)
    if "roll_number" in updates:
        existing = await db.students.find_one(
            {"roll_number": updates["roll_number"], "_id": {"$ne": student["_id"]}}
        )
        if existing:
            raise ConflictError(
                f"Roll number {updates['roll_number']} is already in use"
            )
    await db.students.update_one({"_id": student["_id"]}, {"$set": updates})
    return {"message": "Profile updated"}


@router.get("/attendance")
async def my_attendance(
    year: int | None = None, user=Depends(require_student), db=Depends(get_db)
):
    student = await _require_student_doc(db, user)
    match = {"student_id": student["_id"]}
    if year:
        start = datetime(year, 1, 1)
        end = datetime(year + 1, 1, 1)
        match["date"] = {"$gte": start, "$lt": end}
    cursor = (
        db.attendance_records.find(match, {"student_id": 0})
        .sort([("date", -1)])
        .limit(2000)
    )
    records = []
    async for r in cursor:
        session = (
            await db.attendance_sessions.find_one({"_id": r["class_session_id"]})
            if r.get("class_session_id")
            else None
        )
        cls = (
            await db.classes.find_one(
                {"_id": session["class_id"]},
                {"subject": 1, "topic": 1, "course": 1, "branch": 1, "section": 1},
            )
            if session
            else None
        )
        records.append(
            {
                "date": r["date"].isoformat()
                if hasattr(r.get("date"), "isoformat")
                else str(r.get("date")),
                "status": r.get("status"),
                "class_id": str(session["class_id"]) if session else None,
                "subject": (cls or {}).get("subject"),
                "topic": (cls or {}).get("topic"),
            }
        )
    return {"records": records}


@router.get("/heatmap")
async def heatmap(
    year: int | None = None, user=Depends(require_student), db=Depends(get_db)
):
    """GitHub-style heatmap: one entry per date that had a class.

    Dates without scheduled classes are simply absent — never counted as absence.
    """
    student = await _require_student_doc(db, user)
    current_year = year or datetime.now().year
    start = datetime(current_year, 1, 1)
    end = datetime(current_year + 1, 1, 1)

    pipeline = [
        {"$match": {"student_id": student["_id"], "date": {"$gte": start, "$lt": end}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                "statuses": {"$push": "$status"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    rows = await db.attendance_records.aggregate(pipeline).to_list(400)

    days = []
    for row in rows:
        statuses = row["statuses"]
        worst_priority = {"absent": 0, "leave": 1, "late": 2, "present": 3}
        day_status = min(statuses, key=lambda s: worst_priority.get(s, 4))
        days.append(
            {
                "date": row["_id"],
                "status": day_status,
                "classes": row["count"],
                "breakdown": {s: statuses.count(s) for s in set(statuses)},
            }
        )
    return {"year": current_year, "days": days}


@router.get("/streak")
async def streak(user=Depends(require_student), db=Depends(get_db)):
    student = await _require_student_doc(db, user)
    records = (
        await db.attendance_records.find({"student_id": student["_id"]})
        .sort([("date", 1)])
        .to_list(50000)
    )
    rules = await SettingsService(db).streak_rules()
    info = compute_streaks(records, rules)
    return info


@router.get("/leaderboard")
async def leaderboard(
    tab: str = Query(default="overall"),
    course=None,
    branch=None,
    section=None,
    batch_id=None,
    academic_year_id=None,
    user=Depends(require_student),
    db=Depends(get_db),
):
    service = LeaderboardService(db)
    filters = {
        "course": course,
        "branch": branch,
        "section": section,
        "batch_id": batch_id,
        "academic_year_id": academic_year_id,
    }
    result = await service.get_leaderboard(tab, filters)
    student = await _require_student_doc(db, user)
    sid = str(student["_id"])
    me = next((e for e in result["entries"] if e["student_id"] == sid), None)
    if me is None:
        rank = await service.repo.rank_of(sid, tab.lower())
        me = {"rank": rank} if rank else None
    return {**result, "me": me}


# ------------------------------------------------------------------ coding profiles
@router.get("/coding-profiles")
async def coding_profiles(user=Depends(require_student), db=Depends(get_db)):
    student = await _require_student_doc(db, user)
    repo = CodingProfileRepository(db)
    profiles = await repo.list_profiles(str(student["_id"]))
    out = {}
    for p in profiles:
        stats = await repo.get_statistics(str(student["_id"]), p["platform"])
        out[p["platform"]] = {
            "platform": p["platform"],
            "username": p.get("username"),
            "profile_url": p.get("profile_url") or "",
            "verified": bool(p.get("verified")),
            "sync_status": p.get("sync_status", "never_synced"),
            "last_synced_at": stats["fetched_at"].isoformat()
            if stats and isinstance(stats.get("fetched_at"), datetime)
            else None,
            "sync_error": p.get("sync_error"),
            "statistics": (stats or {}).get("statistics", {}),
        }
    return {"profiles": out, "supported_platforms": available_platforms()}


@router.post("/coding-profiles")
async def upsert_coding_profile(
    payload: dict, user=Depends(require_student), db=Depends(get_db)
):
    student = await _require_student_doc(db, user)
    platform = payload.get("platform")
    username = (payload.get("username") or "").strip()
    if platform not in available_platforms():
        raise AppError("Unsupported platform", 400)
    if not username:
        raise AppError("Username is required", 400)
    repo = CodingProfileRepository(db)
    await repo.upsert_profile(str(student["_id"]), platform, username)
    return {
        "message": f"{platform.capitalize()} profile saved. Statistics will update after sync."
    }


@router.delete("/coding-profiles/{platform}")
async def delete_coding_profile(
    platform: str, user=Depends(require_student), db=Depends(get_db)
):
    student = await _require_student_doc(db, user)
    if platform not in available_platforms():
        raise AppError("Unsupported platform", 400)
    repo = CodingProfileRepository(db)
    await repo.delete_profile(str(student["_id"]), platform)
    return {"message": "Profile removed"}
