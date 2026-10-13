"""Branch-coverage tests for auth, Google OAuth, config and pipeline edge cases.

All HTTP is mocked with respx; no real network calls are made.
"""

import logging
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import google
from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.config import Settings, settings
from app.exceptions import ConflictError, ForbiddenError
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User
from app.services import auth_service, submission_service

AUTH = "/api/v1/auth"
PASSWORD = "correct-horse-battery"  # noqa: S105


def _user(db: Session, email: str = "gap@example.com", **kwargs: Any) -> User:
    user = User(
        email=email,
        full_name=kwargs.pop("full_name", "Gap"),
        hashed_password=kwargs.pop("hashed_password", hash_password(PASSWORD)),
        **kwargs,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# --- security.py ---------------------------------------------------------------
def test_verify_password_malformed_hash_returns_false(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING):
        assert verify_password("anything", "not-a-bcrypt-hash") is False
    assert "malformed" in caplog.text
    assert "anything" not in caplog.text


def test_decode_rejects_wrong_type_and_non_int_sub() -> None:
    import jwt

    wrong_type = jwt.encode(
        {"sub": "1", "type": "refresh", "exp": 9_999_999_999},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    assert decode_access_token(wrong_type) is None

    bad_sub = jwt.encode(
        {"sub": "abc", "type": "access", "exp": 9_999_999_999},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    assert decode_access_token(bad_sub) is None

    other_key = jwt.encode(
        {"sub": "1", "type": "access", "exp": 9_999_999_999},
        "another-secret-key-that-is-at-least-32-bytes",
        algorithm=settings.ALGORITHM,
    )
    assert decode_access_token(other_key) is None


def test_token_for_deleted_user_is_401(client: TestClient, db: Session) -> None:
    user = _user(db)
    token = create_access_token(user.id)
    db.delete(user)
    db.commit()
    response = client.get(f"{AUTH}/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_token"


# --- config.py -----------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('["http://a.test", "http://b.test"]', ["http://a.test", "http://b.test"]),
        (" http://a.test , ,http://b.test ", ["http://a.test", "http://b.test"]),
    ],
)
def test_cors_origins_parsing(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: list[str]
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", raw)
    assert Settings(_env_file=None).CORS_ORIGINS == expected


def test_is_production_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "Production")
    assert Settings(_env_file=None).is_production is True


# --- auth_service.py -----------------------------------------------------------
def test_register_integrity_race_returns_conflict(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Two concurrent registrations: the pre-check passes but the INSERT collides."""
    _user(db, email="race@example.com")
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda _db, _email: None)
    with pytest.raises(ConflictError) as exc_info:
        auth_service.register(db, "race@example.com", PASSWORD, "Racer")
    assert exc_info.value.error_code == "email_taken"


def test_register_integrity_error_type_is_caught(db: Session) -> None:
    # Sanity: SQLite really raises IntegrityError for duplicate emails.
    _user(db, email="dup@example.com")
    db.add(User(email="dup@example.com", full_name="Dup"))
    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_refresh_for_disabled_user_is_403(client: TestClient, db: Session) -> None:
    response = client.post(
        f"{AUTH}/register",
        json={"email": "dis@example.com", "password": PASSWORD, "full_name": "Dis"},
    )
    refresh_token = response.json()["refresh_token"]
    user = db.scalar(select(User).where(User.email == "dis@example.com"))
    assert user is not None
    user.is_active = False
    db.commit()

    first = client.post(f"{AUTH}/refresh", json={"refresh_token": refresh_token})
    assert first.status_code == 403
    assert first.json()["error_code"] == "account_disabled"
    # The token was revoked, so a retry is treated as reuse (401).
    second = client.post(f"{AUTH}/refresh", json={"refresh_token": refresh_token})
    assert second.status_code == 401


def _info(**overrides: Any) -> google.GoogleUserInfo:
    data: dict[str, Any] = {
        "sub": "42",
        "email": "linked@example.com",
        "email_verified": True,
        "name": "Linked Name",
        "picture": "https://example.com/p.png",
    }
    data.update(overrides)
    return google.GoogleUserInfo(**data)


def test_upsert_google_fills_missing_profile_fields(db: Session) -> None:
    existing = _user(db, email="linked@example.com", full_name="", oauth_provider="github")
    user = auth_service.upsert_google_user(db, _info())
    db.commit()
    assert user.id == existing.id
    assert user.full_name == "Linked Name"
    assert user.avatar_url == "https://example.com/p.png"
    assert user.oauth_provider == "github"  # existing provider not overwritten


def test_upsert_google_new_user_without_name_uses_email_prefix(db: Session) -> None:
    user = auth_service.upsert_google_user(db, _info(email="NoName@Example.com", name=None))
    assert user.full_name == "noname"
    assert user.email == "noname@example.com"


def test_upsert_google_disabled_user_forbidden(db: Session) -> None:
    _user(db, email="linked@example.com", is_active=False)
    with pytest.raises(ForbiddenError) as exc_info:
        auth_service.upsert_google_user(db, _info())
    assert exc_info.value.error_code == "account_disabled"


# --- Google OAuth router branches ---------------------------------------------
def _start(client: TestClient) -> str:
    response = client.get(f"{AUTH}/google", follow_redirects=False)
    return parse_qs(urlparse(response.headers["location"]).query)["state"][0]


def test_google_callback_tampered_cookie(client: TestClient) -> None:
    state = _start(client)
    client.cookies.clear()
    client.cookies.set("oauth_state", "tampered.value.sig", path="/api/v1/auth/google")
    response = client.get(
        f"{AUTH}/google/callback",
        params={"code": "c", "state": state},
        follow_redirects=False,
    )
    assert response.headers["location"].endswith("/login?error=oauth_state")


def test_google_callback_error_param(client: TestClient) -> None:
    state = _start(client)
    response = client.get(
        f"{AUTH}/google/callback",
        params={"error": "access_denied", "state": state},
        follow_redirects=False,
    )
    assert response.headers["location"].endswith("/login?error=oauth_failed")


def test_google_callback_disabled_account(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _user(db, email="linked@example.com", is_active=False)

    async def exchange(code: str) -> str:
        return "tok"

    async def userinfo(token: str) -> google.GoogleUserInfo:
        return _info()

    monkeypatch.setattr(google, "exchange_code", exchange)
    monkeypatch.setattr(google, "fetch_userinfo", userinfo)
    state = _start(client)
    response = client.get(
        f"{AUTH}/google/callback",
        params={"code": "c", "state": state},
        follow_redirects=False,
    )
    location = response.headers["location"]
    assert location.endswith("/login?error=account_disabled")
    assert "access_token" not in location


# --- app/auth/google.py HTTP layer (respx) -------------------------------------
async def test_exchange_code_success_sends_expected_form() -> None:
    with respx.mock() as router:
        route = router.post(google.TOKEN_URL).respond(200, json={"access_token": "g-tok"})
        assert await google.exchange_code("the-code") == "g-tok"
    body = parse_qs(route.calls.last.request.content.decode())
    assert body["code"] == ["the-code"]
    assert body["grant_type"] == ["authorization_code"]
    assert body["redirect_uri"] == [google.callback_url()]


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(400, json={"error": "invalid_grant"}),
        httpx.Response(200, json={"token_type": "Bearer"}),
        httpx.Response(200, json={"access_token": ""}),
    ],
)
async def test_exchange_code_failures(response: httpx.Response) -> None:
    with respx.mock() as router:
        router.post(google.TOKEN_URL).mock(return_value=response)
        with pytest.raises(google.GoogleOAuthError):
            await google.exchange_code("c")


async def test_exchange_code_network_error() -> None:
    with respx.mock() as router:
        router.post(google.TOKEN_URL).mock(side_effect=httpx.ConnectError("down"))
        with pytest.raises(google.GoogleOAuthError):
            await google.exchange_code("c")


async def test_fetch_userinfo_success_string_verified() -> None:
    payload = {
        "sub": "1",
        "email": "a@b.test",
        "email_verified": "true",
        "name": 123,
        "picture": "https://x.test/p.png",
    }
    with respx.mock() as router:
        route = router.get(google.USERINFO_URL).respond(200, json=payload)
        info = await google.fetch_userinfo("g-tok")
    assert route.calls.last.request.headers["Authorization"] == "Bearer g-tok"
    assert info.email_verified is True
    assert info.name is None
    assert info.picture == "https://x.test/p.png"


async def test_fetch_userinfo_unverified_by_default() -> None:
    with respx.mock() as router:
        router.get(google.USERINFO_URL).respond(200, json={"sub": "1", "email": "a@b.test"})
        info = await google.fetch_userinfo("t")
    assert info.email_verified is False


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(401, json={}),
        httpx.Response(200, json={"email": "a@b.test"}),
        httpx.Response(200, json={"sub": "1", "email": ""}),
    ],
)
async def test_fetch_userinfo_failures(response: httpx.Response) -> None:
    with respx.mock() as router:
        router.get(google.USERINFO_URL).mock(return_value=response)
        with pytest.raises(google.GoogleOAuthError):
            await google.fetch_userinfo("t")


async def test_fetch_userinfo_network_error() -> None:
    with respx.mock() as router:
        router.get(google.USERINFO_URL).mock(side_effect=httpx.ReadTimeout("slow"))
        with pytest.raises(google.GoogleOAuthError):
            await google.fetch_userinfo("t")


# --- submission_service._mark_failed ------------------------------------------
def test_mark_failed_missing_submission_is_noop() -> None:
    submission_service._mark_failed(424242, "internal_error")


def test_mark_failed_unknown_code_uses_internal_message(db: Session) -> None:
    user = _user(db)
    sub = Submission(
        user_id=user.id,
        repo_url="https://github.com/o/r",
        repo_owner="o",
        repo_name="r",
        status=SubmissionStatus.analyzing,
    )
    db.add(sub)
    db.commit()
    submission_service._mark_failed(sub.id, "weird_code")
    db.expire_all()
    stored = db.get(Submission, sub.id)
    assert stored is not None
    assert stored.status == SubmissionStatus.failed
    assert stored.error_message == submission_service.FRIENDLY_ERRORS["internal_error"]
    assert stored.completed_at is not None


def test_mark_failed_swallows_db_errors(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    class BrokenSession:
        rolled_back = False
        closed = False

        def get(self, *args: Any) -> None:
            raise RuntimeError("db down")

        def rollback(self) -> None:
            BrokenSession.rolled_back = True

        def close(self) -> None:
            BrokenSession.closed = True

    monkeypatch.setattr(submission_service, "SessionLocal", BrokenSession)
    with caplog.at_level(logging.ERROR):
        submission_service._mark_failed(1, "internal_error")
    assert BrokenSession.rolled_back and BrokenSession.closed
    assert "Could not mark submission 1 as failed" in caplog.text


# --- OpenAPI docs (acceptance: "OpenAPI docs complete") -------------------------
def test_openapi_lists_every_endpoint(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    expected = {
        ("/api/v1/auth/register", "post"),
        ("/api/v1/auth/login", "post"),
        ("/api/v1/auth/refresh", "post"),
        ("/api/v1/auth/logout", "post"),
        ("/api/v1/auth/me", "get"),
        ("/api/v1/auth/me", "put"),
        ("/api/v1/auth/google", "get"),
        ("/api/v1/auth/google/callback", "get"),
        ("/api/v1/submissions", "post"),
        ("/api/v1/submissions", "get"),
        ("/api/v1/submissions/quota", "get"),
        ("/api/v1/submissions/{submission_id}", "get"),
        ("/api/v1/submissions/{submission_id}", "delete"),
        ("/api/v1/submissions/{submission_id}/reroast", "post"),
        ("/health", "get"),
    }
    for path, method in expected:
        assert method in paths.get(path, {}), f"{method.upper()} {path} missing from OpenAPI"
    schemas = spec["components"]["schemas"]
    for name in ("SubmissionResponse", "QuotaResponse", "TokenResponse", "UserResponse"):
        assert name in schemas
    assert "202" in paths["/api/v1/submissions"]["post"]["responses"]
