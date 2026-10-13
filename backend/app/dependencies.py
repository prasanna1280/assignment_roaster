"""Common FastAPI dependencies, re-exported for convenience."""

from app.auth.dependencies import get_current_user, require_admin
from app.database import get_db

__all__ = ["get_current_user", "get_db", "require_admin"]
