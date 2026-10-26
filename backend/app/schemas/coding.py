"""Coding platform schemas."""

from pydantic import BaseModel, Field

PLATFORMS = [
    "github",
    "leetcode",
    "codechef",
    "codeforces",
    "atcoder",
    "hackerrank",
    "hackerearth",
    "geeksforgeeks",
]


class CodingProfileInput(BaseModel):
    platform: str = Field(
        pattern="^(github|leetcode|codechef|codeforces|atcoder|hackerrank|hackerearth|geeksforgeeks)$"
    )
    username: str = Field(min_length=1, max_length=255)


class CodingProfileOut(BaseModel):
    platform: str
    username: str
    profile_url: str | None = None
    verified: bool = False
    sync_status: str = "never_synced"
    last_synced_at: str | None = None
    sync_error: str | None = None
    statistics: dict[str, float | None] = {}


class SyncJobOut(BaseModel):
    job_id: str
    platform: str
    requested_by: str | None = None
    started_at: str | None = None
    completed_at: str | None = None
    total: int = 0
    processed: int = 0
    successful: int = 0
    failed: int = 0
    remaining: int = 0
    status: str = "queued"
    error_summary: str | None = None


class LeaderboardEntry(BaseModel):
    rank: int
    student_id: str
    student_name: str
    roll_number: str | None = None
    course: str | None = None
    branch: str | None = None
    score: float = 0
    metrics: dict[str, float] = {}
    trend: float | None = None


class LeaderboardResponse(BaseModel):
    tab: str
    entries: list[LeaderboardEntry]
    total: int
    generated_at: str | None = None
