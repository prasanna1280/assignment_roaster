"""API tests for /api/v1/admin (user management, submission monitor, stats)."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.main import app as fastapi_app
from app.models.refresh_token import RefreshToken
from app.models.roast import Roast
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User
from app.services import admin_service
from tests.roaster_helpers import valid_roast_dict

URL = "/api/v1/admin"
PASSWORD = "Str0ng-pass!"  # noqa: S105


def _make_user(db: Session, email: str, is_admin: bool = False) -> User:
    user = User(email=email, full_name=email.split("@")[0], is_admin=is_admin)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _add_submission(
    db: Session,
    user: User,
    status: SubmissionStatus = SubmissionStatus.completed,
    score: str | None = None,
    when: datetime | None = None,
    tokens: tuple[int, int] = (100, 50),
) -> Submission:
    when = when or datetime.now(UTC)
    sub = Submission(
        user_id=user.id,
        repo_url="https://github.com/octo/hello",
        repo_owner="octo",
        repo_name="hello",
        status=status,
        error_code="repo_not_found_or_private" if status == SubmissionStatus.failed else None,
        created_at=when,
        updated_at=when,
    )
    db.add(sub)
    db.flush()
    if score is not None:
        data = valid_roast_dict()
        db.add(
            Roast(
                submission_id=sub.id,
                overall_score=Decimal(score),
                category_scores=data["category_scores"],
                headline=data["headline"],
                roast_text=data["roast_text"],
                strengths=data["strengths"],
                improvements=data["improvements"],
                model_used="gpt-test",
                input_tokens=tokens[0],
                output_tokens=tokens[1],
                created_at=when,
                updated_at=when,
            )
        )
    db.commit()
    return sub


@pytest.fixture
def admin(db: Session) -> User:
    return _make_user(db, "admin@example.com", is_admin=True)


@pytest.fixture
def student(db: Session) -> User:
    return _make_user(db, "student@example.com")


@pytest.fixture
def admin_client(client: TestClient, admin: User) -> TestClient:
    fastapi_app.dependency_overrides[get_current_user] = lambda: admin
    return client


# --- Access control ----------------------------------------------------------------
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/users"),
        ("put", "/users/1"),
        ("get", "/submissions"),
        ("get", "/stats"),
    ],
)
def test_non_admin_gets_403(
    client: TestClient, student: User, method: str, path: str
) -> None:
    fastapi_app.dependency_overrides[get_current_user] = lambda: student
    response = client.request(method, f"{URL}{path}", json={"is_active": False})
    assert response.status_code == 403
    assert response.json()["error_code"] == "admin_required"


def test_anonymous_gets_401(client: TestClient) -> None:
    assert client.get(f"{URL}/stats").status_code == 401


# --- Users -------------------------------------------------------------------------
def test_list_users_with_counts_and_search(
    admin_client: TestClient, db: Session, admin: User, student: User
) -> None:
    _add_submission(db, student, score="7.0")
    _add_submission(db, student, status=SubmissionStatus.failed)

    data = admin_client.get(f"{URL}/users").json()
    assert data["total"] == 2
    counts = {item["email"]: item["submission_count"] for item in data["items"]}
    assert counts == {"admin@example.com": 0, "student@example.com": 2}
    assert "hashed_password" not in data["items"][0]

    found = admin_client.get(f"{URL}/users", params={"search": "STUD"}).json()
    assert [item["email"] for item in found["items"]] == ["student@example.com"]


def test_user_search_treats_wildcards_literally(
    admin_client: TestClient, db: Session, student: User
) -> None:
    _make_user(db, "under_score@example.com")
    found = admin_client.get(f"{URL}/users", params={"search": "_"}).json()
    assert [item["email"] for item in found["items"]] == ["under_score@example.com"]


def test_user_list_pagination(admin_client: TestClient, db: Session) -> None:
    for i in range(3):
        _make_user(db, f"u{i}@example.com")
    data = admin_client.get(f"{URL}/users", params={"page": 2, "size": 3}).json()
    assert data["total"] == 4
    assert len(data["items"]) == 1


def test_toggle_admin(admin_client: TestClient, db: Session, student: User) -> None:
    response = admin_client.put(f"{URL}/users/{student.id}", json={"is_admin": True})
    assert response.status_code == 200
    assert response.json()["is_admin"] is True
    db.refresh(student)
    assert student.is_admin is True


def test_deactivated_user_cannot_log_in_and_tokens_are_revoked(
    client: TestClient, db: Session, admin: User
) -> None:
    register = client.post(
        "/api/v1/auth/register",
        json={"email": "victim@example.com", "password": PASSWORD, "full_name": "Victim"},
    )
    assert register.status_code == 201
    refresh_token = register.json()["refresh_token"]
    victim = db.scalar(select(User).where(User.email == "victim@example.com"))
    assert victim is not None

    fastapi_app.dependency_overrides[get_current_user] = lambda: admin
    response = client.put(f"{URL}/users/{victim.id}", json={"is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    fastapi_app.dependency_overrides.clear()

    assert db.scalars(select(RefreshToken.revoked).where(RefreshToken.user_id == victim.id)).all()
    db.expire_all()
    assert all(db.scalars(select(RefreshToken.revoked).where(RefreshToken.user_id == victim.id)))

    login = client.post(
        "/api/v1/auth/login", json={"email": "victim@example.com", "password": PASSWORD}
    )
    assert login.status_code in (401, 403)
    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 401

    # Reactivating lets them log in again.
    fastapi_app.dependency_overrides[get_current_user] = lambda: admin
    assert client.put(f"{URL}/users/{victim.id}", json={"is_active": True}).status_code == 200
    fastapi_app.dependency_overrides.clear()
    login = client.post(
        "/api/v1/auth/login", json={"email": "victim@example.com", "password": PASSWORD}
    )
    assert login.status_code == 200


def test_admin_cannot_modify_self(admin_client: TestClient, admin: User) -> None:
    response = admin_client.put(f"{URL}/users/{admin.id}", json={"is_admin": False})
    assert response.status_code == 400
    assert response.json()["error_code"] == "cannot_modify_self"


def test_update_unknown_user_404(admin_client: TestClient) -> None:
    response = admin_client.put(f"{URL}/users/9999", json={"is_active": False})
    assert response.status_code == 404
    assert response.json()["error_code"] == "user_not_found"


def test_update_rejects_bad_payload(admin_client: TestClient, student: User) -> None:
    response = admin_client.put(f"{URL}/users/{student.id}", json={"is_active": "maybe"})
    assert response.status_code == 422


# --- Submissions -------------------------------------------------------------------
def test_list_all_submissions_and_filter_by_status(
    admin_client: TestClient, db: Session, admin: User, student: User
) -> None:
    old = datetime.now(UTC) - timedelta(hours=1)
    _add_submission(db, student, score="6.5", when=old)
    _add_submission(db, admin, status=SubmissionStatus.failed)

    data = admin_client.get(f"{URL}/submissions").json()
    assert data["total"] == 2
    newest, oldest = data["items"]
    assert newest["user_email"] == "admin@example.com"
    assert newest["status"] == "failed"
    assert newest["error_code"] == "repo_not_found_or_private"
    assert newest["overall_score"] is None
    assert oldest["overall_score"] == 6.5
    assert "roast_text" not in oldest

    failed = admin_client.get(f"{URL}/submissions", params={"status": "failed"}).json()
    assert failed["total"] == 1
    assert failed["items"][0]["status"] == "failed"


def test_submission_status_filter_validated(admin_client: TestClient) -> None:
    assert admin_client.get(f"{URL}/submissions", params={"status": "nope"}).status_code == 422


# --- Stats -------------------------------------------------------------------------
def test_stats_empty(admin_client: TestClient) -> None:
    data = admin_client.get(f"{URL}/stats").json()
    assert data["total_users"] == 1
    assert data["total_submissions"] == 0
    assert data["failure_rate"] == 0.0
    assert data["average_score"] is None
    assert len(data["roasts_per_day"]) == admin_service.STATS_DAYS
    assert data["roasts_today"] == 0


def test_stats_aggregates(
    admin_client: TestClient, db: Session, student: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    now = datetime(2026, 10, 10, 12, 0, tzinfo=UTC)
    monkeypatch.setattr(admin_service, "_now", lambda: now)
    student.is_active = False
    db.commit()

    _add_submission(db, student, score="6.0", when=now, tokens=(1000, 200))
    _add_submission(db, student, score="8.0", when=now - timedelta(days=2), tokens=(500, 100))
    _add_submission(db, student, score="5.0", when=now - timedelta(days=30), tokens=(1, 1))
    _add_submission(db, student, status=SubmissionStatus.failed, when=now)
    _add_submission(db, student, status=SubmissionStatus.analyzing, when=now)

    data = admin_client.get(f"{URL}/stats").json()
    assert data["total_users"] == 2
    assert data["active_users"] == 1
    assert data["total_submissions"] == 5
    assert data["submissions_by_status"] == {
        "queued": 0,
        "fetching": 0,
        "analyzing": 1,
        "completed": 3,
        "failed": 1,
    }
    assert data["failure_rate"] == 0.25
    assert data["total_roasts"] == 3
    assert data["average_score"] == pytest.approx(6.33, abs=0.01)
    assert data["total_input_tokens"] == 1501
    assert data["total_output_tokens"] == 301
    assert data["roasts_today"] == 1
    per_day = {item["day"]: item["count"] for item in data["roasts_per_day"]}
    assert per_day["2026-10-10"] == 1
    assert per_day["2026-10-08"] == 1
    assert "2026-09-10" not in per_day
    assert sum(per_day.values()) == 2
