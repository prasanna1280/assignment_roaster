"""Business logic for registration, login, token rotation and Google upsert."""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.google import GoogleUserInfo
from app.auth.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.config import settings
from app.exceptions import ConflictError, ForbiddenError, UnauthorizedError
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserUpdate

logger = logging.getLogger(__name__)

GOOGLE_PROVIDER = "google"
_INVALID_CREDENTIALS = "Incorrect email or password."
_INVALID_REFRESH = "Invalid or expired refresh token."

# Dummy hash so login spends similar time whether or not the email exists.
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


def _as_utc(value: datetime) -> datetime:
    """Treat naive datetimes (e.g. from SQLite) as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def get_user_by_email(db: Session, email: str) -> User | None:
    """Return the user with this (case-insensitive) email, if any."""
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def issue_tokens(db: Session, user: User) -> TokenResponse:
    """Create an access token and persist a new refresh token for ``user``.

    The caller is responsible for committing the session.
    """
    raw_refresh = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    return TokenResponse(access_token=create_access_token(user.id), refresh_token=raw_refresh)


def register(db: Session, email: str, password: str, full_name: str) -> TokenResponse:
    """Create an email/password account and return a token pair (409 if email taken)."""
    email = email.strip().lower()
    if get_user_by_email(db, email) is not None:
        raise ConflictError("An account with this email already exists.", error_code="email_taken")
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        is_verified=False,
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "An account with this email already exists.", error_code="email_taken"
        ) from exc
    tokens = issue_tokens(db, user)
    db.commit()
    logger.info("Registered user id=%s", user.id)
    return tokens


def authenticate(db: Session, email: str, password: str) -> User:
    """Return the user for valid credentials; raise 401/403 otherwise."""
    user = get_user_by_email(db, email)
    if user is None or not user.hashed_password:
        verify_password(password, _DUMMY_HASH)
        raise UnauthorizedError(_INVALID_CREDENTIALS, error_code="invalid_credentials")
    if not verify_password(password, user.hashed_password):
        raise UnauthorizedError(_INVALID_CREDENTIALS, error_code="invalid_credentials")
    if not user.is_active:
        raise ForbiddenError("This account has been disabled.", error_code="account_disabled")
    return user


def login(db: Session, email: str, password: str) -> TokenResponse:
    """Authenticate and return a fresh token pair."""
    user = authenticate(db, email, password)
    tokens = issue_tokens(db, user)
    db.commit()
    logger.info("User id=%s logged in", user.id)
    return tokens


def _revoke_all_for_user(db: Session, user_id: int) -> None:
    """Revoke every refresh token belonging to ``user_id``."""
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )


def refresh(db: Session, raw_token: str) -> TokenResponse:
    """Rotate a refresh token: revoke it and issue a new pair.

    Re-use of an already revoked token revokes all of the user's tokens.
    """
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
    )
    if stored is None:
        raise UnauthorizedError(_INVALID_REFRESH, error_code="invalid_refresh_token")
    if stored.revoked:
        logger.warning(
            "Refresh token reuse detected for user id=%s; revoking all tokens", stored.user_id
        )
        _revoke_all_for_user(db, stored.user_id)
        db.commit()
        raise UnauthorizedError(_INVALID_REFRESH, error_code="invalid_refresh_token")
    if _as_utc(stored.expires_at) <= datetime.now(UTC):
        stored.revoked = True
        db.commit()
        raise UnauthorizedError(_INVALID_REFRESH, error_code="invalid_refresh_token")
    user = stored.user
    if not user.is_active:
        stored.revoked = True
        db.commit()
        raise ForbiddenError("This account has been disabled.", error_code="account_disabled")
    stored.revoked = True
    tokens = issue_tokens(db, user)
    db.commit()
    return tokens


def logout(db: Session, raw_token: str) -> None:
    """Revoke a refresh token if it exists (idempotent)."""
    stored = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
    )
    if stored is not None and not stored.revoked:
        stored.revoked = True
        db.commit()
        logger.info("User id=%s logged out", stored.user_id)


def update_profile(db: Session, user: User, data: UserUpdate) -> User:
    """Apply a partial profile update (only fields explicitly sent)."""
    fields = data.model_fields_set
    if "full_name" in fields and data.full_name is not None:
        user.full_name = data.full_name
    if "avatar_url" in fields:
        user.avatar_url = str(data.avatar_url) if data.avatar_url is not None else None
    db.commit()
    db.refresh(user)
    return user


def upsert_google_user(db: Session, info: GoogleUserInfo) -> User:
    """Find or create the user for a verified Google identity.

    Existing users get ``oauth_provider="google"`` (if unset) and are marked
    verified. Raises ForbiddenError if the account is disabled.
    """
    email = info.email.strip().lower()
    user = get_user_by_email(db, email)
    if user is None:
        user = User(
            email=email,
            hashed_password=None,
            full_name=(info.name or email.split("@")[0])[:120],
            avatar_url=info.picture[:500] if info.picture else None,
            oauth_provider=GOOGLE_PROVIDER,
            is_verified=True,
        )
        db.add(user)
        db.flush()
        logger.info("Created Google user id=%s", user.id)
    else:
        if not user.oauth_provider:
            user.oauth_provider = GOOGLE_PROVIDER
        user.is_verified = True
        if not user.avatar_url and info.picture:
            user.avatar_url = info.picture[:500]
        if not user.full_name and info.name:
            user.full_name = info.name[:120]
    if not user.is_active:
        db.commit()
        raise ForbiddenError("This account has been disabled.", error_code="account_disabled")
    return user


def google_login(db: Session, info: GoogleUserInfo) -> TokenResponse:
    """Upsert the Google user and return a token pair."""
    user = upsert_google_user(db, info)
    tokens = issue_tokens(db, user)
    db.commit()
    return tokens
