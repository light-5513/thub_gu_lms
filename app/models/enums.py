"""Domain enums used across the application."""

from enum import Enum


class Role(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    STUDENT = "STUDENT"


ADMIN_ROLES = {Role.ADMIN, Role.SUPER_ADMIN}
STAFF_ROLES = ADMIN_ROLES | {Role.TEACHER}


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    LEAVE = "leave"


class SyncStatus(str, Enum):
    NEVER_SYNCED = "never_synced"
    PENDING = "pending"
    SYNCING = "syncing"
    SUCCESS = "success"
    FAILED = "failed"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EmailStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    SENT = "sent"
    FAILED = "failed"


class Platform(str, Enum):
    GITHUB = "github"
    LEETCODE = "leetcode"
    CODECHEF = "codechef"
    CODEFORCES = "codeforces"
    ATCODER = "atcoder"
    HACKERRANK = "hackerrank"
    HACKEREARTH = "hackerearth"


class AuditAction(str, Enum):
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    LOGIN_FAILED = "LOGIN_FAILED"
    STUDENT_CREATED = "STUDENT_CREATED"
    STUDENT_UPDATED = "STUDENT_UPDATED"
    STUDENT_DEACTIVATED = "STUDENT_DEACTIVATED"
    INVITATION_SENT = "INVITATION_SENT"
    INVITATION_RESENT = "INVITATION_RESENT"
    BULK_IMPORT = "BULK_IMPORT"
    PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED"
    PASSWORD_RESET = "PASSWORD_RESET"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    CLASS_CREATED = "CLASS_CREATED"
    CLASS_UPDATED = "CLASS_UPDATED"
    CLASS_DELETED = "CLASS_DELETED"
    ATTENDANCE_CREATED = "ATTENDANCE_CREATED"
    ATTENDANCE_UPDATED = "ATTENDANCE_UPDATED"
    ATTENDANCE_DELETED = "ATTENDANCE_DELETED"
    CODING_PROFILE_UPDATED = "CODING_PROFILE_UPDATED"
    CODING_SYNC_STARTED = "CODING_SYNC_STARTED"
    CODING_SYNC_COMPLETED = "CODING_SYNC_COMPLETED"
    LEADERBOARD_RECALCULATED = "LEADERBOARD_RECALCULATED"
    SETTINGS_CHANGED = "SETTINGS_CHANGED"
