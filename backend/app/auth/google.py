"""Thin Google OAuth 2.0 / OpenID Connect client built on httpx.

Kept deliberately small so tests can monkeypatch ``exchange_code`` and
``fetch_userinfo``.
"""

import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105  (public endpoint URL)
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
SCOPES = "openid email profile"
HTTP_TIMEOUT_SECONDS = 10.0


class GoogleOAuthError(Exception):
    """Raised when any step of the Google OAuth exchange fails."""


@dataclass(frozen=True)
class GoogleUserInfo:
    """Subset of the OIDC userinfo response we rely on."""

    sub: str
    email: str
    email_verified: bool
    name: str | None
    picture: str | None


def is_configured() -> bool:
    """Return True when Google OAuth credentials are configured."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def callback_url() -> str:
    """Return the redirect URI registered with Google."""
    return f"{settings.BACKEND_URL.rstrip('/')}/api/v1/auth/google/callback"


def build_authorization_url(state: str) -> str:
    """Build the Google consent-screen URL for the given ``state``."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url(),
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> str:
    """Exchange an authorization ``code`` for a Google access token."""
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": callback_url(),
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(TOKEN_URL, data=data)
    except httpx.HTTPError as exc:
        logger.warning("Google token exchange request failed: %s", type(exc).__name__)
        raise GoogleOAuthError("token exchange request failed") from exc
    if response.status_code != 200:
        logger.warning("Google token exchange returned HTTP %s", response.status_code)
        raise GoogleOAuthError("token exchange rejected")
    payload: dict[str, Any] = response.json()
    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise GoogleOAuthError("token response missing access_token")
    return access_token


async def fetch_userinfo(access_token: str) -> GoogleUserInfo:
    """Fetch the OIDC userinfo for a Google ``access_token``."""
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = await client.get(
                USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
            )
    except httpx.HTTPError as exc:
        logger.warning("Google userinfo request failed: %s", type(exc).__name__)
        raise GoogleOAuthError("userinfo request failed") from exc
    if response.status_code != 200:
        logger.warning("Google userinfo returned HTTP %s", response.status_code)
        raise GoogleOAuthError("userinfo rejected")
    payload: dict[str, Any] = response.json()
    sub = payload.get("sub")
    email = payload.get("email")
    if not isinstance(sub, str) or not isinstance(email, str) or not email:
        raise GoogleOAuthError("userinfo missing sub/email")
    verified = payload.get("email_verified")
    name = payload.get("name")
    picture = payload.get("picture")
    return GoogleUserInfo(
        sub=sub,
        email=email,
        email_verified=verified is True or verified == "true",
        name=name if isinstance(name, str) else None,
        picture=picture if isinstance(picture, str) else None,
    )
