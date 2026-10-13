"""Roast attempt ledger: one append-only row per roast started (new submission or re-roast).

The daily limit counts these rows, so deleting a submission can never refund quota.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RoastAttempt(Base):
    """A single roast attempt charged against the user's daily quota."""

    __tablename__ = "roast_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Kept (as NULL) after the submission is deleted so the attempt still counts.
    submission_id: Mapped[int | None] = mapped_column(
        ForeignKey("submissions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True, nullable=False
    )

    def __repr__(self) -> str:
        return f"<RoastAttempt id={self.id} user_id={self.user_id} sub={self.submission_id}>"
