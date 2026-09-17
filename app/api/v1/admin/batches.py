"""Admin API endpoints for Batch management."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.deps import get_db, require_staff
from app.core.errors import AppError
from app.schemas.batch import (
    BatchAssignRequest,
    BatchAssignResponse,
    BatchCreate,
    BatchListResponse,
    BatchOut,
)
from app.schemas.student import StudentListResponse
from app.services.batch_service import BatchService

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
