"""API + pipeline tests for /api/v1/submissions (GitHub and OpenAI fully mocked)."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.config import settings
from app.main import app as fastapi_app
from app.models.roast import Roast
from app.models.roast_attempt import RoastAttempt
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User
from app.services import github_service, roast_service, submission_service
from app.services.github_service import GitHubError, RepoMetadata
from tests.roaster_helpers import (
    FakeOpenAIClient,
    make_completion,
    make_tarball,
    normal_repo_files,
    valid_roast_dict,
)

URL = "/api/v1/submissions"
SHA = "b" * 40


# --- Fixtures --------------------------------------------------------------------
def _make_user(db: Session, email: str) -> User:
    user = User(email=email, full_name="Test User", hashed_password=None)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def user(db: Session) -> User:
    return _make_user(db, "student@example.com")


@pytest.fixture
def other_user(db: Session) -> User:
    return _make_user(db, "other@example.com")


@pytest.fixture
def auth_client(client: TestClient, user: User) -> TestClient:
    fastapi_app.dependency_overrides[get_current_user] = lambda: user
    return client


@pytest.fixture
def fake_openai(monkeypatch: pytest.MonkeyPatch) -> Callable[[list[Any]], FakeOpenAIClient]:
    def install(responses: list[Any]) -> FakeOpenAIClient:
        fake = FakeOpenAIClient(responses)
        monkeypatch.setattr(roast_service, "get_openai_client", lambda: fake)
        return fake

    return install


@pytest.fixture
def fake_github(monkeypatch: pytest.MonkeyPatch) -> Callable[..., None]:
    def install(
        error: GitHubError | None = None,
        error_at: str = "metadata",
        tarball: bytes | None = None,
        language: str | None = "Python",
    ) -> None:
        async def metadata(owner: str, repo: str) -> RepoMetadata:
            if error and error_at == "metadata":
                raise error
            return RepoMetadata(owner, repo, "main", False, language, 10)

        async def resolve(owner: str, repo: str, ref: str) -> str:
            if error and error_at == "commit":
                raise error
            return SHA

        async def download(owner: str, repo: str, ref: str) -> bytes:
            if error and error_at == "tarball":
                raise error
            return tarball if tarball is not None else make_tarball(normal_repo_files())

        monkeypatch.setattr(github_service, "get_repo_metadata", metadata)
        monkeypatch.setattr(github_service, "resolve_commit_sha", resolve)
        monkeypatch.setattr(github_service, "download_tarball", download)

    return install


def _add_submission(
    db: Session,
    user: User,
    status: SubmissionStatus = SubmissionStatus.completed,
    created_at: datetime | None = None,
    with_roast: bool = False,
) -> Submission:
    when = created_at or datetime.now(UTC)
    submission = Submission(
        user_id=user.id,
        repo_url="https://github.com/octo/hello",
        repo_owner="octo",
        repo_name="hello",
        status=status,
        created_at=when,
        updated_at=when,
    )
    db.add(submission)
    db.flush()
    db.add(RoastAttempt(user_id=user.id, submission_id=submission.id, created_at=when))
    if with_roast:
        roast = valid_roast_dict()
        db.add(
            Roast(
                submission_id=submission.id,
                overall_score=Decimal("6.5"),
                category_scores=roast["category_scores"],
                headline=roast["headline"],
                roast_text=roast["roast_text"],
                strengths=roast["strengths"],
                improvements=roast["improvements"],
                model_used="gpt-test",
                input_tokens=10,
                output_tokens=20,
                created_at=when,
                updated_at=when,
            )
        )
    db.commit()
    db.refresh(submission)
    return submission


# --- URL validation ---------------------------------------------------------------
@pytest.mark.parametrize(
    "repo_url",
    [
        "http://github.com/octo/hello",
        "https://gitlab.com/octo/hello",
        "https://github.com/octo",
        "https://github.com/octo/hello/blob/main/x.py",
        "https://github.com/octo/hello?tab=readme",
        "https://github.com/-octo/hello",
        "https://github.com/octo/..",
        "github.com/octo/hello",
        "https://github.com.evil.com/octo/hello",
        "javascript:alert(1)",
    ],
)
def test_invalid_repo_url_returns_400(auth_client: TestClient, repo_url: str) -> None:
    response = auth_client.post(URL, json={"repo_url": repo_url})
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_repo_url"


def test_invalid_branch_returns_400(auth_client: TestClient) -> None:
    response = auth_client.post(
        URL, json={"repo_url": "https://github.com/octo/hello", "branch": "../etc"}
    )
    assert response.status_code == 400
    assert response.json()["error_code"] == "invalid_branch"


def test_payload_length_limits_422(auth_client: TestClient) -> None:
    response = auth_client.post(
        URL, json={"repo_url": "https://github.com/octo/hello", "assignment_title": "x" * 201}
    )
    assert response.status_code == 422


def test_requires_authentication(client: TestClient) -> None:
    assert client.post(URL, json={"repo_url": "https://github.com/octo/hello"}).status_code == 401
    assert client.get(URL).status_code == 401


@pytest.mark.parametrize(
    ("url", "branch", "expected_url", "expected_branch"),
    [
        ("https://github.com/octo/hello.git", None, "https://github.com/octo/hello", None),
        ("https://github.com/octo/hello/", None, "https://github.com/octo/hello", None),
        (
            "https://github.com/octo/hello/tree/feature/x",
            None,
            "https://github.com/octo/hello",
            "feature/x",
        ),
        ("https://github.com/octo/hello/tree/dev", "main", "https://github.com/octo/hello", "main"),
    ],
)
def test_parse_repo_url_normalization(
    url: str, branch: str | None, expected_url: str, expected_branch: str | None
) -> None:
    parsed = submission_service.parse_repo_url(url, branch)
    assert parsed.url == expected_url
    assert parsed.branch == expected_branch
    assert (parsed.owner, parsed.name) == ("octo", "hello")


# --- Happy path -------------------------------------------------------------------
def test_create_returns_202_and_completes(
    auth_client: TestClient,
    fake_github: Callable[..., None],
    fake_openai: Callable[[list[Any]], FakeOpenAIClient],
) -> None:
    fake_github()
    fake_openai([make_completion(valid_roast_dict(), prompt_tokens=1234, completion_tokens=567)])

    response = auth_client.post(
        URL,
        json={
            "repo_url": "https://github.com/octo/hello.git",
            "assignment_title": "  Todo  ",
            "assignment_description": "",
        },
    )
    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "queued"
    assert body["repo_url"] == "https://github.com/octo/hello"
    assert body["assignment_title"] == "Todo"
    assert body["assignment_description"] is None
    assert body["latest_roast"] is None

    detail = auth_client.get(f"{URL}/{body['id']}")
    assert detail.status_code == 200
    data = detail.json()
    assert data["status"] == "completed"
    assert data["branch"] == "main"
    assert data["commit_sha"] == SHA
    assert data["primary_language"] == "Python"
    assert data["files_analyzed"] == 5
    assert data["error_code"] is None
    assert data["completed_at"].endswith("+00:00")
    roast = data["latest_roast"]
    assert roast["overall_score"] == 6.5
    assert roast["category_scores"]["readability"] == 7.5
    assert len(roast["improvements"]) == 3
    assert roast["model_used"] == "gpt-test-2026"
    assert "input_tokens" not in roast and "output_tokens" not in roast
    assert "token" not in detail.text.lower()


def test_full_pipeline_with_respx_github(
    auth_client: TestClient,
    db: Session,
    fake_openai: Callable[[list[Any]], FakeOpenAIClient],
) -> None:
    fake = fake_openai([make_completion(valid_roast_dict())])
    tarball = make_tarball(
        {**normal_repo_files(), "config.py": 'API_KEY = "sk-' + "s" * 40 + '"\n'}
    )
    api = "https://api.github.com/repos/octo/hello"
    with respx.mock(assert_all_called=True) as router:
        router.get(api).respond(
            200, json={"name": "hello", "default_branch": "trunk", "private": False}
        )
        router.get(f"{api}/commits/trunk").respond(200, json={"sha": SHA})
        router.get(f"{api}/tarball/{SHA}").respond(200, content=tarball)
        response = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})

    data = auth_client.get(f"{URL}/{response.json()['id']}").json()
    assert data["status"] == "completed"
    assert data["branch"] == "trunk"
    assert data["primary_language"] == "Python"  # guessed from files (metadata had none)

    user_prompt = fake.completions.calls[0]["messages"][1]["content"]
    assert "COMMITTED SECRETS DETECTED" in user_prompt
    assert "s" * 40 not in user_prompt

    roast = db.scalar(select(Roast).where(Roast.submission_id == data["id"]))
    assert roast is not None
    assert (roast.input_tokens, roast.output_tokens) == (100, 50)


# --- Failures ---------------------------------------------------------------------
@pytest.mark.parametrize(
    ("code", "error_at", "snippet"),
    [
        ("repo_not_found_or_private", "metadata", "Public repo link kudu"),
        ("github_rate_limited", "metadata", "rate limit"),
        ("branch_not_found", "commit", "branch"),
        ("repo_too_large", "tarball", "25 MB"),
    ],
)
def test_github_failures_mark_failed(
    auth_client: TestClient,
    fake_github: Callable[..., None],
    fake_openai: Callable[[list[Any]], FakeOpenAIClient],
    code: str,
    error_at: str,
    snippet: str,
) -> None:
    fake_github(error=GitHubError(code, "technical detail"), error_at=error_at)
    fake = fake_openai([])
    response = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})
    assert response.status_code == 202

    data = auth_client.get(f"{URL}/{response.json()['id']}").json()
    assert data["status"] == "failed"
    assert data["error_code"] == code
    assert snippet in data["error_message"]
    assert "technical detail" not in data["error_message"]
    assert data["latest_roast"] is None
    assert fake.completions.calls == []


def test_private_repo_via_github_404(
    auth_client: TestClient, fake_openai: Callable[[list[Any]], FakeOpenAIClient]
) -> None:
    fake_openai([])
    with respx.mock() as router:
        router.get("https://api.github.com/repos/octo/secret").respond(
            404, json={"message": "Not Found"}
        )
        response = auth_client.post(URL, json={"repo_url": "https://github.com/octo/secret"})

    data = auth_client.get(f"{URL}/{response.json()['id']}").json()
    assert data["status"] == "failed"
    assert data["error_code"] == "repo_not_found_or_private"


def test_empty_repo_fails(
    auth_client: TestClient,
    fake_github: Callable[..., None],
    fake_openai: Callable[[list[Any]], FakeOpenAIClient],
) -> None:
    fake_github(tarball=make_tarball({"logo.png": b"\x89PNG"}))
    fake_openai([])
    response = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})
    data = auth_client.get(f"{URL}/{response.json()['id']}").json()
    assert data["error_code"] == "repo_empty"


def test_ai_invalid_output_fails(
    auth_client: TestClient,
    fake_github: Callable[..., None],
    fake_openai: Callable[[list[Any]], FakeOpenAIClient],
) -> None:
    fake_github()
    bad = valid_roast_dict(strengths=[])
    fake = fake_openai([make_completion(bad), make_completion(bad)])
    response = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})

    data = auth_client.get(f"{URL}/{response.json()['id']}").json()
    assert data["status"] == "failed"
    assert data["error_code"] == "ai_invalid_output"
    assert data["files_analyzed"] == 5
    assert len(fake.completions.calls) == 2


def test_unexpected_exception_becomes_internal_error(
    auth_client: TestClient,
    fake_github: Callable[..., None],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_github()

    async def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("kaboom")

    monkeypatch.setattr(roast_service, "generate_roast", boom)
    response = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})
    data = auth_client.get(f"{URL}/{response.json()['id']}").json()
    assert data["status"] == "failed"
    assert data["error_code"] == "internal_error"
    assert "kaboom" not in data["error_message"]


async def test_process_missing_submission_is_noop() -> None:
    await submission_service.process_submission(999_999)


# --- Daily limit & quota ----------------------------------------------------------
def test_quota_fresh_user(auth_client: TestClient) -> None:
    response = auth_client.get(f"{URL}/quota")
    assert response.status_code == 200
    data = response.json()
    assert data["used"] == 0
    assert data["limit"] == settings.ROAST_DAILY_LIMIT
    resets_at = datetime.fromisoformat(data["resets_at"])
    now = datetime.now(UTC)
    assert resets_at > now
    assert resets_at - now <= timedelta(days=1)
    assert (resets_at.hour, resets_at.minute, resets_at.second) == (0, 0, 0)


def test_daily_limit_returns_429(
    auth_client: TestClient, db: Session, user: User, other_user: User
) -> None:
    for _ in range(settings.ROAST_DAILY_LIMIT):
        _add_submission(db, user, status=SubmissionStatus.completed, with_roast=True)
    _add_submission(db, other_user, status=SubmissionStatus.queued)  # not counted

    assert auth_client.get(f"{URL}/quota").json()["used"] == settings.ROAST_DAILY_LIMIT
    response = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})
    assert response.status_code == 429
    assert response.json()["error_code"] == "daily_limit_reached"
    assert db.scalar(select(func.count(Submission.id))) == settings.ROAST_DAILY_LIMIT + 1


def test_quota_counts_attempts(auth_client: TestClient, db: Session, user: User) -> None:
    yesterday = datetime.now(UTC) - timedelta(days=1, hours=1)
    _add_submission(db, user, created_at=yesterday, with_roast=True)  # old: not counted
    _add_submission(db, user, status=SubmissionStatus.failed, created_at=yesterday)  # old fail
    _add_submission(db, user, status=SubmissionStatus.failed)  # failed today: 1
    _add_submission(db, user, status=SubmissionStatus.analyzing)  # in flight today: 1
    _add_submission(db, user, with_roast=True)  # completed today: 1
    assert auth_client.get(f"{URL}/quota").json()["used"] == 3


def test_slowapi_limit_on_create(
    auth_client: TestClient,
    fake_github: Callable[..., None],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ROAST_DAILY_LIMIT", 100)
    fake_github(error=GitHubError("repo_not_found_or_private", "x"))
    codes = [
        auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"}).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [202] * 10
    assert codes[10] == 429


# --- Ownership, list, delete ------------------------------------------------------
def test_other_users_submission_is_404(
    auth_client: TestClient, db: Session, other_user: User
) -> None:
    foreign = _add_submission(db, other_user, with_roast=True)
    for response in (
        auth_client.get(f"{URL}/{foreign.id}"),
        auth_client.delete(f"{URL}/{foreign.id}"),
        auth_client.post(f"{URL}/{foreign.id}/reroast"),
    ):
        assert response.status_code == 404
        assert response.json()["error_code"] == "submission_not_found"
    assert auth_client.get(URL).json()["total"] == 0
    assert db.get(Submission, foreign.id) is not None


def test_list_pagination_newest_first(auth_client: TestClient, db: Session, user: User) -> None:
    now = datetime.now(UTC)
    ids = [
        _add_submission(db, user, created_at=now - timedelta(minutes=10 - i), with_roast=True).id
        for i in range(3)
    ]

    first = auth_client.get(URL, params={"page": 1, "size": 2}).json()
    assert first["total"] == 3
    assert (first["page"], first["size"]) == (1, 2)
    assert [item["id"] for item in first["items"]] == [ids[2], ids[1]]
    assert first["items"][0]["latest_roast"]["headline"]

    second = auth_client.get(URL, params={"page": 2, "size": 2}).json()
    assert [item["id"] for item in second["items"]] == [ids[0]]

    assert auth_client.get(URL, params={"size": 51}).status_code == 422
    assert auth_client.get(URL, params={"page": 0}).status_code == 422


def test_delete_submission(auth_client: TestClient, db: Session, user: User) -> None:
    submission = _add_submission(db, user, with_roast=True)
    response = auth_client.delete(f"{URL}/{submission.id}")
    assert response.status_code == 204
    assert response.content == b""
    assert auth_client.get(f"{URL}/{submission.id}").status_code == 404
    db.expire_all()
    assert db.scalar(select(func.count(Roast.id))) == 0


def test_get_missing_submission_404(auth_client: TestClient) -> None:
    response = auth_client.get(f"{URL}/12345")
    assert response.status_code == 404
    assert response.json()["error_code"] == "submission_not_found"


# --- Re-roast ---------------------------------------------------------------------
@pytest.mark.parametrize(
    "status", [SubmissionStatus.queued, SubmissionStatus.fetching, SubmissionStatus.analyzing]
)
def test_reroast_conflict_when_processing(
    auth_client: TestClient, db: Session, user: User, status: SubmissionStatus
) -> None:
    submission = _add_submission(db, user, status=status)
    response = auth_client.post(f"{URL}/{submission.id}/reroast")
    assert response.status_code == 409
    assert response.json()["error_code"] == "already_processing"


def test_reroast_creates_new_roast(
    auth_client: TestClient,
    db: Session,
    user: User,
    fake_github: Callable[..., None],
    fake_openai: Callable[[list[Any]], FakeOpenAIClient],
) -> None:
    earlier = datetime.now(UTC) - timedelta(days=2)
    submission = _add_submission(db, user, created_at=earlier, with_roast=True)
    fake_github()
    fake_openai([make_completion(valid_roast_dict(headline="Round 2 machaan!"))])

    response = auth_client.post(f"{URL}/{submission.id}/reroast")
    assert response.status_code == 202
    assert response.json()["status"] == "queued"

    data = auth_client.get(f"{URL}/{submission.id}").json()
    assert data["status"] == "completed"
    assert data["latest_roast"]["headline"] == "Round 2 machaan!"
    assert db.scalar(select(func.count(Roast.id))) == 2
    assert auth_client.get(f"{URL}/quota").json()["used"] == 1


def test_reroast_after_failure_respects_daily_limit(
    auth_client: TestClient, db: Session, user: User, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "ROAST_DAILY_LIMIT", 1)
    failed = _add_submission(db, user, status=SubmissionStatus.failed)
    response = auth_client.post(f"{URL}/{failed.id}/reroast")
    assert response.status_code == 429
    assert response.json()["error_code"] == "daily_limit_reached"
