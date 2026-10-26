"""Admin API endpoints for Batch management."""

from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.deps import get_db, require_staff
from app.core.errors import AppError
from app.schemas.batch import (
    BatchAssignRequest,
    BatchAssignResponse,
    BatchCreate,
    BatchUpdate,
    BatchListResponse,
    BatchOut,
)
from app.schemas.student import StudentListResponse
from app.services.batch_service import BatchService
from app.services.batch_monitor_service import BatchMonitorService
from app.services.coding_activity_service import normalize_activity_range
from app.integrations.activity_time import get_activity_timezone
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/admin", tags=["admin-batches"])


@router.get("/batches", response_model=BatchListResponse)
async def list_batches(
    page: int = 1,
    page_size: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """List all batches."""
    service = BatchService(db)
    return await service.list_batches(page, page_size)


@router.post("/batches", response_model=BatchOut)
async def create_batch(
    req: BatchCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """Create a new batch."""
    service = BatchService(db)
    return await service.create_batch(req.model_dump())


@router.delete("/batches/{batch_id}", status_code=204)
async def delete_batch(
    batch_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """Delete a batch and remove it from all students."""
    service = BatchService(db)
    await service.delete_batch(batch_id)


@router.post("/batches/{batch_id}/assign", response_model=BatchAssignResponse)
async def assign_students(
    batch_id: str,
    req: BatchAssignRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """Assign students to a batch by roll numbers."""
    service = BatchService(db)
    return await service.assign_students(batch_id, req.roll_numbers)


@router.post("/batches/{batch_id}/upload", response_model=BatchAssignResponse)
async def upload_batch_students(
    batch_id: str,
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """Upload an Excel file containing a roll_number column to assign students."""
    if not file.filename.endswith((".xlsx")):
        raise AppError("Only .xlsx files are supported for batch upload", status_code=400)
    
    content = await file.read()
    service = BatchService(db)
    return await service.parse_and_assign_xlsx(batch_id, content)


@router.get("/batches/{batch_id}/students", response_model=StudentListResponse)
async def get_batch_students(
    batch_id: str,
    page: int = 1,
    page_size: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """List students within a specific batch."""
    service = BatchService(db)
    return await service.get_batch_students(batch_id, page, page_size)


@router.get("/batches/{batch_id}/monitor")
async def monitor_batch(
    batch_id: str,
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """Monitor current batch members within an inclusive date interval."""
    timezone_name = get_activity_timezone(
        await SettingsService(db).get("timezone", "Asia/Kolkata")
    ).key
    start, end = normalize_activity_range(start_date, end_date, timezone_name)
    return await BatchMonitorService(db).summary(batch_id, start, end, timezone_name)


@router.delete("/batches/{batch_id}/students/{student_id}", status_code=204)
async def remove_batch_student(
    batch_id: str,
    student_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    """Remove only the batch assignment; preserve student and attendance data."""
    from app.core.rate_limit import client_ip

    service = BatchService(db)
    await service.remove_student(
        batch_id, student_id, actor=admin, ip=client_ip(request)
    )


@router.patch("/batches/{batch_id}", response_model=BatchOut)
async def update_batch(
    batch_id: str,
    req: BatchUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(require_staff),
):
    update_data = req.model_dump(exclude_unset=True)
    if not update_data:
        raise AppError("No data provided to update", 400)
    from bson import ObjectId
    try:
        oid = ObjectId(batch_id)
    except Exception:
        raise AppError("Invalid batch ID format", 400)
    res = await db.batches.find_one_and_update(
        {"_id": oid},
        {"$set": update_data},
        return_document=True
    )
    if not res:
        raise AppError("Batch not found", 404)
    res["id"] = str(res.pop("_id"))
    return res
