"""Admin analytics, reports, settings and audit logs."""

import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.core.deps import get_db, require_staff
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/admin", tags=["admin-analytics"])


@router.get("/analytics")
async def analytics(
    days: int = Query(default=30, ge=7, le=365),
    course: str | None = None,
    branch: str | None = None,
    section: str | None = None,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    service = AnalyticsService(db)
    return {
        "attendance_trend": await service.attendance_trend(days),
        "by_course": await service.attendance_breakdown("course"),
        "by_branch": await service.attendance_breakdown("branch"),
        "by_section": await service.attendance_breakdown("section"),
        "distribution": await service.attendance_distribution(),
        "coding_trend": await service.coding_performance_trend(days),
        "attendance_vs_coding": await service.attendance_vs_coding(),
        "perfect_attendance": await service.perfect_attendance_students(),
        "low_attendance": await service.low_attendance_students(),
        "platform_distribution": await service.platform_distribution(),
    }


@router.get("/analytics/student/{student_id}")
async def student_analytics(
    student_id: str,
    days: int = Query(default=90, ge=7, le=365),
    user=Depends(require_staff),
    db=Depends(get_db),
):
    """Comprehensive per-student analytics: profile, attendance summary + trend,
    attendance broken down by subject, recent records, coding profile statistics,
    and leaderboard rank. Used by the admin student report page."""
    service = AnalyticsService(db)
    return await service.student_report(student_id, days)


@router.get("/reports/student/{student_id}")
async def student_report_download(
    student_id: str,
    format: str = Query(default="pdf", pattern="^(csv|xlsx|pdf)$"),
    days: int = Query(default=90, ge=7, le=365),
    user=Depends(require_staff),
    db=Depends(get_db),
):
    """Download a single student's report as CSV / XLSX / PDF."""
    from datetime import datetime, timezone

    service = AnalyticsService(db)
    report = await service.student_report(student_id, days)
    if not report or report.get("error"):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404, detail=report.get("error", "student_not_found")
        )

    from app.services.report_service import (
        student_report_to_csv,
        student_report_to_pdf,
        student_report_to_xlsx,
    )

    profile = report["profile"]
    safe_name = (
        profile.get("name") or profile.get("roll_number") or student_id
    ).replace(" ", "_")
    safe_name = (
        "".join(c for c in safe_name if c.isalnum() or c in ("_", "-"))[:60]
        or "student"
    )
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")

    if format == "csv":
        return _report_response(
            student_report_to_csv(report),
            f"{safe_name}_{stamp}.csv",
            "text/csv",
        )
    if format == "xlsx":
        return _report_response(
            student_report_to_xlsx(report),
            f"{safe_name}_{stamp}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    return _report_response(
        student_report_to_pdf(report),
        f"{safe_name}_{stamp}.pdf",
        "application/pdf",
    )


def _report_response(
    content: bytes, filename: str, media_type: str
) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _collect_report(db, report_type: str):
    from app.repositories.users import StudentRepository

    headers_map = {
        "students": [
            "Roll Number",
            "Name",
            "Email",
            "Course",
            "Branch",
            "Section",
            "Status",
        ],
        "attendance": ["Student", "Roll Number", "Attendance %"],
        "leaderboard": [
            "Rank",
            "Student",
            "Roll Number",
            "Overall Score",
            "Attendance %",
        ],
        "coding": [
            "Student",
            "Platform",
            "Username",
            "Rating",
            "Problems Solved",
            "Last Synced",
        ],
        "low-attendance": [
            "Student",
            "Roll Number",
            "Email",
            "Attendance %",
            "Course",
            "Branch",
            "Section",
        ],
    }
    rows = []
    if report_type == "attendance":
        cursor = db.leaderboard_scores.find(
            {"platform": "overall"},
            {"metrics.attendance_percentage": 1, "student_name": 1, "roll_number": 1},
        ).sort([("metrics.attendance_percentage", 1)])
        async for d in cursor:
            m = d.get("metrics") or {}
            att = m.get("attendance_percentage")
            if att is not None:
                rows.append([d.get("student_name"), d.get("roll_number"), att])
        title = "Attendance Report"
    elif report_type == "leaderboard":
        rank = 0
        cursor = (
            db.leaderboard_scores.find({"platform": "overall"})
            .sort([("score", -1)])
            .limit(500)
        )
        async for d in cursor:
            rank += 1
            m = d.get("metrics") or {}
            rows.append(
                [
                    rank,
                    d.get("student_name"),
                    d.get("roll_number"),
                    round(float(d.get("score") or 0), 2),
                    m.get("attendance_percentage"),
                ]
            )
        title = "Leaderboard Report"
    elif report_type == "coding":
        async for p in db.coding_profiles.find({}):
            stats_doc = await db.coding_statistics.find_one(
                {"student_id": p["student_id"], "platform": p["platform"]}
            )
            st = (stats_doc or {}).get("statistics") or {}
            fetched = (
                stats_doc.get("fetched_at").strftime("%d %b %Y")
                if stats_doc and stats_doc.get("fetched_at")
                else "-"
            )
            rows.append(
                [
                    (await _name_of(db, p["student_id"])),
                    p["platform"],
                    p.get("username"),
                    st.get("rating"),
                    int(st.get("problems_solved") or 0),
                    fetched,
                ]
            )
        title = "Coding Performance Report"
    elif report_type == "low-attendance":
        # Students whose attendance is below the configured threshold.
        service = AnalyticsService(db)
        low = await service.low_attendance_students()
        for s in low:
            student_doc = await db.students.find_one({"_id": s.get("student_id")})
            user_doc = (
                await db.users.find_one({"_id": s.get("user_id")})
                if s.get("user_id")
                else None
            )
            rows.append(
                [
                    s.get("name") or (await _name_of(db, s.get("student_id"))),
                    s.get("roll_number") or (student_doc or {}).get("roll_number"),
                    (user_doc or {}).get("email"),
                    s.get("attendance_percentage"),
                    (student_doc or {}).get("course"),
                    (student_doc or {}).get("branch"),
                    (student_doc or {}).get("section"),
                ]
            )
        title = "Low Attendance Report"
    else:
        students_repo = StudentRepository(db)
        docs, _ = await students_repo.list({}, page=1, page_size=10000)
        for d in docs:
            rows.append(
                [
                    d.get("roll_number"),
                    f"{d.get('first_name')} {d.get('last_name')}",
                    d.get("email"),
                    d.get("course"),
                    d.get("branch"),
                    d.get("section"),
                    d.get("status"),
                ]
            )
        title = "Students Report"
    return title, headers_map.get(report_type, headers_map["students"]), rows


async def _name_of(db, student_oid) -> str:
    doc = await db.students.find_one(
        {"_id": student_oid}, {"first_name": 1, "last_name": 1}
    )
    return f"{(doc or {}).get('first_name', '')} {(doc or {}).get('last_name', '')}".strip()


@router.get("/reports")
async def reports(
    type: str = Query(
        default="students",
        pattern="^(students|attendance|leaderboard|coding|low-attendance)$",
    ),
    format: str = Query(default="csv", pattern="^(csv|xlsx|pdf)$"),
    user=Depends(require_staff),
    db=Depends(get_db),
):
    from datetime import datetime, timezone

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    title, headers, rows = await _collect_report(db, type)
    from app.services.report_service import rows_to_csv, rows_to_pdf, rows_to_xlsx

    safe_title = title.replace(" ", "_")
    if format == "csv":
        return _report_response(
            rows_to_csv(headers, rows), f"{safe_title}_{stamp}.csv", "text/csv"
        )
    if format == "xlsx":
        return _report_response(
            rows_to_xlsx(headers, rows),
            f"{safe_title}_{stamp}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    return _report_response(
        rows_to_pdf(title, headers, rows),
        f"{safe_title}_{stamp}.pdf",
        "application/pdf",
    )
