"""Submission model: one public GitHub repo submitted for roasting."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.roast import Roast
    from app.models.user import User


class SubmissionStatus(enum.StrEnum):
    """Lifecycle states of a submission."""

    queued = "queued"
    fetching = "fetching"
    analyzing = "analyzing"
    completed = "completed"
    failed = "failed"


class RoastLevel(enum.StrEnum):
    """How spicy the roast's tone is. Never affects the scores."""

    lite = "lite"
    medium = "medium"
    spicy = "spicy"


class RoastLanguage(enum.StrEnum):
    """Language the roast is written in."""

    english = "english"
    tamil = "tamil"
    tanglish = "tanglish"


def _string_enum(enum_cls: type[enum.StrEnum], name: str) -> Enum:
    """Build a non-native, validated string Enum column type."""
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        validate_strings=True,
        length=20,
        values_callable=lambda e: [m.value for m in e],
    )


roast_level_type = _string_enum(RoastLevel, "roast_level")
roast_language_type = _string_enum(RoastLanguage, "roast_language")

submission_status_type = Enum(
    SubmissionStatus,
    name="submission_status",
    native_enum=False,
    validate_strings=True,
    length=20,
    values_callable=lambda e: [m.value for m in e],
)


class Submission(TimestampMixin, Base):
    """A public GitHub repository submitted by a user for review."""

    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    repo_url: Mapped[str] = mapped_column(String(300), nullable=False)
    repo_owner: Mapped[str] = mapped_column(String(100), nullable=False)
    repo_name: Mapped[str] = mapped_column(String(100), nullable=False)
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True)
    assignment_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    assignment_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    roast_level: Mapped[RoastLevel] = mapped_column(
        roast_level_type,
        nullable=False,
        default=RoastLevel.medium,
        server_default=RoastLevel.medium.value,
    )
    roast_language: Mapped[RoastLanguage] = mapped_column(
        roast_language_type,
        nullable=False,
        default=RoastLanguage.tanglish,
        server_default=RoastLanguage.tanglish.value,
    )
    files_analyzed: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    status: Mapped[SubmissionStatus] = mapped_column(
        submission_status_type,
        nullable=False,
        index=True,
        default=SubmissionStatus.queued,
        server_default=SubmissionStatus.queued.value,
    )
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="submissions")
    roasts: Mapped[list["Roast"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="(Roast.created_at.desc(), Roast.id.desc())",
    )

    @property
    def latest_roast(self) -> "Roast | None":
        """Return the most recent roast for this submission, or None."""
        return self.roasts[0] if self.roasts else None

    def __repr__(self) -> str:
        repo = f"{self.repo_owner}/{self.repo_name}"
        return f"<Submission id={self.id} repo={repo} status={self.status}>"


Index(
    "ix_submissions_user_id_created_at",
    Submission.user_id,
    Submission.created_at.desc(),
)
