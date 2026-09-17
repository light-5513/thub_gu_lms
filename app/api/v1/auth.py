"""Authentication endpoints with HttpOnly cookie sessions."""

from fastapi import APIRouter, Depends, Request, Response

from app.core.deps import get_current_user, get_db
from app.core.errors import AppError, AuthError
from app.core.rate_limit import client_ip, is_rate_limited
from app.schemas.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


class ForceChangePasswordRequest(ChangePasswordRequest):
    """First-login forced reset: no current password required."""

    current_password: str = ""


def _set_auth_cookies(response: Response, tokens: dict) -> None:
    from app.config import settings

    secure = settings.cookies_secure
    response.set_cookie(
        ACCESS_COOKIE,
        tokens["access"],
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        tokens["refresh"],
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/api/auth",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


@router.post("/login")
async def login(
    payload: LoginRequest, request: Request, response: Response, db=Depends(get_db)
):
    limited, retry_after = await is_rate_limited(
        f"login:{client_ip(request)}", limit=10, window_seconds=300
    )
    if limited:
        raise AuthError(f"Too many attempts. Try again in {retry_after} seconds.", 429)

    service = AuthService(db)
    user = await service.authenticate(
        payload.email,
        payload.password,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    tokens = service.issue_tokens(user)
    _set_auth_cookies(response, tokens)
    return {
        "must_change_password": bool(user.get("must_change_password")),
        "role": user["role"],
        "full_name": user.get("full_name") or user["email"].split("@")[0],
        "redirect": AuthService.redirect_for(user),
    }


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "full_name": user.get("full_name"),
        "must_change_password": bool(user.get("must_change_password")),
    }


@router.post("/logout")
async def logout(request: Request, response: Response, user=Depends(get_current_user)):
    service = AuthService(request.app.state.db)
    await service.logout(str(user["_id"]))
    _clear_auth_cookies(response)
    return {"message": "Logged out"}


@router.post("/refresh")
async def refresh(request: Request, response: Response, db=Depends(get_db)):
    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise AuthError("No active session")
    service = AuthService(db)
    tokens = await service.refresh(token)
    if not tokens:
        _clear_auth_cookies(response)
        raise AuthError("Session expired. Please log in again.")
    _set_auth_cookies(response, tokens)
    return {"refreshed": True}


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db=Depends(get_db)
):
    limited, _retry_after = await is_rate_limited(
        f"forgot:{client_ip(request)}", limit=5, window_seconds=600
    )
    if limited:
        # Deliberately generic — do not reveal rate limiting either.
        return {
            "message": "If an account exists for this email, a password reset link has been sent."
        }
    service = AuthService(db)
    await service.request_password_reset(payload.email, ip=client_ip(request))
    return {
        "message": "If an account exists for this email, a password reset link has been sent."
    }


# ------------------------------------------------------------------ email invitations (public)
@router.get("/invitation/{token}")
async def invitation_info(token: str, request: Request, db=Depends(get_db)):
    """Public: confirm an invitation token is valid and show which email it is for."""
    from app.services.invitation_service import InvitationService

    return await InvitationService(db).peek(token)


@router.post("/accept-invitation")
async def accept_invitation(
    payload: AcceptInvitationRequest, request: Request, db=Depends(get_db)
):
    """Public: complete signup from an invitation link."""
    limited, retry_after = await is_rate_limited(
        f"invite-accept:{client_ip(request)}", limit=10, window_seconds=600
    )
    if limited:
        raise AppError("Too many attempts. Try again later.", 429)
    from app.services.invitation_service import InvitationService

    return await InvitationService(db).accept(
        payload.token,
        payload.model_dump(),
        ip=client_ip(request),
    )


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest, request: Request, db=Depends(get_db)
):
    limited, _retry_after = await is_rate_limited(
        f"reset:{client_ip(request)}", limit=10, window_seconds=600
    )
    if limited:
        raise AuthError("Too many attempts. Try again later.", 429)
    service = AuthService(db)
    await service.reset_password(
        payload.token,
        payload.new_password,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return {"message": "Your password has been reset. You can now log in."}


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    user=Depends(get_current_user),
):
    service = AuthService(request.app.state.db)
    await service.change_password(
        user,
        payload.current_password,
        payload.new_password,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    # Issue fresh tokens after version invalidation.
    updated = await service.users.get_by_id(str(user["_id"]))
    tokens = service.issue_tokens(updated)
    _set_auth_cookies(response, tokens)
    return {"message": "Password changed successfully"}


@router.post("/force-change-password")
async def force_change_password(
    payload: ForceChangePasswordRequest,
    request: Request,
    response: Response,
    user=Depends(get_current_user),
):
    """First-login forced password reset: only the new password is required."""
    service = AuthService(request.app.state.db)
    if not bool(user.get("must_change_password")):
        raise AuthError("Password change is not required", 400)
    await service.force_change_password(
        user,
        payload.new_password,
        ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    updated = await service.users.get_by_id(str(user["_id"]))
    tokens = service.issue_tokens(updated)
    _set_auth_cookies(response, tokens)
    return {
        "message": "Password updated",
        "role": updated["role"],
        "redirect": AuthService.redirect_for(updated),
    }
