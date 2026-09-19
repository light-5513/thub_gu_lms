"""Class and attendance schemas."""
from __future__ import annotations

from datetime import date as dt_date, time as dt_time

from pydantic import BaseModel, Field


class ClassCreate(BaseModel):
    date: dt_date
    start_time: dt_time
    end_time: dt_time
    course: str | None = None
    branch: str | None = None
    section: str | None = None
    subject: str
    faculty: str | None = None
    topic: str | None = None
    session_mode: str | None = None
    academic_year_id: str | None = None
    batch_id: str | None = None


class ClassUpdate(BaseModel):
    date: dt_date | None = None
    start_time: dt_time | None = None
    end_time: dt_time | None = None
    course: str | None = None
    branch: str | None = None
    section: str | None = None
    subject: str | None = None
    faculty: str | None = None
    topic: str | None = None
    session_mode: str | None = None


class ClassOut(ClassCreate):
    id: str
    attendance_marked: bool = False
    created_at: str | None = None


class ClassListResponse(BaseModel):
    items: list[ClassOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class AttendanceMarkRequest(BaseModel):
    records: list["AttendanceRecordInput"]
    override: bool = False


class AttendanceRecordInput(BaseModel):
    student_id: str
    status: str = Field(pattern="^(present|absent|late|leave)$")


class AttendanceStudentEntry(BaseModel):
    student_id: str
    roll_number: str
    name: str
    status: str


class AttendanceSessionOut(BaseModel):
    class_session_id: str
    marked_by: str | None = None
    updated_at: str | None = None
    records: list[AttendanceStudentEntry]


AttendanceMarkRequest.model_rebuild()
