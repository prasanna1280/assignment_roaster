"""Submission request/response schemas."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.submission import SubmissionStatus
from app.schemas.roast import RoastResponse, UTCDateTime


def _blank_to_none(value: object) -> object:
    """Strip strings and turn empty strings into None."""
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class SubmissionCreate(BaseModel):
    """Body of ``POST /submissions``. URL format is validated in the service (400)."""

    repo_url: str = Field(min_length=1, max_length=500)
    branch: str | None = Field(default=None, max_length=255)
    assignment_title: str | None = Field(default=None, max_length=200)
    assignment_description: str | None = Field(default=None, max_length=5000)

    @field_validator("repo_url", mode="before")
    @classmethod
    def _strip_url(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("branch", "assignment_title", "assignment_description", mode="before")
    @classmethod
    def _blank_optional(cls, value: object) -> object:
        return _blank_to_none(value)


class SubmissionResponse(BaseModel):
    """A submission with its latest roast (if any)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    repo_url: str
    repo_owner: str
    repo_name: str
    branch: str | None
    commit_sha: str | None
    assignment_title: str | None
    assignment_description: str | None
    primary_language: str | None
    files_analyzed: int
    status: SubmissionStatus
    error_code: str | None
    error_message: str | None
    latest_roast: RoastResponse | None
    created_at: UTCDateTime
    completed_at: UTCDateTime | None


class SubmissionListResponse(BaseModel):
    """A page of the current user's submissions, newest first."""

    items: list[SubmissionResponse]
    total: int
    page: int
    size: int


class QuotaResponse(BaseModel):
    """Daily roast quota for the current user."""

    used: int
    limit: int
    resets_at: UTCDateTime
