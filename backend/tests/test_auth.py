"""Tests for the auth module (/api/v1/auth)."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import google
from app.auth.dependencies import require_admin
from app.auth.security import create_access_token, hash_password, hash_refresh_token
from app.config import settings
from app.exceptions import ForbiddenError
from app.models.refresh_token import RefreshToken
from app.models.user import User

AUTH = "/api/v1/auth"
PASSWORD = "correct-horse-battery"  # noqa: S105

MakeUser = Callable[..., User]


def _register(
    client: TestClient, email: str = "Alice@Example.com", password: str = PASSWORD
) -> dict[str, str]:
    """Register a user through the API and return the token response."""
    response = client.post(
        f"{AUTH}/register",
        json={"email": email, "password": password, "full_name": "Alice"},
    )
    assert response.status_code == 201, response.text
    body: dict[str, str] = response.json()
    return body


def _auth_header(token: str) -> dict[str, str]:
    """Build a Bearer Authorization header."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def make_user(db: Session) -> MakeUser:
    """Factory creating users directly in the database."""

    def _make(
        email: str = "bob@example.com",
        password: str | None = PASSWORD,
        is_active: bool = True,
        is_admin: bool = False,
        oauth_provider: str | None = None,
    ) -> User:
        user = User(
            email=email,
            hashed_password=hash_password(password) if password else None,
            full_name="Bob",
            is_active=is_active,
            is_admin=is_admin,
            oauth_provider=oauth_provider,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


# --- register --------------------------------------------------------------
def test_register_success_lowercases_email(client: TestClient, db: Session) -> None:
    tokens = _register(client)
    assert tokens["token_type"] == "bearer"
    assert tokens["access_token"] and tokens["refresh_token"]
    user = db.scalar(select(User).where(User.email == "alice@example.com"))
    assert user is not None
    assert user.hashed_password and user.hashed_password != PASSWORD
    stored = db.scalar(select(RefreshToken).where(RefreshToken.user_id == user.id))
    assert stored is not None
    assert stored.token_hash == hash_refresh_token(tokens["refresh_token"])


def test_register_duplicate_email(client: TestClient) -> None:
    _register(client)
    response = client.post(
        f"{AUTH}/register",
        json={"email": "ALICE@example.com", "password": PASSWORD, "full_name": "A"},
    )
    assert response.status_code == 409
    assert response.json()["error_code"] == "email_taken"


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "not-an-email", "password": PASSWORD, "full_name": "A"},
        {"email": "a@example.com", "password": "short", "full_name": "A"},
        {"email": "a@example.com", "password": "x" * 129, "full_name": "A"},
        {"email": "a@example.com", "password": PASSWORD, "full_name": ""},
        {"email": "a@example.com", "password": PASSWORD, "full_name": "n" * 121},
        {"email": "a@example.com", "password": PASSWORD},
    ],
)
def test_register_validation(client: TestClient, payload: dict[str, str]) -> None:
    response = client.post(f"{AUTH}/register", json=payload)
    assert response.status_code == 422


# --- login -----------------------------------------------------------------
def test_login_success(client: TestClient) -> None:
    _register(client)
    response = client.post(
        f"{AUTH}/login", json={"email": "alice@EXAMPLE.com", "password": PASSWORD}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    me = client.get(f"{AUTH}/me", headers=_auth_header(body["access_token"]))
    assert me.json()["email"] == "alice@example.com"


def test_login_wrong_password(client: TestClient) -> None:
    _register(client)
    response = client.post(
        f"{AUTH}/login", json={"email": "alice@example.com", "password": "wrong-password"}
    )
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_credentials"


def test_login_unknown_email_same_error(client: TestClient) -> None:
    response = client.post(
        f"{AUTH}/login", json={"email": "nobody@example.com", "password": PASSWORD}
    )
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_credentials"


def test_login_inactive_user(client: TestClient, make_user: MakeUser) -> None:
    make_user(is_active=False)
    response = client.post(f"{AUTH}/login", json={"email": "bob@example.com", "password": PASSWORD})
    assert response.status_code == 403
    assert response.json()["error_code"] == "account_disabled"


def test_login_google_only_account(client: TestClient, make_user: MakeUser) -> None:
    make_user(password=None, oauth_provider="google")
    response = client.post(f"{AUTH}/login", json={"email": "bob@example.com", "password": PASSWORD})
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_credentials"


def test_login_rate_limited_on_sixth_attempt(client: TestClient) -> None:
    body = {"email": "nobody@example.com", "password": PASSWORD}
    for _ in range(5):
        assert client.post(f"{AUTH}/login", json=body).status_code == 401
    assert client.post(f"{AUTH}/login", json=body).status_code == 429


# --- /me -------------------------------------------------------------------
def test_me_requires_token(client: TestClient) -> None:
    response = client.get(f"{AUTH}/me")
    assert response.status_code == 401
    assert response.json()["error_code"] == "not_authenticated"


def test_me_with_token(client: TestClient) -> None:
    tokens = _register(client)
    response = client.get(f"{AUTH}/me", headers=_auth_header(tokens["access_token"]))
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["full_name"] == "Alice"
    assert body["is_admin"] is False
    assert body["oauth_provider"] is None
    assert "hashed_password" not in body
    assert "created_at" in body


def test_me_garbage_token(client: TestClient) -> None:
    response = client.get(f"{AUTH}/me", headers=_auth_header("not.a.jwt"))
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_token"


def test_me_expired_token(client: TestClient, make_user: MakeUser) -> None:
    user = make_user()
    token = create_access_token(user.id, expires_delta=timedelta(seconds=-10))
    response = client.get(f"{AUTH}/me", headers=_auth_header(token))
    assert response.status_code == 401
    assert response.json()["error_code"] == "invalid_token"


def test_me_inactive_user_token(client: TestClient, make_user: MakeUser) -> None:
    user = make_user(is_active=False)
    response = client.get(f"{AUTH}/me", headers=_auth_header(create_access_token(user.id)))
    assert response.status_code == 403
    assert response.json()["error_code"] == "account_disabled"


def test_update_me(client: TestClient) -> None:
    tokens = _register(client)
    headers = _auth_header(tokens["access_token"])
    response = client.put(
        f"{AUTH}/me",
        json={"full_name": "Alice Roasted", "avatar_url": "https://example.com/a.png"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Alice Roasted"
    assert response.json()["avatar_url"] == "https://example.com/a.png"

    partial = client.put(f"{AUTH}/me", json={"avatar_url": None}, headers=headers)
    assert partial.json()["avatar_url"] is None
    assert partial.json()["full_name"] == "Alice Roasted"

    bad = client.put(f"{AUTH}/me", json={"avatar_url": "ftp://example.com/a"}, headers=headers)
    assert bad.status_code == 422
    assert client.put(f"{AUTH}/me", json={"full_name": ""}, headers=headers).status_code == 422
    assert client.put(f"{AUTH}/me", json={"full_name": "x"}).status_code == 401


# --- refresh / logout ------------------------------------------------------
def test_refresh_rotates_token(client: TestClient, db: Session) -> None:
    tokens = _register(client)
    response = client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 200
    new = response.json()
    assert new["refresh_token"] != tokens["refresh_token"]
    old = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(tokens["refresh_token"])
        )
    )
    assert old is not None and old.revoked is True
    assert client.get(f"{AUTH}/me", headers=_auth_header(new["access_token"])).status_code == 200


def test_refresh_reuse_revokes_all_tokens(client: TestClient, db: Session) -> None:
    tokens = _register(client)
    rotated = client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["refresh_token"]}).json()
    reuse = client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401
    assert reuse.json()["error_code"] == "invalid_refresh_token"
    # The legitimately rotated token is revoked by reuse detection too.
    after = client.post(f"{AUTH}/refresh", json={"refresh_token": rotated["refresh_token"]})
    assert after.status_code == 401
    assert all(t.revoked for t in db.scalars(select(RefreshToken)))


def test_refresh_unknown_and_expired(client: TestClient, db: Session) -> None:
    unknown = client.post(f"{AUTH}/refresh", json={"refresh_token": "nope"})
    assert unknown.status_code == 401
    assert unknown.json()["error_code"] == "invalid_refresh_token"

    tokens = _register(client)
    stored = db.scalar(select(RefreshToken))
    assert stored is not None
    stored.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()
    expired = client.post(f"{AUTH}/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert expired.status_code == 401
    assert expired.json()["error_code"] == "invalid_refresh_token"


def test_logout_revokes_and_is_idempotent(client: TestClient) -> None:
    tokens = _register(client)
    body = {"refresh_token": tokens["refresh_token"]}
    assert client.post(f"{AUTH}/logout", json=body).status_code == 204
    assert client.post(f"{AUTH}/logout", json=body).status_code == 204
    assert client.post(f"{AUTH}/logout", json={"refresh_token": "unknown"}).status_code == 204
    assert client.post(f"{AUTH}/refresh", json=body).status_code == 401


# --- require_admin ---------------------------------------------------------
def test_require_admin(make_user: MakeUser) -> None:
    regular = make_user(email="user@example.com")
    admin = make_user(email="admin@example.com", is_admin=True)
    with pytest.raises(ForbiddenError) as exc_info:
        require_admin(regular)
    assert exc_info.value.error_code == "admin_required"
    assert exc_info.value.status_code == 403
    assert require_admin(admin) is admin


# --- Google OAuth ----------------------------------------------------------
def _start_google(client: TestClient) -> str:
    """Hit /auth/google and return the ``state`` sent to Google."""
    response = client.get(f"{AUTH}/google", follow_redirects=False)
    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("https://accounts.google.com/")
    params = parse_qs(urlparse(location).query)
    assert params["scope"] == ["openid email profile"]
    assert params["redirect_uri"] == [f"{settings.BACKEND_URL}/api/v1/auth/google/callback"]
    set_cookie = response.headers["set-cookie"].lower()
    assert "oauth_state=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    return params["state"][0]


def _mock_google(
    monkeypatch: pytest.MonkeyPatch, email: str = "Gina@Example.com", verified: bool = True
) -> None:
    """Replace the Google HTTP calls with canned responses."""

    async def fake_exchange(code: str) -> str:
        assert code == "auth-code"
        return "google-access-token"

    async def fake_userinfo(access_token: str) -> google.GoogleUserInfo:
        return google.GoogleUserInfo(
            sub="123",
            email=email,
            email_verified=verified,
            name="Gina G",
            picture="https://example.com/gina.png",
        )

    monkeypatch.setattr(google, "exchange_code", fake_exchange)
    monkeypatch.setattr(google, "fetch_userinfo", fake_userinfo)


def _callback(client: TestClient, state: str) -> str:
    """Call the Google callback and return the redirect Location."""
    response = client.get(
        f"{AUTH}/google/callback",
        params={"code": "auth-code", "state": state},
        follow_redirects=False,
    )
    assert response.status_code == 302
    location: str = response.headers["location"]
    return location


def test_google_redirect_sets_state_cookie(client: TestClient) -> None:
    assert _start_google(client)


def test_google_not_configured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    response = client.get(f"{AUTH}/google", follow_redirects=False)
    assert response.status_code == 503
    assert response.json()["error_code"] == "google_not_configured"


def test_google_callback_state_mismatch(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch)
    _start_google(client)
    location = _callback(client, "forged")
    assert location == f"{settings.FRONTEND_URL}/login?error=oauth_state"


def test_google_callback_without_cookie(client: TestClient) -> None:
    location = _callback(client, "whatever")
    assert location == f"{settings.FRONTEND_URL}/login?error=oauth_state"


def test_google_callback_success_creates_user(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch)
    state = _start_google(client)
    response = client.get(
        f"{AUTH}/google/callback",
        params={"code": "auth-code", "state": state},
        follow_redirects=False,
    )
    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith(f"{settings.FRONTEND_URL}/auth/callback#")
    parsed = urlparse(location)
    assert parsed.query == ""
    fragment = parse_qs(parsed.fragment)
    access_token = fragment["access_token"][0]
    assert fragment["refresh_token"][0]
    # State cookie is cleared.
    assert "oauth_state=" in response.headers["set-cookie"]
    assert "max-age=0" in response.headers["set-cookie"].lower()

    user = db.scalar(select(User).where(User.email == "gina@example.com"))
    assert user is not None
    assert user.hashed_password is None
    assert user.oauth_provider == "google"
    assert user.is_verified is True
    assert user.avatar_url == "https://example.com/gina.png"
    assert user.full_name == "Gina G"

    me = client.get(f"{AUTH}/me", headers=_auth_header(access_token))
    assert me.status_code == 200
    assert me.json()["email"] == "gina@example.com"


def test_google_callback_links_existing_user(
    client: TestClient, db: Session, make_user: MakeUser, monkeypatch: pytest.MonkeyPatch
) -> None:
    existing = make_user(email="gina@example.com")
    _mock_google(monkeypatch)
    state = _start_google(client)
    assert "/auth/callback#" in _callback(client, state)
    db.refresh(existing)
    assert existing.oauth_provider == "google"
    assert existing.is_verified is True
    assert existing.hashed_password is not None
    assert db.scalar(select(func.count()).select_from(User)) == 1


def test_google_callback_unverified_email(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _mock_google(monkeypatch, verified=False)
    state = _start_google(client)
    assert _callback(client, state) == f"{settings.FRONTEND_URL}/login?error=oauth_failed"


def test_google_callback_google_error(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_exchange(code: str) -> str:
        raise google.GoogleOAuthError("boom")

    monkeypatch.setattr(google, "exchange_code", failing_exchange)
    state = _start_google(client)
    assert _callback(client, state) == f"{settings.FRONTEND_URL}/login?error=oauth_failed"
