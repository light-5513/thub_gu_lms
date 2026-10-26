"""Admin student management: list/search/filter/paginate, CRUD, invitations."""

import math

from fastapi import APIRouter, Depends, Query, Request

from app.core.deps import get_db, require_staff
from app.schemas.student import StudentCreate, StudentUpdate
from app.services.student_service import StudentService

router = APIRouter(prefix="/admin/students", tags=["admin-students"])


def client_meta(request: Request):
    from app.core.rate_limit import client_ip

    return {"ip": client_ip(request), "user_agent": request.headers.get("user-agent")}


@router.get("")
async def list_students(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    course: str | None = None,
    branch: str | None = None,
    section: str | None = None,
    batch_id: str | None = None,
    academic_year_id: str | None = None,
    status: str | None = None,
    sort_by: str = Query(
        default="first_name",
        pattern="^(first_name|last_name|roll_number|course|branch|section|created_at)$",
    ),
    sort_dir: int = Query(default=1, ge=-1, le=1),
    user=Depends(require_staff),
    db=Depends(get_db),
):
    service = StudentService(db)
    items, total = await service.list_students(
        page,
        page_size,
        search,
        course,
        branch,
        section,
        batch_id,
        academic_year_id,
        status,
        sort_by,
        sort_dir,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.get("/export")
async def export_students(
    search: str | None = None,
    course: str | None = None,
    branch: str | None = None,
    section: str | None = None,
    batch_id: str | None = None,
    academic_year_id: str | None = None,
    status: str | None = None,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    import io
    from fastapi.responses import Response
    from openpyxl import Workbook
    
    service = StudentService(db)
    filters = service.students.build_filters(
        search, course, branch, section, batch_id, academic_year_id, status
    )
    docs, _ = await service.students.list(filters, page=1, page_size=100000, sort_by="roll_number", sort_dir=1)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Students"
    
    headers = ["Roll Number", "First Name", "Last Name", "Email", "Phone", "Course", "Branch", "Section", "Status"]
    ws.append(headers)
    
    for d in docs:
        ws.append([
            d.get("roll_number", ""),
            d.get("first_name", ""),
            d.get("last_name", ""),
            d.get("email", ""),
            d.get("phone", ""),
            d.get("course", ""),
            d.get("branch", ""),
            d.get("section", ""),
            d.get("status", "")
        ])
        
    output = io.BytesIO()
    wb.save(output)
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=students_export.xlsx"}
    )


@router.get("/{student_id}")
async def get_student(student_id: str, user=Depends(require_staff), db=Depends(get_db)):
    service = StudentService(db)
    doc = await service.students.get_by_id(student_id)
    if not doc:
        from app.core.errors import NotFoundError

        raise NotFoundError("Student not found")
    # Attach attendance + coding summaries
    records = (
        await db.attendance_records.find({"student_id": doc["_id"]})
        .sort([("date", -1)])
        .to_list(20000)
    )
    present = sum(1 for r in records if r["status"] in ("present", "late"))
    pct = round(present / len(records) * 100, 1) if records else None
    profiles = []
    async for p in db.coding_profiles.find({"student_id": doc["_id"]}):
        profiles.append(
            {
                "platform": p["platform"],
                "username": p.get("username"),
                "sync_status": p.get("sync_status"),
            }
        )
    scores = await db.leaderboard_scores.find_one(
        {"platform": "overall", "student_id": doc["_id"]}
    )
    return {
        **service.serialize(doc),
        "attendance_percentage": pct,
        "coding_profiles": profiles,
        "overall_score": float((scores or {}).get("score", 0) or 0),
    }


@router.post("", status_code=201)
async def create_student(
    payload: StudentCreate,
    request: Request,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    meta = client_meta(request)
    service = StudentService(db)
    result = await service.create_student(
        payload.model_dump(), user, ip=meta["ip"], user_agent=meta["user_agent"]
    )
    return {
        "message": "Student created and invitation email queued",
        "id": str(result["student"]["_id"]),
    }


@router.put("/{student_id}")
async def update_student(
    student_id: str,
    payload: StudentUpdate,
    request: Request,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    meta = client_meta(request)
    service = StudentService(db)
    updated = await service.update_student(
        student_id,
        payload.model_dump(exclude_unset=True),
        user,
        ip=meta["ip"],
        user_agent=meta["user_agent"],
    )
    return {"message": "Student updated", "student": service.serialize(updated)}


@router.delete("/{student_id}")
async def delete_student(
    student_id: str, request: Request, user=Depends(require_staff), db=Depends(get_db)
):
    meta = client_meta(request)
    service = StudentService(db)
    await service.delete_student(student_id, user, ip=meta["ip"])
    return {"message": "Student deactivated"}


@router.post("/{student_id}/resend-invitation")
async def resend_invitation(
    student_id: str, request: Request, user=Depends(require_staff), db=Depends(get_db)
):
    meta = client_meta(request)
    service = StudentService(db)
    await service.resend_invitation(student_id, user, ip=meta["ip"])
    return {"message": "Invitation email sent"}


@router.post("/{student_id}/reset-account")
async def reset_account(
    student_id: str, request: Request, user=Depends(require_staff), db=Depends(get_db)
):
    meta = client_meta(request)
    service = StudentService(db)
    await service.reset_account(student_id, user, ip=meta["ip"])
    return {"message": "Account reset. A new temporary password has been emailed."}
