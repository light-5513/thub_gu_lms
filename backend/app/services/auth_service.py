"""Authentication service: login, refresh, password flows, token invalidation."""

from datetime import datetime, timezone

from app.core import security
from app.core.errors import AppError, AuthError, ConflictError, NotFoundError
from app.models.enums import AuditAction, Role
from app.repositories.system import PasswordResetTokenRepository
from app.repositories.users import UserRepository
from app.services.audit_service import AuditService
from app.services.email_service import EmailService


class AuthService:
    def __init__(self, db):
        self.db = db
        self.users = UserRepository(db)
        self.reset_tokens = PasswordResetTokenRepository(db)
        self.email = EmailService(db)
        self.audit = AuditService(db)

    # ------------------------------------------------------------------ login
    async def authenticate(
        self,
        email: str,
        password: str,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> dict:
        user = await self.users.get_by_email(email)
        if not user or not security.verify_password(
            password, user.get("password_hash", "")
        ):
            await self.audit.log(
                AuditAction.LOGIN_FAILED,
                ip_address=ip,
                user_agent=user_agent,
                entity="user",
                entity_id=email,
            )
            raise AuthError("Invalid email or password")
        if not user.get("is_active", True):
            raise AuthError("Account is deactivated. Contact your administrator.")
        await self.audit.log(
            AuditAction.LOGIN,
            user_id=str(user["_id"]),
            role=user["role"],
            ip_address=ip,
            user_agent=user_agent,
        )
        return user

    def issue_tokens(self, user: dict) -> dict:
        user_id = str(user["_id"])
        access = security.create_access_token(
            user_id, user["role"], user.get("token_version", 0)
        )
        refresh = security.create_refresh_token(user_id, user.get("token_version", 0))
        return {"access": access, "refresh": refresh}

    @staticmethod
    def redirect_for(user: dict) -> str:
        if user.get("must_change_password"):
            return "/force-change-password"
        if Role(user["role"]) in {Role.ADMIN, Role.SUPER_ADMIN}:
            return "/admin/dashboard"
        if Role(user["role"]) == Role.TEACHER:
            return "/admin/dashboard"
        return "/student/dashboard"

    # ------------------------------------------------------------------ logout / refresh
    async def logout(self, user_id: str) -> None:
        user = await self.users.get_by_id(user_id)
        if user:
            # Bump token version to invalidate all issued tokens.
            await self.users.update(
                user_id, {"token_version": int(user.get("token_version", 0)) + 1}
            )
            await self.audit.log(AuditAction.LOGOUT, user_id=user_id, role=user["role"])

    async def refresh(self, refresh_token: str) -> dict | None:
        payload = security.decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            return None
        user = await self.users.get_by_id(payload["sub"])
        if not user or not user.get("is_active", True):
            return None
        if int(payload.get("ver", 0)) != int(user.get("token_version", 0)):
            return None
        return self.issue_tokens(user)

    # ------------------------------------------------------------------ password flows
    async def change_password(
        self,
        user: dict,
        current_password: str,
        new_password: str,
        ip=None,
        user_agent=None,
    ) -> None:
        if not security.verify_password(
            current_password, user.get("password_hash", "")
        ):
            raise AuthError("Current password is incorrect")
        await self._set_password(
            user, new_password, ip, user_agent, AuditAction.PASSWORD_CHANGED
        )

    async def force_change_password(
        self, user: dict, new_password: str, ip=None, user_agent=None
    ) -> None:
        await self._set_password(
            user, new_password, ip, user_agent, AuditAction.PASSWORD_CHANGED
        )

    async def _set_password(
        self, user: dict, new_password: str, ip, user_agent, action: AuditAction
    ) -> None:
        user_id = str(user["_id"])
        await self.users.update(
            user_id,
            {
                "password_hash": security.hash_password(new_password),
                "must_change_password": False,
                "password_changed_at": datetime.now(timezone.utc),
                "token_version": int(user.get("token_version", 0)) + 1,
            },
        )
        await self.audit.log(
            action,
            user_id=user_id,
            role=user["role"],
            ip_address=ip,
            user_agent=user_agent,
            entity="user",
            entity_id=user_id,
        )

    async def request_password_reset(self, email: str, ip=None) -> None:
        """Always returns without revealing whether the account exists."""
        user = await self.users.get_by_email(email)
        if user:
            token = security.generate_secure_token()
            await self.reset_tokens.create(str(user["_id"]), security.hash_token(token))
            await self.email.send_password_reset_email(
                user.get("full_name") or "there", user["email"], token
            )
            await self.audit.log(
                AuditAction.PASSWORD_RESET_REQUESTED,
                user_id=str(user["_id"]),
                ip_address=ip,
                entity="user",
                entity_id=str(user["_id"]),
            )

    async def reset_password(
        self, token: str, new_password: str, ip=None, user_agent=None
    ) -> None:
        doc = await self.reset_tokens.find_valid(security.hash_token(token))
        if not doc:
            raise AppError("This reset link is invalid or has expired", 400)
        user = await self.users.get_by_id(str(doc["user_id"]))
        if not user:
            raise NotFoundError("Account not found")
        await self._set_password(
            user, new_password, ip, user_agent, AuditAction.PASSWORD_RESET
        )
        await self.reset_tokens.consume(security.hash_token(token))

    # ------------------------------------------------------------------ helpers for admin flows
    async def create_user_for_student(
        self, email: str, role: Role, temp_password: str
    ) -> dict:
        existing = await self.users.get_by_email(email)
        if existing:
            raise ConflictError("A user account already exists for this email")
        return await self.users.create(
            {
                "email": email,
                "role": role.value,
                "password_hash": security.hash_password(temp_password),
                "must_change_password": True,
                "is_active": True,
                "token_version": 0,
                "created_at": datetime.now(timezone.utc),
            }
        )

    async def reset_student_account(
        self, student_user_id: str, temp_password: str
    ) -> None:
        """Regenerate a temporary password and force change on next login."""
        user = await self.users.get_by_id(student_user_id)
        if not user:
            raise NotFoundError("User account not found")
        await self.users.update(
            student_user_id,
            {
                "password_hash": security.hash_password(temp_password),
                "must_change_password": True,
                "token_version": int(user.get("token_version", 0)) + 1,
            },
        )
