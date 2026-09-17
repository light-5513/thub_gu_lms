"""Class management + daily attendance marking/editing."""

import math
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.core.deps import get_db, require_staff
from app.models.enums import AttendanceStatus
from app.repositories.attendance import ClassRepository
from app.schemas.attendance import AttendanceMarkRequest, ClassCreate, ClassUpdate
from app.services.attendance_service import AttendanceService, ClassService

router = APIRouter(prefix="/admin", tags=["admin-classes"])


class AttendanceRecordPatch(BaseModel):
    status: AttendanceStatus = Field(
        ..., description="New attendance status for the student"
    )


@router.get("/classes")
async def list_classes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    course: str | None = None,
    branch: str | None = None,
    section: str | None = None,
    batch_id: str | None = None,
    academic_year_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    repo = ClassRepository(db)
    filters = repo.build_filters(
        course,
        branch,
        section,
        batch_id,
        academic_year_id,
        date_from.date() if date_from else None,
        date_to.date() if date_to else None,
    )
    docs, total = await repo.list(filters, page, page_size)
    return {
        "items": [ClassService(db).serialize(d) for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router.post("/classes", status_code=201)
async def create_class(
    payload: ClassCreate,
    request: Request,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    from app.core.rate_limit import client_ip

    service = ClassService(db)
    created = await service.create(
        payload.model_dump(mode="json"), user, ip=client_ip(request)
    )
    return {
        "message": "Class created",
        "id": str(created["_id"]),
        "class": service.serialize(created),
    }


@router.get("/classes/{class_id}")
async def get_class(class_id: str, user=Depends(require_staff), db=Depends(get_db)):
    service = ClassService(db)
    doc = await service.get(class_id)
    return service.serialize(doc)


@router.put("/classes/{class_id}")
async def update_class(
    class_id: str,
    payload: ClassUpdate,
    request: Request,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    from app.core.rate_limit import client_ip

    service = ClassService(db)
    updated = await service.update(
        class_id,
        payload.model_dump(mode="json", exclude_unset=True),
        user,
        ip=client_ip(request),
    )
    return {"message": "Class updated", "class": service.serialize(updated)}


@router.delete("/classes/{class_id}")
async def delete_class(
    class_id: str, request: Request, user=Depends(require_staff), db=Depends(get_db)
):
    from app.core.rate_limit import client_ip

    service = ClassService(db)
    await service.delete(class_id, user, ip=client_ip(request))
    return {"message": "Class and its attendance records deleted"}


@router.post("/classes/{class_id}/duplicate")
async def duplicate_class(
    class_id: str, request: Request, user=Depends(require_staff), db=Depends(get_db)
):
    from app.core.rate_limit import client_ip

    service = ClassService(db)
    original = await service.get(class_id)
    payload = {
        k: v
        for k, v in original.items()
        if k not in {"_id", "created_at", "created_by", "attendance_marked"}
    }
    created = await service.create(payload, user, ip=client_ip(request))
    return {"message": "Class duplicated", "id": str(created["_id"])}


# ------------------------------------------------------------------ attendance
@router.post("/classes/{class_id}/attendance")
async def save_attendance(
    class_id: str,
    payload: AttendanceMarkRequest,
    request: Request,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    from app.core.rate_limit import client_ip

    service = AttendanceService(db)
    result = await service.save_attendance(
        class_id,
        [r.model_dump() for r in payload.records],
        user,
        override=payload.override,
        ip=client_ip(request),
    )
    return {"message": f"Attendance saved for {result['records']} students"}


@router.get("/classes/{class_id}/attendance")
async def get_attendance(
    class_id: str, user=Depends(require_staff), db=Depends(get_db)
):
    service = AttendanceService(db)
    session_view = await service.get_session_view(class_id)
    roster = await service.load_roster(await ClassService(db).get(class_id))
    if not session_view:
        # Pre-fill roster with unmarked statuses
        return {
            "class_session_id": None,
            "records": [{**r, "status": "unmarked"} for r in roster],
            "marked": False,
        }
    return {**session_view, "marked": True}


@router.patch("/classes/{class_id}/attendance/{student_id}")
async def edit_attendance_record(
    class_id: str,
    student_id: str,
    payload: AttendanceRecordPatch,
    request: Request,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    """Edit a single student's attendance status for an already-marked class.
    Every change is written to the audit log. Returns 404 if no attendance
    has been saved for this class yet."""
    from app.core.rate_limit import client_ip

    service = AttendanceService(db)
    await service.edit_record(
        class_id,
        student_id,
        payload.status.value,
        user,
        ip=client_ip(request),
    )
    return {"message": "Attendance record updated"}
