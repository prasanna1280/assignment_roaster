"""Strict-xfail tests that demonstrate known bugs in app code (found by TEST-AGENT).

Each test asserts the CORRECT behaviour. When the bug is fixed the test will
XPASS, which fails the run under ``strict=True`` — remove the marker then.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.config import settings
from app.main import app as fastapi_app
from app.models.user import User
from app.services import roast_service
from app.services.github_service import RepoMetadata
from tests.roaster_helpers import (
    FakeOpenAIClient,
    make_completion,
    make_tarball,
    normal_repo_files,
    valid_roast_dict,
)

URL = "/api/v1/submissions"


@pytest.fixture
def auth_client(client: TestClient, db: Session) -> TestClient:
    user = User(email="bug@example.com", full_name="Bug", hashed_password=None)
    db.add(user)
    db.commit()
    db.refresh(user)
    fastapi_app.dependency_overrides[get_current_user] = lambda: user
    return client


@pytest.fixture
def pipeline_mocks(monkeypatch: pytest.MonkeyPatch) -> Callable[[int], FakeOpenAIClient]:
    from app.services import github_service

    async def metadata(owner: str, repo: str) -> RepoMetadata:
        return RepoMetadata(owner, repo, "main", False, "Python", 10)

    async def resolve(owner: str, repo: str, ref: str) -> str:
        return "d" * 40

    async def download(owner: str, repo: str, ref: str) -> bytes:
        return make_tarball(normal_repo_files())

    monkeypatch.setattr(github_service, "get_repo_metadata", metadata)
    monkeypatch.setattr(github_service, "resolve_commit_sha", resolve)
    monkeypatch.setattr(github_service, "download_tarball", download)

    def install(n: int) -> FakeOpenAIClient:
        fake = FakeOpenAIClient([make_completion(valid_roast_dict()) for _ in range(n)])
        monkeypatch.setattr(roast_service, "get_openai_client", lambda: fake)
        return fake

    return install


def test_deleting_a_submission_does_not_refund_daily_quota(
    auth_client: TestClient,
    pipeline_mocks: Callable[[int], FakeOpenAIClient],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "ROAST_DAILY_LIMIT", 1)
    fake = pipeline_mocks(3)

    first = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})
    assert first.status_code == 202
    assert auth_client.get(f"{URL}/{first.json()['id']}").json()["status"] == "completed"
    assert auth_client.get(f"{URL}/quota").json()["used"] == 1

    assert auth_client.delete(f"{URL}/{first.json()['id']}").status_code == 204

    # Still one roast used today: quota must not be refunded by deleting history.
    assert auth_client.get(f"{URL}/quota").json()["used"] == 1
    second = auth_client.post(URL, json={"repo_url": "https://github.com/octo/hello"})
    assert second.status_code == 429
    assert len(fake.completions.calls) == 1
