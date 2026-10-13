"""Admin endpoints (all require ``is_admin``; 403 ``admin_required`` otherwise)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.database import get_db
from app.models.submission import SubmissionStatus
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    AdminSubmissionListResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserUpdate,
)
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/users", response_model=AdminUserListResponse, summary="List all users")
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    search: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    """Return users newest first, optionally filtered by an email/name substring."""
    items, total = admin_service.list_users(db, page, size, search.strip() if search else None)
    return AdminUserListResponse(items=items, total=total, page=page, size=size)


@router.put("/users/{user_id}", response_model=AdminUserResponse, summary="Update a user")
async def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> AdminUserResponse:
    """Activate/deactivate or toggle admin. 404 ``user_not_found``, 400 ``cannot_modify_self``."""
    return admin_service.update_user(db, admin, user_id, payload)


@router.get(
    "/submissions", response_model=AdminSubmissionListResponse, summary="List all submissions"
)
async def list_submissions(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    status: SubmissionStatus | None = Query(None),
    db: Session = Depends(get_db),
) -> AdminSubmissionListResponse:
    """Return every user's submissions newest first, optionally filtered by status."""
    items, total = admin_service.list_submissions(db, page, size, status)
    return AdminSubmissionListResponse(items=items, total=total, page=page, size=size)


@router.get("/stats", response_model=AdminStatsResponse, summary="Platform stats")
async def get_stats(db: Session = Depends(get_db)) -> AdminStatsResponse:
    """Users, submissions by status, failure rate, roasts per day, average score, tokens."""
    return admin_service.get_stats(db)
