"""Authentication dependencies: ``get_current_user`` and ``require_admin``."""

import logging

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.exceptions import ForbiddenError, UnauthorizedError
from app.models.user import User

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a ``Bearer`` access token.

    Raises 401 ``not_authenticated`` if no token, 401 ``invalid_token`` if the
    token is invalid/expired or the user no longer exists, and 403
    ``account_disabled`` if the user is inactive.
    """
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Not authenticated.", error_code="not_authenticated")
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise UnauthorizedError("Invalid or expired token.", error_code="invalid_token")
    user = db.get(User, user_id)
    if user is None:
        raise UnauthorizedError("Invalid or expired token.", error_code="invalid_token")
    if not user.is_active:
        raise ForbiddenError("This account has been disabled.", error_code="account_disabled")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Require the current user to be an admin (403 ``admin_required`` otherwise)."""
    if not user.is_admin:
        raise ForbiddenError("Admin privileges required.", error_code="admin_required")
    return user
