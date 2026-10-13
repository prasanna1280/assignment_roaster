"""Admin panel schemas: user management, submission monitor and platform stats."""

from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.submission import SubmissionStatus
from app.schemas.roast import UTCDateTime


class AdminUserResponse(BaseModel):
    """A user as seen by admins, with their submission count."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    oauth_provider: str | None
    submission_count: int
    created_at: UTCDateTime


class AdminUserListResponse(BaseModel):
    """A page of users, newest first."""

    items: list[AdminUserResponse]
    total: int
    page: int
    size: int


class AdminUserUpdate(BaseModel):
    """Body of ``PUT /admin/users/{id}``. Omitted fields are left unchanged."""

    is_active: bool | None = None
    is_admin: bool | None = None


class AdminSubmissionResponse(BaseModel):
    """A submission row for the admin monitor (no roast text or assignment brief)."""

    id: int
    user_id: int
    user_email: str
    repo_url: str
    repo_owner: str
    repo_name: str
    status: SubmissionStatus
    error_code: str | None
    overall_score: float | None
    created_at: UTCDateTime
    completed_at: UTCDateTime | None


class AdminSubmissionListResponse(BaseModel):
    """A page of all submissions, newest first."""

    items: list[AdminSubmissionResponse]
    total: int
    page: int
    size: int


class DailyRoastCount(BaseModel):
    """Roasts completed on one UTC day."""

    day: date
    count: int


class AdminStatsResponse(BaseModel):
    """Platform-wide numbers for the admin dashboard."""

    total_users: int
    active_users: int
    total_submissions: int
    submissions_by_status: dict[SubmissionStatus, int]
    failure_rate: float
    total_roasts: int
    roasts_today: int
    roasts_per_day: list[DailyRoastCount]
    average_score: float | None
    total_input_tokens: int
    total_output_tokens: int
