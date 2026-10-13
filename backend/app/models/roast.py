"""Roast model: AI-generated review of a submission."""

from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.submission import Submission

JSONType = JSON().with_variant(JSONB(), "postgresql")


class Roast(TimestampMixin, Base):
    """A single roast. Re-roasts create additional rows for the same submission."""

    __tablename__ = "roasts"
    __table_args__ = (
        CheckConstraint(
            "overall_score >= 0 AND overall_score <= 10", name="ck_roasts_overall_score_range"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    overall_score: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False)
    category_scores: Mapped[dict[str, Any]] = mapped_column(JSONType, nullable=False)
    headline: Mapped[str] = mapped_column(String(300), nullable=False)
    roast_text: Mapped[str] = mapped_column(Text, nullable=False)
    strengths: Mapped[list[str]] = mapped_column(JSONType, nullable=False)
    improvements: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    input_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    output_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    submission: Mapped["Submission"] = relationship(back_populates="roasts")

    def __repr__(self) -> str:
        return f"<Roast id={self.id} submission_id={self.submission_id} score={self.overall_score}>"
