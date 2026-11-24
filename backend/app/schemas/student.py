"""Student-related schemas."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class StudentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    roll_number: str = Field(min_length=1, max_length=32)
    course: str = Field(min_length=1, max_length=64)
    branch: str = Field(min_length=1, max_length=64)
    section: str = Field(max_length=16)
    phone: str | None = Field(default=None, max_length=20)
    batch_id: str | None = None
    academic_year_id: str | None = None


class StudentUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    roll_number: str | None = Field(default=None, min_length=1, max_length=32)
    course: str | None = None
    branch: str | None = None
    section: str | None = None
    phone: str | None = None
    status: Literal["active", "inactive"] | None = None
    batch_id: str | None = None
    academic_year_id: str | None = None


class SelfProfileUpdate(BaseModel):
    """Fields a student may edit on their own profile. Email is never editable."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, min_length=1, max_length=80)
    phone: str | None = Field(default=None, max_length=20)
    roll_number: str | None = Field(default=None, min_length=1, max_length=32)
    course: str | None = Field(default=None, max_length=64)
    branch: str | None = Field(default=None, max_length=64)
    section: str | None = Field(default=None, max_length=16)


class StudentOut(BaseModel):
    id: str
    user_id: str | None = None
    first_name: str
    last_name: str
    email: EmailStr
    roll_number: str
    course: str
    branch: str
    section: str
    phone: str | None = None
    batch_id: str | None = None
    academic_year_id: str | None = None
    status: str = "active"
    must_change_password: bool = False
    attendance_percentage: float | None = None
    current_streak: int | None = None
    overall_score: float | None = None
    has_user_account: bool = False
    created_at: str | None = None


class StudentListResponse(BaseModel):
    items: list[StudentOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class ImportRowError(BaseModel):
    row: int
    field: str | None = None
    error: str


class ImportPreview(BaseModel):
    import_token: str
    total_records: int
    valid_records: int
    invalid_records: int
    duplicate_records: int
    errors: list[ImportRowError]
    sample_valid: list[dict]


class ImportConfirmRequest(BaseModel):
    import_token: str
