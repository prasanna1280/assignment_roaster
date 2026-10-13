"""Password hashing, JWT access tokens and opaque refresh tokens."""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import settings

logger = logging.getLogger(__name__)

ACCESS_TOKEN_TYPE = "access"  # noqa: S105  (token type label, not a secret)


def hash_password(password: str) -> str:
    """Return a bcrypt hash of ``password``."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str | None) -> bool:
    """Return True when ``password`` matches ``hashed_password`` (False if no hash)."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        logger.warning("Stored password hash is malformed")
        return False


def create_access_token(user_id: int, expires_delta: timedelta | None = None) -> str:
    """Create a signed HS256 JWT access token for ``user_id``."""
    now = datetime.now(UTC)
    delta = expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Decode an access token and return the user id, or None if invalid/expired."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        return None
    try:
        return int(payload["sub"])
    except (TypeError, ValueError):
        return None


def generate_refresh_token() -> str:
    """Return a new random, URL-safe refresh token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Return the hex SHA-256 digest of a refresh token (what we persist)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
