"""GitHub REST API client for public repositories (metadata, commit resolution, tarball).

Only public repositories are supported. ``GITHUB_TOKEN`` (if set) is sent as a
Bearer token purely to raise the rate limit; it is never logged or returned.
httpx drops the ``Authorization`` header automatically when the tarball request
is redirected to ``codeload.github.com`` (a different origin).
"""

import logging
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
MAX_TARBALL_BYTES = 25 * 1024 * 1024
_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
_TARBALL_TIMEOUT = httpx.Timeout(120.0, connect=10.0)


class GitHubError(Exception):
    """A GitHub failure with a stable ``code`` (stored as ``Submission.error_code``)."""

    def __init__(self, code: str, message: str) -> None:
        """Create the error with a machine-readable code and a technical message."""
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


@dataclass(frozen=True)
class RepoMetadata:
    """Subset of ``GET /repos/{owner}/{repo}`` used by the pipeline."""

    owner: str
    name: str
    default_branch: str
    private: bool
    language: str | None
    size_kb: int


def _headers() -> dict[str, str]:
    """Build request headers, including the optional Bearer token."""
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "assignment-roaster",
    }
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    return headers


def _client(timeout: httpx.Timeout = _TIMEOUT) -> httpx.AsyncClient:
    """Create an AsyncClient pointed at the GitHub API."""
    return httpx.AsyncClient(
        base_url=GITHUB_API_BASE,
        headers=_headers(),
        timeout=timeout,
        follow_redirects=True,
    )


def _is_rate_limited(response: httpx.Response) -> bool:
    """Return True if a 403/429 response is a (primary or secondary) rate limit."""
    if response.status_code == 429:
        return True
    if response.status_code != 403:
        return False
    if response.headers.get("x-ratelimit-remaining") == "0":
        return True
    if "retry-after" in response.headers:
        return True
    return "rate limit" in response.text.lower()


def _raise_for_common(response: httpx.Response, context: str) -> None:
    """Map rate-limit and server errors to GitHubError."""
    if _is_rate_limited(response):
        logger.warning(
            "GitHub rate limit hit during %s (status=%s, reset=%s)",
            context,
            response.status_code,
            response.headers.get("x-ratelimit-reset"),
        )
        raise GitHubError("github_rate_limited", f"GitHub rate limit hit during {context}")
    if response.status_code >= 500:
        raise GitHubError(
            "github_unavailable", f"GitHub returned {response.status_code} during {context}"
        )


def _repo_path(owner: str, repo: str) -> str:
    """Return the URL-quoted ``/repos/{owner}/{repo}`` path."""
    return f"/repos/{quote(owner, safe='')}/{quote(repo, safe='')}"


async def get_repo_metadata(owner: str, repo: str) -> RepoMetadata:
    """Fetch public repository metadata.

    Raises:
        GitHubError: ``repo_not_found_or_private`` (404, 403 non-rate-limit, or
            ``private: true``), ``github_rate_limited`` or ``github_unavailable``.
    """
    try:
        async with _client() as client:
            response = await client.get(_repo_path(owner, repo))
    except httpx.HTTPError as exc:
        raise GitHubError("github_unavailable", f"metadata request failed: {exc!r}") from exc

    _raise_for_common(response, "metadata")
    if response.status_code in (401, 403, 404, 451):
        raise GitHubError(
            "repo_not_found_or_private",
            f"GitHub returned {response.status_code} for {owner}/{repo}",
        )
    if response.status_code != 200:
        raise GitHubError(
            "github_unavailable", f"unexpected metadata status {response.status_code}"
        )

    data = response.json()
    if data.get("private", False):
        raise GitHubError("repo_not_found_or_private", f"{owner}/{repo} is private")
    return RepoMetadata(
        owner=str(data.get("owner", {}).get("login") or owner),
        name=str(data.get("name") or repo),
        default_branch=str(data.get("default_branch") or "main"),
        private=False,
        language=data.get("language"),
        size_kb=int(data.get("size") or 0),
    )


async def resolve_commit_sha(owner: str, repo: str, ref: str) -> str:
    """Resolve a branch/tag/sha to a full commit SHA.

    Raises:
        GitHubError: ``branch_not_found`` (404/422), ``github_rate_limited`` or
            ``github_unavailable``.
    """
    path = f"{_repo_path(owner, repo)}/commits/{quote(ref, safe='/')}"
    try:
        async with _client() as client:
            response = await client.get(path)
    except httpx.HTTPError as exc:
        raise GitHubError("github_unavailable", f"commit request failed: {exc!r}") from exc

    _raise_for_common(response, "commit resolution")
    if response.status_code in (404, 409, 422):
        # 409 = empty repository (no commits yet).
        if response.status_code == 409:
            raise GitHubError("repo_empty", f"{owner}/{repo} has no commits")
        raise GitHubError("branch_not_found", f"ref {ref!r} not found in {owner}/{repo}")
    if response.status_code != 200:
        raise GitHubError("github_unavailable", f"unexpected commit status {response.status_code}")

    sha = response.json().get("sha")
    if not isinstance(sha, str) or not sha:
        raise GitHubError("github_unavailable", "commit response had no sha")
    return sha


async def download_tarball(
    owner: str, repo: str, ref: str, max_bytes: int = MAX_TARBALL_BYTES
) -> bytes:
    """Download the repository tarball at ``ref`` into memory with a hard size cap.

    Raises:
        GitHubError: ``repo_too_large`` when the archive exceeds ``max_bytes``,
            ``repo_not_found_or_private``, ``github_rate_limited`` or ``github_unavailable``.
    """
    path = f"{_repo_path(owner, repo)}/tarball/{quote(ref, safe='/')}"
    try:
        async with (
            _client(_TARBALL_TIMEOUT) as client,
            client.stream("GET", path) as response,
        ):
            if response.status_code != 200:
                await response.aread()
                _raise_for_common(response, "tarball download")
                if response.status_code in (401, 403, 404, 451):
                    raise GitHubError(
                        "repo_not_found_or_private",
                        f"tarball returned {response.status_code} for {owner}/{repo}",
                    )
                raise GitHubError(
                    "github_unavailable", f"unexpected tarball status {response.status_code}"
                )

            declared = response.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > max_bytes:
                raise GitHubError("repo_too_large", f"tarball declared {declared} bytes")

            buffer = bytearray()
            async for chunk in response.aiter_bytes():
                buffer.extend(chunk)
                if len(buffer) > max_bytes:
                    raise GitHubError("repo_too_large", f"tarball exceeded {max_bytes} bytes")
            return bytes(buffer)
    except httpx.HTTPError as exc:
        raise GitHubError("github_unavailable", f"tarball download failed: {exc!r}") from exc
