"""Batch-related schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

class BatchCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    batch_code: str = Field(min_length=1, max_length=64, description="Unique identifier for the batch (e.g. 2026-CSE)")
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None

class BatchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None

class BatchOut(BaseModel):
    id: str
    batch_code: str = ""
    name: str
    description: str | None = None
    student_count: int = 0
    created_at: datetime | str | None = None

class BatchAssignRequest(BaseModel):
    roll_numbers: list[str] = Field(..., description="List of student roll numbers to assign to this batch")

class BatchAssignResponse(BaseModel):
    success_count: int
    failed_roll_numbers: list[str]

class BatchListResponse(BaseModel):
    items: list[BatchOut]
    total: int
    page: int
    page_size: int
    total_pages: int
