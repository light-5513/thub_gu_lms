"""Bulk import: admin uploads an .xlsx of students, previews errors, then confirms.

Two-step flow (per `ImportService`):
  1. POST /admin/imports/preview  → upload .xlsx, get {valid_count, invalid_count, import_token}
  2. POST /admin/imports/confirm  → body: {import_token}, server actually creates students

A single-shot `POST /admin/imports/commit` is provided for convenience when the
admin already trusts the file (skips the preview).
"""

from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel

from app.core.deps import get_db, require_admin
from app.core.rate_limit import client_ip
from app.services.import_service import ImportService

router = APIRouter(prefix="/admin/imports", tags=["admin-imports"])


@router.post("/preview")
async def preview(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(require_admin),
    db=Depends(get_db),
) -> dict[str, Any]:
    """Parse and validate the uploaded workbook. Returns counts + an import_token
    that must be passed to /confirm within 15 minutes."""
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        from app.core.errors import AppError

        raise AppError("Only .xlsx files are accepted", 400)
    content = await file.read()
    service = ImportService(db)
    result = await service.preview(content)
    return result


class ImportConfirmRequest(BaseModel):
    import_token: str


@router.post("/confirm")
async def confirm(
    payload: ImportConfirmRequest,
    request: Request,
    user=Depends(require_admin),
    db=Depends(get_db),
) -> dict[str, Any]:
    """Create the students represented by an import_token previously returned by
    /preview. Returns {created, skipped, failed}."""
    service = ImportService(db)
    return await service.confirm(
        payload.import_token,
        user,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
