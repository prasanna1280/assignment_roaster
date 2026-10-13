"""Opt-in integration tests against a REAL PostgreSQL server.

Skipped unless ``TEST_POSTGRES_URL`` is set, e.g.::

    TEST_POSTGRES_URL=postgresql://roaster:roaster@localhost:5432/assignment_roaster \
        pytest tests/test_postgres_integration.py

The URL only identifies the server/credentials. The tests never touch the database
named in it: they create (if missing) a separate ``<dbname>_test`` database, migrate
it to head with Alembic (validating the migration on Postgres too), and reset its
``public`` schema before running. ``conftest.py`` points ``DATABASE_URL`` at SQLite,
so this module builds its own engine.
"""

import os
import subprocess
import sys
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.engine import URL, Engine, make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.models.refresh_token import RefreshToken
from app.models.roast import Roast
from app.models.roast_attempt import RoastAttempt
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User
from app.services import submission_service
from tests.roaster_helpers import valid_roast_dict

PG_URL = os.environ.get("TEST_POSTGRES_URL")

pytestmark = pytest.mark.skipif(not PG_URL, reason="TEST_POSTGRES_URL not set")

BACKEND_DIR = Path(__file__).resolve().parents[1]
FIXED_NOW = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)


def _test_db_url() -> URL:
    base = make_url(PG_URL or "")
    name = base.database or "postgres"
    test_name = name if name.endswith("_test") else f"{name}_test"
    return base.set(database=test_name)


def _ensure_database(url: URL) -> None:
    """Create the throwaway test database if it does not exist yet."""
    admin = create_engine(
        make_url(PG_URL or "").set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    try:
        with admin.connect() as conn:
            exists = conn.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
            )
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    finally:
        admin.dispose()


@pytest.fixture(scope="module")
def pg_engine() -> Iterator[Engine]:
    url = _test_db_url()
    assert url.database and url.database.endswith("_test"), "refusing to use a non-test DB"
    _ensure_database(url)
    engine = create_engine(url, pool_pre_ping=True)
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))

    env = {**os.environ, "DATABASE_URL": url.render_as_string(hide_password=False)}
    result = subprocess.run(  # noqa: S603  (fixed argv, no shell)
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    assert result.returncode == 0, f"alembic upgrade failed:\n{result.stderr[-2000:]}"
    yield engine
    engine.dispose()


@pytest.fixture
def pg(pg_engine: Engine) -> Iterator[Session]:
    with pg_engine.begin() as conn:
        conn.execute(
            text("TRUNCATE users, refresh_tokens, submissions, roasts, roast_attempts CASCADE")
        )
    session = sessionmaker(bind=pg_engine, autoflush=False)()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _user(db: Session, email: str = "pg@example.com") -> User:
    user = User(email=email, full_name="PG User")
    db.add(user)
    db.commit()
    return user


def _submission(
    db: Session,
    user: User,
    status: SubmissionStatus = SubmissionStatus.completed,
    when: datetime = FIXED_NOW,
) -> Submission:
    sub = Submission(
        user_id=user.id,
        repo_url="https://github.com/octo/hello",
        repo_owner="octo",
        repo_name="hello",
        status=status,
        created_at=when,
        updated_at=when,
    )
    db.add(sub)
    db.commit()
    return sub


def _attempt(db: Session, user: User, when: datetime) -> None:
    db.add(RoastAttempt(user_id=user.id, created_at=when))
    db.commit()


def _roast(
    db: Session, submission: Submission, score: str = "6.5", when: datetime | None = None
) -> Roast:
    data = valid_roast_dict()
    roast = Roast(
        submission_id=submission.id,
        overall_score=Decimal(score),
        category_scores=data["category_scores"],
        headline=data["headline"],
        roast_text=data["roast_text"],
        strengths=data["strengths"],
        improvements=data["improvements"],
        model_used="gpt-test",
        input_tokens=1,
        output_tokens=2,
    )
    if when is not None:
        roast.created_at = when
        roast.updated_at = when
    db.add(roast)
    db.commit()
    return roast


def test_migration_created_jsonb_and_tz_columns(pg: Session) -> None:
    rows = pg.execute(
        text(
            "SELECT table_name, column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = 'public' AND column_name IN "
            "('category_scores', 'strengths', 'improvements', 'created_at', 'overall_score')"
        )
    ).all()
    types = {(t, c): d for t, c, d in rows}
    assert types[("roasts", "category_scores")] == "jsonb"
    assert types[("roasts", "strengths")] == "jsonb"
    assert types[("roasts", "improvements")] == "jsonb"
    assert types[("roasts", "overall_score")] == "numeric"
    assert types[("submissions", "created_at")] == "timestamp with time zone"


def test_jsonb_round_trip_and_operators(pg: Session) -> None:
    sub = _submission(pg, _user(pg))
    unicode_improvement = {
        "file": "src/வணக்கம்.py",
        "line_hint": None,
        "issue": 'Quotes " and \\ backslashes',
        "suggestion": "Machaan, split pannu 🔥",
        "severity": "high",
    }
    roast = _roast(pg, sub)
    roast.improvements = [*roast.improvements, unicode_improvement]
    pg.commit()
    roast_id = roast.id
    pg.expunge_all()

    fresh = pg.get(Roast, roast_id)
    assert fresh is not None
    expected = valid_roast_dict()
    assert fresh.category_scores == expected["category_scores"]
    assert fresh.strengths == expected["strengths"]
    assert fresh.improvements == [*expected["improvements"], unicode_improvement]
    assert fresh.improvements[0]["line_hint"] is None
    assert isinstance(fresh.category_scores["readability"], float)

    # Real JSONB operators work on the stored documents.
    testing_score = pg.scalar(
        text("SELECT (category_scores->>'testing')::numeric FROM roasts WHERE id = :id"),
        {"id": roast_id},
    )
    assert testing_score == Decimal("3")
    high = pg.scalar(
        text(
            "SELECT count(*) FROM roasts, jsonb_array_elements(improvements) AS item "
            "WHERE id = :id AND item->>'severity' = 'high'"
        ),
        {"id": roast_id},
    )
    assert high == 2
    contains = pg.scalar(
        text("SELECT count(*) FROM roasts WHERE category_scores @> CAST(:doc AS jsonb)"),
        {"doc": '{"structure": 7}'},
    )
    assert contains == 1


@pytest.mark.parametrize("score", ["0", "0.0", "10", "10.0", "9.9", "6.5"])
def test_overall_score_in_range_accepted(pg: Session, score: str) -> None:
    roast = _roast(pg, _submission(pg, _user(pg)), score=score)
    pg.refresh(roast)
    assert roast.overall_score == Decimal(score)


@pytest.mark.parametrize("score", ["11", "10.1", "-0.1", "-1"])
def test_overall_score_check_constraint_rejects(pg: Session, score: str) -> None:
    sub = _submission(pg, _user(pg))
    with pytest.raises(IntegrityError) as exc_info:
        _roast(pg, sub, score=score)
    assert "ck_roasts_overall_score_range" in str(exc_info.value)
    pg.rollback()


def test_numeric_precision_rounds_to_one_decimal(pg: Session) -> None:
    roast = _roast(pg, _submission(pg, _user(pg)), score="7.25")
    pg.refresh(roast)
    assert roast.overall_score == Decimal("7.3")


def test_cascade_delete_user_removes_submissions_roasts_tokens(pg: Session) -> None:
    keeper = _user(pg, "keeper@example.com")
    doomed = _user(pg, "doomed@example.com")
    for owner in (keeper, doomed):
        sub = _submission(pg, owner)
        _roast(pg, sub)
        _roast(pg, sub, score="8.0")
        pg.add(
            RefreshToken(
                user_id=owner.id,
                token_hash=f"{owner.id:064d}",
                expires_at=FIXED_NOW + timedelta(days=7),
            )
        )
    pg.commit()
    doomed_id = doomed.id

    # Raw SQL delete: relies on the database's ON DELETE CASCADE, not the ORM.
    pg.execute(text("DELETE FROM users WHERE id = :id"), {"id": doomed_id})
    pg.commit()

    def count(sql: str) -> int:
        return int(pg.scalar(text(sql)) or 0)

    assert count("SELECT count(*) FROM users") == 1
    assert count("SELECT count(*) FROM submissions") == 1
    assert count("SELECT count(*) FROM roasts") == 2
    assert count("SELECT count(*) FROM refresh_tokens") == 1
    assert (
        count(f"SELECT count(*) FROM submissions WHERE user_id = {doomed_id}")  # noqa: S608
        == 0
    )


def test_orm_delete_submission_cascades_roasts(pg: Session) -> None:
    sub = _submission(pg, _user(pg))
    _roast(pg, sub)
    pg.delete(sub)
    pg.commit()
    assert pg.scalar(select(func.count(Roast.id))) == 0


def test_daily_quota_with_timezone_aware_timestamps(
    pg: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(submission_service, "_now", lambda: FIXED_NOW)
    # The session's server-side TimeZone must not affect the UTC-day window.
    pg.execute(text("SET TIME ZONE 'Asia/Kolkata'"))
    user = _user(pg)
    other = _user(pg, "other@example.com")

    ist = timezone(timedelta(hours=5, minutes=30))
    pst = timezone(timedelta(hours=-8))
    # 2026-10-09 23:59 UTC == 2026-10-10 05:29 IST: local date is "today" but UTC is
    # yesterday → must NOT count.
    before_midnight_ist = datetime(2026, 10, 10, 5, 29, tzinfo=ist)
    # 2026-10-10 00:01 UTC == 2026-10-09 16:01 PST: local date "yesterday" but UTC is
    # today → MUST count.
    after_midnight_pst = datetime(2026, 10, 9, 16, 1, tzinfo=pst)

    old_done = _submission(pg, user, SubmissionStatus.completed, before_midnight_ist)
    _attempt(pg, user, before_midnight_ist)  # yesterday (UTC): 0
    _attempt(pg, user, after_midnight_pst)  # today (UTC): 1
    _attempt(pg, user, FIXED_NOW - timedelta(hours=1))  # today: 1
    _attempt(pg, user, FIXED_NOW)  # today: 1
    _attempt(pg, user, FIXED_NOW)  # today: 1
    # Another user's activity never counts.
    _attempt(pg, other, FIXED_NOW)

    assert submission_service.count_used_today(pg, user.id) == 4
    quota = submission_service.get_quota(pg, user.id)
    assert quota.used == 4
    assert quota.resets_at == datetime(2026, 10, 11, tzinfo=UTC)

    stored = pg.scalar(select(Submission.created_at).where(Submission.id == old_done.id))
    assert stored is not None and stored.utcoffset() is not None
    assert stored.astimezone(UTC) == datetime(2026, 10, 9, 23, 59, tzinfo=UTC)


def test_server_default_timestamps_are_tz_aware(pg: Session) -> None:
    user = _user(pg)
    pg.refresh(user)
    assert user.created_at.utcoffset() is not None
    assert abs(user.created_at.astimezone(UTC) - datetime.now(UTC)) < timedelta(minutes=5)


def test_list_submissions_newest_first_on_postgres(pg: Session) -> None:
    user = _user(pg)
    ids = [_submission(pg, user, when=FIXED_NOW - timedelta(minutes=10 - i)).id for i in range(3)]
    items, total = submission_service.list_submissions(pg, user.id, page=1, size=2)
    assert total == 3
    assert [s.id for s in items] == [ids[2], ids[1]]
