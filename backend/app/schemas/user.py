"""User-facing schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class UserResponse(BaseModel):
    """Public representation of a user."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    avatar_url: str | None
    is_active: bool
    is_verified: bool
    is_admin: bool
    oauth_provider: str | None
    created_at: datetime


class UserUpdate(BaseModel):
    """Payload for ``PUT /auth/me``. Omitted fields are left unchanged.

    ``avatar_url`` may be sent as ``null`` to clear the avatar.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar_url: HttpUrl | None = Field(default=None)

    @field_validator("full_name", mode="before")
    @classmethod
    def _strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("avatar_url", mode="after")
    @classmethod
    def _limit_url_length(cls, value: HttpUrl | None) -> HttpUrl | None:
        if value is not None and len(str(value)) > 500:
            raise ValueError("avatar_url must be at most 500 characters")
        return value
