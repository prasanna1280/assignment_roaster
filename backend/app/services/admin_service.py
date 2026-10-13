"""Admin business logic: user management, submission monitor and platform stats."""

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.exceptions import BadRequestError, NotFoundError
from app.models.refresh_token import RefreshToken
from app.models.roast import Roast
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    AdminSubmissionResponse,
    AdminUserResponse,
    AdminUserUpdate,
    DailyRoastCount,
)

logger = logging.getLogger(__name__)

STATS_DAYS = 7


def _now() -> datetime:
    """Current UTC time (patchable in tests)."""
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    """Treat naive datetimes (SQLite) as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _submission_counts(db: Session, user_ids: list[int]) -> dict[int, int]:
    """Return ``{user_id: submission_count}`` for the given users."""
    if not user_ids:
        return {}
    rows = db.execute(
        select(Submission.user_id, func.count(Submission.id))
        .where(Submission.user_id.in_(user_ids))
        .group_by(Submission.user_id)
    ).all()
    return {user_id: int(count) for user_id, count in rows}


def _to_admin_user(user: User, submission_count: int) -> AdminUserResponse:
    """Build the admin view of a user."""
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        oauth_provider=user.oauth_provider,
        submission_count=submission_count,
        created_at=user.created_at,
    )


def list_users(
    db: Session, page: int, size: int, search: str | None
) -> tuple[list[AdminUserResponse], int]:
    """Return one page of users (newest first), optionally filtered by email/name substring."""
    conditions = []
    if search:
        conditions.append(
            or_(
                User.email.icontains(search, autoescape=True),
                User.full_name.icontains(search, autoescape=True),
            )
        )
    total = db.scalar(select(func.count(User.id)).where(*conditions))
    users = db.scalars(
        select(User)
        .where(*conditions)
        .order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    counts = _submission_counts(db, [user.id for user in users])
    return [_to_admin_user(user, counts.get(user.id, 0)) for user in users], int(total or 0)


def update_user(
    db: Session, admin: User, user_id: int, data: AdminUserUpdate
) -> AdminUserResponse:
    """Activate/deactivate a user or toggle admin. Deactivation revokes refresh tokens.

    Raises:
        NotFoundError: ``user_not_found`` (404).
        BadRequestError: ``cannot_modify_self`` when an admin targets their own account (400).
    """
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.", error_code="user_not_found")
    if user.id == admin.id:
        raise BadRequestError(
            "You can't change your own active or admin status.", error_code="cannot_modify_self"
        )
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_active is not None:
        user.is_active = data.is_active
        if not data.is_active:
            db.execute(
                update(RefreshToken)
                .where(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
                .values(revoked=True)
            )
    db.commit()
    db.refresh(user)
    logger.info(
        "Admin %s updated user %s: is_active=%s is_admin=%s",
        admin.id,
        user.id,
        user.is_active,
        user.is_admin,
    )
    return _to_admin_user(user, _submission_counts(db, [user.id]).get(user.id, 0))


def list_submissions(
    db: Session, page: int, size: int, status: SubmissionStatus | None
) -> tuple[list[AdminSubmissionResponse], int]:
    """Return one page of all users' submissions (newest first), optionally by status."""
    conditions = [Submission.status == status] if status is not None else []
    total = db.scalar(select(func.count(Submission.id)).where(*conditions))
    rows = db.execute(
        select(Submission, User.email)
        .join(User, Submission.user_id == User.id)
        .where(*conditions)
        .options(selectinload(Submission.roasts))
        .order_by(Submission.created_at.desc(), Submission.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    items = [
        AdminSubmissionResponse(
            id=sub.id,
            user_id=sub.user_id,
            user_email=email,
            repo_url=sub.repo_url,
            repo_owner=sub.repo_owner,
            repo_name=sub.repo_name,
            status=sub.status,
            error_code=sub.error_code,
            overall_score=(
                float(sub.latest_roast.overall_score) if sub.latest_roast is not None else None
            ),
            created_at=sub.created_at,
            completed_at=sub.completed_at,
        )
        for sub, email in rows
    ]
    return items, int(total or 0)


def _roasts_per_day(db: Session, today: date) -> list[DailyRoastCount]:
    """Count roasts per UTC day for the last ``STATS_DAYS`` days (oldest first)."""
    first_day = today - timedelta(days=STATS_DAYS - 1)
    since = datetime(first_day.year, first_day.month, first_day.day, tzinfo=UTC)
    buckets = {first_day + timedelta(days=i): 0 for i in range(STATS_DAYS)}
    for created_at in db.scalars(select(Roast.created_at).where(Roast.created_at >= since)):
        day = _as_utc(created_at).date()
        if day in buckets:
            buckets[day] += 1
    return [DailyRoastCount(day=day, count=count) for day, count in buckets.items()]


def get_stats(db: Session) -> AdminStatsResponse:
    """Aggregate platform stats: users, submissions, failure rate, roasts, scores, tokens."""
    total_users = db.scalar(select(func.count(User.id))) or 0
    active_users = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0

    by_status = {status: 0 for status in SubmissionStatus}
    for status, count in db.execute(
        select(Submission.status, func.count(Submission.id)).group_by(Submission.status)
    ).all():
        by_status[status] = int(count)
    finished = by_status[SubmissionStatus.completed] + by_status[SubmissionStatus.failed]
    failure_rate = by_status[SubmissionStatus.failed] / finished if finished else 0.0

    total_roasts, avg_score, input_tokens, output_tokens = db.execute(
        select(
            func.count(Roast.id),
            func.avg(Roast.overall_score),
            func.coalesce(func.sum(Roast.input_tokens), 0),
            func.coalesce(func.sum(Roast.output_tokens), 0),
        )
    ).one()

    per_day = _roasts_per_day(db, _now().date())
    return AdminStatsResponse(
        total_users=int(total_users),
        active_users=int(active_users),
        total_submissions=sum(by_status.values()),
        submissions_by_status=by_status,
        failure_rate=round(failure_rate, 4),
        total_roasts=int(total_roasts),
        roasts_today=per_day[-1].count,
        roasts_per_day=per_day,
        average_score=round(float(avg_score), 2) if avg_score is not None else None,
        total_input_tokens=int(input_tokens),
        total_output_tokens=int(output_tokens),
    )
