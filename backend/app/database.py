"""Database engine, session factory and declarative base."""

from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


def _connect_args(url: str) -> dict[str, Any]:
    """Return driver-specific connect args (SQLite needs cross-thread access)."""
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=_connect_args(settings.DATABASE_URL),
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Declarative base class for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session that is always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
