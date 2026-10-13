"""Authentication endpoints mounted at ``/api/v1/auth``."""

import logging
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.auth import google
from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.exceptions import AppError
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

STATE_COOKIE_NAME = "oauth_state"
STATE_COOKIE_MAX_AGE = 600
STATE_COOKIE_PATH = "/api/v1/auth/google"
_state_serializer = URLSafeTimedSerializer(settings.SECRET_KEY, salt="google-oauth-state")


def _frontend_url(path: str) -> str:
    """Join ``path`` onto the configured frontend base URL."""
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _error_redirect(error: str) -> RedirectResponse:
    """Redirect to the frontend login page with an ``error`` query param."""
    response = RedirectResponse(_frontend_url(f"/login?error={error}"), status_code=302)
    response.delete_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
    return response


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def register(
    request: Request, payload: RegisterRequest, db: Session = Depends(get_db)
) -> TokenResponse:
    """Create an email/password account and return a token pair."""
    return await run_in_threadpool(
        auth_service.register, db, payload.email, payload.password, payload.full_name
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request, payload: LoginRequest, db: Session = Depends(get_db)
) -> TokenResponse:
    """Log in with email and password (JSON body)."""
    return await run_in_threadpool(auth_service.login, db, payload.email, payload.password)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Rotate a refresh token and return a new token pair."""
    return auth_service.refresh(db, payload.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> Response:
    """Revoke a refresh token. Always returns 204."""
    auth_service.logout(db, payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserResponse)
async def read_me(user: User = Depends(get_current_user)) -> User:
    """Return the current user."""
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Update the current user's ``full_name`` and/or ``avatar_url``."""
    return auth_service.update_profile(db, user, payload)


@router.get("/google", response_class=RedirectResponse, status_code=302)
async def google_login() -> RedirectResponse:
    """Redirect to Google's consent screen, storing a signed ``state`` cookie."""
    if not google.is_configured():
        raise AppError(
            "Google sign-in is not configured.",
            error_code="google_not_configured",
            status_code=503,
        )
    state = secrets.token_urlsafe(32)
    response = RedirectResponse(google.build_authorization_url(state), status_code=302)
    response.set_cookie(
        STATE_COOKIE_NAME,
        _state_serializer.dumps(state),
        max_age=STATE_COOKIE_MAX_AGE,
        path=STATE_COOKIE_PATH,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )
    return response


@router.get("/google/callback", response_class=RedirectResponse, status_code=302)
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """Handle Google's redirect: verify state, upsert user, hand tokens to the SPA.

    Tokens are passed in the URL fragment so they never reach server logs.
    """
    cookie_value = request.cookies.get(STATE_COOKIE_NAME)
    expected_state: str | None = None
    if cookie_value:
        try:
            loaded = _state_serializer.loads(cookie_value, max_age=STATE_COOKIE_MAX_AGE)
            expected_state = loaded if isinstance(loaded, str) else None
        except BadSignature:
            expected_state = None
    if not state or not expected_state or not secrets.compare_digest(state, expected_state):
        logger.warning("Google OAuth state mismatch")
        return _error_redirect("oauth_state")
    if error or not code:
        logger.info("Google OAuth returned no code (error=%s)", error)
        return _error_redirect("oauth_failed")

    try:
        google_access_token = await google.exchange_code(code)
        info = await google.fetch_userinfo(google_access_token)
    except google.GoogleOAuthError:
        return _error_redirect("oauth_failed")
    if not info.email_verified:
        logger.info("Google account email not verified; refusing sign-in")
        return _error_redirect("oauth_failed")

    try:
        tokens = auth_service.google_login(db, info)
    except AppError as exc:
        return _error_redirect(exc.error_code)

    fragment = urlencode(
        {
            "access_token": tokens.access_token,
            "refresh_token": tokens.refresh_token,
            "token_type": tokens.token_type,
        }
    )
    response = RedirectResponse(_frontend_url(f"/auth/callback#{fragment}"), status_code=302)
    response.delete_cookie(STATE_COOKIE_NAME, path=STATE_COOKIE_PATH)
    return response
