"""Shared pytest fixtures.

Environment variables are set before any ``app`` import so that ``settings``,
``engine`` and ``SessionLocal`` all point at a throwaway SQLite database. Code
that opens its own session (e.g. background tasks) therefore uses the test DB too.
"""

import os
import tempfile
from collections.abc import Generator
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="roaster-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-at-least-32-bytes-long"  # noqa: S105
os.environ["OPENAI_API_KEY"] = "sk-test"
os.environ["OPENAI_MODEL"] = "gpt-test"
os.environ["GITHUB_TOKEN"] = ""
os.environ["GOOGLE_CLIENT_ID"] = "test-google-client-id"
os.environ["GOOGLE_CLIENT_SECRET"] = "test-google-client-secret"  # noqa: S105
os.environ["ENVIRONMENT"] = "test"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.models  # noqa: E402, F401  (register all models on Base.metadata)
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_database() -> Generator[None, None, None]:
    """Give every test a fresh schema and a clean rate limiter."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    limiter.reset()
    yield


@pytest.fixture
def db() -> Generator[Session, None, None]:
    """A session bound to the test database."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """FastAPI test client. Dependency overrides are cleared after each test."""
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()
