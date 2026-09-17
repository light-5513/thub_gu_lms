"""FastAPI dependencies: database handles, current user, role authorization."""

from fastapi import Depends, Request
from fastapi.security.utils import get_authorization_scheme_param

from app.core.errors import AuthError, ForbiddenError
from app.database import mongo
from app.models.enums import ADMIN_ROLES, STAFF_ROLES, Role


def get_db():
    return mongo.get_db()


def _extract_token(request: Request) -> str | None:
    # Prefer HttpOnly cookie; allow Authorization header for API clients.
    token = request.cookies.get("access_token")
    if token:
        return token
    auth = request.headers.get("Authorization")
    scheme, param = get_authorization_scheme_param(auth)
    if scheme.lower() == "bearer" and param:
        return param
    return None


async def get_current_user(request: Request):
    from app.core.security import decode_token

    db = mongo.get_db()
    token = _extract_token(request)
    if not token:
        raise AuthError("Authentication required")
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise AuthError("Session expired or invalid. Please log in again.")
    user_id = payload.get("sub")
    user = await db.users.find_one({"_id": __import__("bson").ObjectId(user_id)})
    if not user or not user.get("is_active", True):
        raise AuthError("Account is inactive")
    # Token invalidation via per-user version counter
    if int(payload.get("ver", 0)) != int(user.get("token_version", 0)):
        raise AuthError("Session revoked. Please log in again.")
    return user


async def get_current_user_optional(request: Request):
    try:
        return await get_current_user(request)
    except Exception:
        return None


def require_roles(*allowed: Role):
    async def checker(user=Depends(get_current_user)):
        role = Role(user["role"])
        if allowed and role not in allowed:
            raise ForbiddenError("You do not have permission to perform this action")
        return user

    return checker


async def require_student(user=Depends(get_current_user)):
    role = Role(user["role"])
    if role != Role.STUDENT:
        raise ForbiddenError("Student access required")
    return user


async def require_staff(user=Depends(get_current_user)):
    role = Role(user["role"])
    if role not in STAFF_ROLES:
        raise ForbiddenError("Staff access required")
    return user


async def require_admin(user=Depends(get_current_user)):
    role = Role(user["role"])
    if role not in ADMIN_ROLES:
        raise ForbiddenError("Admin access required")
    return user


async def require_super_admin(user=Depends(get_current_user)):
    role = Role(user["role"])
    if role != Role.SUPER_ADMIN:
        raise ForbiddenError("Super admin access required")
    return user
