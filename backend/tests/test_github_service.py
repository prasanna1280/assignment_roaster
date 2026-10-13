"""Tests for the GitHub client (all HTTP mocked with respx)."""

import httpx
import pytest
import respx

from app.config import settings
from app.services import github_service as gh

API = "https://api.github.com"
SHA = "a" * 40


@pytest.fixture
def mock_github() -> respx.MockRouter:
    with respx.mock(assert_all_called=False) as router:
        yield router


async def test_metadata_success_and_headers(
    mock_github: respx.MockRouter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "GITHUB_TOKEN", "")
    route = mock_github.get(f"{API}/repos/octo/hello").respond(
        200,
        json={
            "name": "hello",
            "owner": {"login": "octo"},
            "default_branch": "trunk",
            "private": False,
            "language": "Python",
            "size": 12,
        },
    )
    meta = await gh.get_repo_metadata("octo", "hello")

    assert meta == gh.RepoMetadata("octo", "hello", "trunk", False, "Python", 12)
    request = route.calls.last.request
    assert request.headers["Accept"] == "application/vnd.github+json"
    assert request.headers["X-GitHub-Api-Version"] == "2022-11-28"
    assert request.headers["User-Agent"] == "assignment-roaster"
    assert "Authorization" not in request.headers


async def test_token_sent_when_configured(
    mock_github: respx.MockRouter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "GITHUB_TOKEN", "github_pat_test")
    route = mock_github.get(f"{API}/repos/octo/hello").respond(
        200, json={"name": "hello", "default_branch": "main", "private": False}
    )
    await gh.get_repo_metadata("octo", "hello")
    assert route.calls.last.request.headers["Authorization"] == "Bearer github_pat_test"


@pytest.mark.parametrize(
    ("status", "headers", "body", "code"),
    [
        (404, {}, {"message": "Not Found"}, "repo_not_found_or_private"),
        (403, {}, {"message": "Repository access blocked"}, "repo_not_found_or_private"),
        (403, {"x-ratelimit-remaining": "0"}, {"message": "x"}, "github_rate_limited"),
        (403, {}, {"message": "API rate limit exceeded"}, "github_rate_limited"),
        (403, {"retry-after": "60"}, {"message": "secondary"}, "github_rate_limited"),
        (429, {}, {"message": "slow down"}, "github_rate_limited"),
        (502, {}, {"message": "bad gateway"}, "github_unavailable"),
        (418, {}, {"message": "teapot"}, "github_unavailable"),
    ],
)
async def test_metadata_errors(
    mock_github: respx.MockRouter,
    status: int,
    headers: dict[str, str],
    body: dict[str, str],
    code: str,
) -> None:
    mock_github.get(f"{API}/repos/octo/hello").respond(status, headers=headers, json=body)
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.get_repo_metadata("octo", "hello")
    assert exc_info.value.code == code


async def test_metadata_private_repo(mock_github: respx.MockRouter) -> None:
    mock_github.get(f"{API}/repos/octo/hello").respond(
        200, json={"name": "hello", "default_branch": "main", "private": True}
    )
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.get_repo_metadata("octo", "hello")
    assert exc_info.value.code == "repo_not_found_or_private"


async def test_metadata_network_error(mock_github: respx.MockRouter) -> None:
    mock_github.get(f"{API}/repos/octo/hello").mock(side_effect=httpx.ConnectError("boom"))
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.get_repo_metadata("octo", "hello")
    assert exc_info.value.code == "github_unavailable"


async def test_resolve_commit_sha(mock_github: respx.MockRouter) -> None:
    route = mock_github.get(f"{API}/repos/octo/hello/commits/feature/x").respond(
        200, json={"sha": SHA}
    )
    assert await gh.resolve_commit_sha("octo", "hello", "feature/x") == SHA
    assert route.called


@pytest.mark.parametrize(
    ("status", "body", "code"),
    [
        (422, {"message": "No commit found for SHA: nope"}, "branch_not_found"),
        (404, {"message": "Not Found"}, "branch_not_found"),
        (409, {"message": "Git Repository is empty."}, "repo_empty"),
        (429, {"message": "slow"}, "github_rate_limited"),
        (500, {"message": "oops"}, "github_unavailable"),
        (301, {"message": "moved"}, "github_unavailable"),
        (200, {"no": "sha"}, "github_unavailable"),
    ],
)
async def test_resolve_commit_sha_errors(
    mock_github: respx.MockRouter, status: int, body: dict[str, str], code: str
) -> None:
    mock_github.get(f"{API}/repos/octo/hello/commits/nope").respond(status, json=body)
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.resolve_commit_sha("octo", "hello", "nope")
    assert exc_info.value.code == code


async def test_resolve_commit_network_error(mock_github: respx.MockRouter) -> None:
    mock_github.get(f"{API}/repos/octo/hello/commits/main").mock(
        side_effect=httpx.ReadTimeout("slow")
    )
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.resolve_commit_sha("octo", "hello", "main")
    assert exc_info.value.code == "github_unavailable"


async def test_download_tarball_follows_redirect(
    mock_github: respx.MockRouter, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "GITHUB_TOKEN", "github_pat_test")
    codeload = f"https://codeload.github.com/octo/hello/legacy.tar.gz/{SHA}"
    mock_github.get(f"{API}/repos/octo/hello/tarball/{SHA}").respond(
        302, headers={"Location": codeload}
    )
    final = mock_github.get(codeload).respond(200, content=b"tar-bytes")

    assert await gh.download_tarball("octo", "hello", SHA) == b"tar-bytes"
    # Token is not forwarded to codeload (cross-origin redirect).
    assert "Authorization" not in final.calls.last.request.headers


async def test_download_tarball_too_large_streamed(mock_github: respx.MockRouter) -> None:
    mock_github.get(f"{API}/repos/octo/hello/tarball/{SHA}").respond(200, content=b"x" * 2048)
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.download_tarball("octo", "hello", SHA, max_bytes=1024)
    assert exc_info.value.code == "repo_too_large"


async def test_download_tarball_too_large_declared(mock_github: respx.MockRouter) -> None:
    mock_github.get(f"{API}/repos/octo/hello/tarball/{SHA}").respond(
        200, headers={"Content-Length": str(gh.MAX_TARBALL_BYTES + 1)}, content=b"x"
    )
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.download_tarball("octo", "hello", SHA)
    assert exc_info.value.code == "repo_too_large"


@pytest.mark.parametrize(
    ("status", "headers", "code"),
    [
        (404, {}, "repo_not_found_or_private"),
        (403, {"x-ratelimit-remaining": "0"}, "github_rate_limited"),
        (503, {}, "github_unavailable"),
        (400, {}, "github_unavailable"),
    ],
)
async def test_download_tarball_errors(
    mock_github: respx.MockRouter, status: int, headers: dict[str, str], code: str
) -> None:
    mock_github.get(f"{API}/repos/octo/hello/tarball/{SHA}").respond(
        status, headers=headers, json={"message": "x"}
    )
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.download_tarball("octo", "hello", SHA)
    assert exc_info.value.code == code


async def test_download_tarball_network_error(mock_github: respx.MockRouter) -> None:
    mock_github.get(f"{API}/repos/octo/hello/tarball/{SHA}").mock(
        side_effect=httpx.ConnectError("down")
    )
    with pytest.raises(gh.GitHubError) as exc_info:
        await gh.download_tarball("octo", "hello", SHA)
    assert exc_info.value.code == "github_unavailable"
