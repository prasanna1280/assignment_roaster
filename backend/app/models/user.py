"""User model."""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Integer, String, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken
    from app.models.submission import Submission


class User(TimestampMixin, Base):
    """An application user (email/password or Google OAuth). Email is stored lowercased."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(
        String(120), nullable=False, default="", server_default=""
    )
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    is_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    oauth_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
