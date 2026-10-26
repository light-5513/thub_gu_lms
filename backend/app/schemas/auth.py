"""Auth request/response schemas."""

from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    must_change_password: bool = False
    role: str
    redirect: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not any(c.isdigit() for c in v) or not any(c.isalpha() for c in v):
            raise ValueError("Password must contain letters and numbers")
        return v


class RefreshResponse(BaseModel):
    refreshed: bool = True


class InviteRequest(BaseModel):
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    role: str = Field(default="STUDENT", max_length=20)


class BulkInviteRequest(BaseModel):
    emails: list[EmailStr] = Field(min_length=1, max_length=500)
    role: str = Field(default="STUDENT", max_length=20)


class AcceptInvitationRequest(BaseModel):
    token: str = Field(min_length=10)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    roll_number: str | None = Field(default=None, max_length=32)
    course: str | None = Field(default=None, max_length=64)
    branch: str | None = Field(default=None, max_length=64)
    section: str | None = Field(default=None, max_length=16)
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not any(c.isdigit() for c in v) or not any(c.isalpha() for c in v):
            raise ValueError("Password must contain letters and numbers")
        return v
