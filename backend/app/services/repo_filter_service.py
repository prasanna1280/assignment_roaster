"""Turn a GitHub tarball into a small, ranked, secret-masked snapshot for the AI.

Everything here is pure and in-memory: archives are never written to disk and
student code is never executed or imported. Only regular files are read; links,
devices, absolute paths and ``..`` traversal are rejected.
"""

import io
import logging
import re
import tarfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import PurePosixPath

from app.config import settings

logger = logging.getLogger(__name__)

MASK = "***MASKED***"
MAX_FILE_BYTES = 100 * 1024
BINARY_SNIFF_BYTES = 8 * 1024
MAX_MEMBERS = 20_000
MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
MAX_READ_BYTES = 32 * 1024 * 1024
MAX_TREE_LINES = 400

SKIP_DIRS = frozenset(
    {
        "node_modules",
        "venv",
        ".venv",
        "env",
        "dist",
        "build",
        "out",
        "target",
        ".git",
        "__pycache__",
        ".next",
        ".nuxt",
        ".idea",
        ".vscode",
        "coverage",
        "vendor",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
        ".gradle",
        "bower_components",
        ".turbo",
        ".cache",
    }
)

LOCK_FILES = frozenset(
    {
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "npm-shrinkwrap.json",
        "poetry.lock",
        "pipfile.lock",
        "cargo.lock",
        "composer.lock",
        "gemfile.lock",
        "go.sum",
        "bun.lockb",
        "uv.lock",
        "pubspec.lock",
        "packages.lock.json",
        ".ds_store",
        "thumbs.db",
    }
)

SKIP_EXTENSIONS = frozenset(
    {
        # images
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg", ".tif", ".tiff",
        ".psd", ".heic", ".avif",
        # fonts
        ".woff", ".woff2", ".ttf", ".otf", ".eot",
        # media
        ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm", ".ogg", ".flac", ".mkv", ".m4a",
        # archives / binaries
        ".zip", ".tar", ".gz", ".tgz", ".rar", ".7z", ".bz2", ".xz", ".jar", ".war", ".exe",
        ".dll", ".so", ".dylib", ".bin", ".class", ".o", ".a", ".obj", ".pyc", ".pyo", ".whl",
        ".egg", ".apk", ".ipa", ".dmg", ".iso", ".wasm",
        # documents / data blobs
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".sqlite", ".sqlite3",
        ".db", ".pkl", ".pickle", ".h5", ".npy", ".npz", ".parquet", ".onnx", ".pt", ".ckpt",
        # generated
        ".map", ".lock",
    }
)  # fmt: skip

LANGUAGE_BY_EXT = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".kt": "Kotlin",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".cc": "C++",
    ".hpp": "C++",
    ".cs": "C#",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".dart": "Dart",
    ".scala": "Scala",
    ".r": "R",
    ".m": "Objective-C",
    ".lua": "Lua",
    ".sh": "Shell",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".sql": "SQL",
    ".ipynb": "Jupyter Notebook",
}
CODE_EXTENSIONS = frozenset(LANGUAGE_BY_EXT)
_MARKUP_LANGUAGES = frozenset({"HTML", "CSS", "SCSS"})

ENTRY_POINT_STEMS = frozenset(
    {"main", "app", "index", "server", "manage", "program", "__main__", "wsgi", "asgi"}
)
_TEST_DIR_NAMES = frozenset({"test", "tests", "__tests__", "spec", "specs", "testing"})
_ENV_TEMPLATE_SUFFIXES = (".example", ".sample", ".template", ".dist", ".defaults")


class RepoFilterError(Exception):
    """A filtering failure with a stable ``code`` (``repo_empty``, ``repo_too_large``...)."""

    def __init__(self, code: str, message: str) -> None:
        """Create the error with a machine-readable code and a technical message."""
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


@dataclass(frozen=True)
class RepoFile:
    """One selected, masked text file."""

    path: str
    content: str


@dataclass
class RepoSnapshot:
    """What the AI gets to see of a repository."""

    files: list[RepoFile]
    tree: str
    files_analyzed: int
    total_files: int
    has_committed_secrets: bool
    primary_language: str | None
    skipped_dirs: list[str] = field(default_factory=list)


# --- Safe extraction ---------------------------------------------------------
def _safe_relative_path(name: str) -> str | None:
    """Validate a member name and strip the ``{owner}-{repo}-{sha}/`` prefix.

    Returns None for unsafe names (absolute, drive letters, ``..``) or for the
    top-level folder itself.
    """
    normalized = name.replace("\\", "/")
    if normalized.startswith("/") or re.match(r"^[A-Za-z]:", normalized):
        return None
    parts = [part for part in normalized.split("/") if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        return None
    relative = parts[1:]
    if not relative:
        return None
    return "/".join(relative)


def _skip_reason(path: str, size: int) -> str | None:
    """Return why a file should be skipped without reading it, or None to keep it."""
    pure = PurePosixPath(path)
    dirs = [part.lower() for part in pure.parts[:-1]]
    if any(part in SKIP_DIRS for part in dirs):
        return "skipped_dir"
    name = pure.name.lower()
    if name in LOCK_FILES:
        return "lock_file"
    if name.endswith((".min.js", ".min.css", ".min.mjs", "-min.js")):
        return "minified"
    if pure.suffix.lower() in SKIP_EXTENSIONS:
        return "binary_ext"
    if size > MAX_FILE_BYTES:
        return "too_large"
    if size == 0:
        return "empty"
    return None


def _collapsed_skip_dir(path: str) -> str | None:
    """Return the path prefix up to the first skipped directory, if any."""
    parts = PurePosixPath(path).parts[:-1]
    for index, part in enumerate(parts):
        if part.lower() in SKIP_DIRS:
            return "/".join(parts[: index + 1])
    return None


def extract_text_files(tar_bytes: bytes) -> tuple[dict[str, str], list[str], list[str]]:
    """Safely read candidate text files from a tarball held in memory.

    Returns:
        ``(files, all_paths, skipped_dirs)`` where ``files`` maps relative path to
        decoded text for files that passed the skip rules and binary sniff,
        ``all_paths`` lists every regular file path, and ``skipped_dirs`` holds the
        collapsed junk directories (e.g. ``node_modules``).

    Raises:
        RepoFilterError: ``repo_unreadable`` for a corrupt archive,
            ``repo_too_large`` when member/size guards trip.
    """
    files: dict[str, str] = {}
    all_paths: list[str] = []
    skipped_dirs: set[str] = set()
    read_bytes = 0

    try:
        archive = tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:*")  # noqa: SIM115
    except (tarfile.TarError, OSError, EOFError) as exc:
        raise RepoFilterError("repo_unreadable", f"cannot open tarball: {exc!r}") from exc

    with archive:
        try:
            for count, member in enumerate(archive, start=1):
                if count > MAX_MEMBERS:
                    raise RepoFilterError("repo_too_large", "too many archive members")
                if archive.offset > MAX_UNCOMPRESSED_BYTES:
                    raise RepoFilterError("repo_too_large", "archive expands too much")
                # Only regular files; symlinks, hardlinks, devices, fifos and dirs are ignored.
                if not member.isreg():
                    if member.issym() or member.islnk():
                        logger.debug("Ignoring link member %r", member.name)
                    continue
                path = _safe_relative_path(member.name)
                if path is None:
                    logger.warning("Rejected unsafe tar member path %r", member.name)
                    continue
                all_paths.append(path)

                collapsed = _collapsed_skip_dir(path)
                if collapsed is not None:
                    skipped_dirs.add(collapsed)
                if _skip_reason(path, member.size) is not None:
                    continue
                if read_bytes + member.size > MAX_READ_BYTES:
                    continue

                handle = archive.extractfile(member)
                if handle is None:
                    continue
                raw = handle.read(MAX_FILE_BYTES + 1)
                read_bytes += len(raw)
                if len(raw) > MAX_FILE_BYTES or b"\x00" in raw[:BINARY_SNIFF_BYTES]:
                    continue
                files[path] = raw.decode("utf-8", errors="replace")
        except (tarfile.TarError, OSError, EOFError) as exc:
            raise RepoFilterError("repo_unreadable", f"corrupt tarball: {exc!r}") from exc

    return files, all_paths, sorted(skipped_dirs)


# --- Secret masking ----------------------------------------------------------
_TOKEN_PATTERNS = [
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),  # AWS access key id
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b"),  # GitHub classic tokens
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b"),  # GitHub fine-grained tokens
    re.compile(r"\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_\-]{20,}"),  # OpenAI-style keys
    re.compile(r"\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b"),  # Stripe keys
    re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b"),  # Google API keys
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),  # Slack tokens
]
_PRIVATE_KEY_BLOCK = re.compile(
    r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----.*?"
    r"(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|\Z)",
    re.DOTALL,
)
_SENSITIVE_NAME_RE = (
    r"[A-Za-z0-9_.\-]*(?:secret|passw(?:or)?d|pwd|token|apikey|credentials?"
    r"|(?:secret|signing|encryption|master|client|auth|access|private|api)[_\-]?key)s?"
)
# NAME = "value" / NAME: 'value' / "NAME": "value" / NAME => "value"
_QUOTED_ASSIGNMENT = re.compile(
    rf"(?i)(\b{_SENSITIVE_NAME_RE}[\"']?\s*(?::|=|=>|:=)\s*)([\"'])([^\"'\n]+)\2"
)
# .env / shell / yaml style: NAME=value or NAME: value (unquoted, rest of token)
_UNQUOTED_VALUE = r"[^\s\"'#()\[\]{},;]+"
_UNQUOTED_ASSIGNMENT = re.compile(
    rf"(?im)^(\s*(?:export\s+)?{_SENSITIVE_NAME_RE}\s*(?:=|:)[ \t]*)({_UNQUOTED_VALUE})[ \t]*$"
)
_URL_CREDENTIALS = re.compile(r"(\b[a-zA-Z][a-zA-Z0-9+.\-]*://[^\s:/@\"']+:)([^\s@/\"']+)(@)")
_ENV_LINE = re.compile(r"^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_.\-]*\s*[=:]\s*)(.+)$")

_PLACEHOLDER_VALUES = frozenset(
    {
        "password",
        "pass",
        "passwd",
        "secret",
        "changeme",
        "change-me",
        "example",
        "placeholder",
        "dummy",
        "test",
        "testing",
        "user",
        "admin",
        "root",
        "postgres",
        "none",
        "null",
        "true",
        "false",
        "todo",
        "redacted",
        "string",
        "bearer",
        "basic",
        "required",
        "optional",
        MASK.lower(),
    }
)


def _is_placeholder(value: str) -> bool:
    """Return True for values that are obviously not real secrets."""
    stripped = value.strip()
    lowered = stripped.lower()
    if len(stripped) < 4 or lowered in _PLACEHOLDER_VALUES:
        return True
    if any(ch.isspace() for ch in stripped):
        return True  # labels / sentences, not credentials
    if set(stripped) <= {"*", "x", "X", ".", "-", "_", "#", "<", ">"}:
        return True
    if stripped.startswith(("${", "$(", "{{", "<", "%(", "process.env", "os.environ")):
        return True
    if lowered.startswith(("your", "my-", "my_", "xxx", "replace", "insert", "<", "example")):
        return True
    if re.match(r"^https?://", stripped) and "@" not in stripped:
        return True
    # Code references like settings.SECRET_KEY or getenv("X") are not values.
    if re.fullmatch(r"[A-Za-z_][\w.]*\(.*\)", stripped):
        return True
    return len(stripped) <= 60 and bool(re.fullmatch(r"[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+", stripped))


def _is_env_file(path: str) -> bool:
    """Return True for real dotenv files (``.env``, ``.env.local``...), not templates."""
    name = PurePosixPath(path).name.lower()
    if name != ".env" and not name.startswith(".env.") and not name.endswith(".env"):
        return False
    return not name.endswith(_ENV_TEMPLATE_SUFFIXES)


def _mask_env_file(text: str) -> tuple[str, bool]:
    """Mask every value in a dotenv file, keeping only the variable names."""
    found = False
    lines: list[str] = []
    for line in text.splitlines():
        match = _ENV_LINE.match(line)
        if match and not line.lstrip().startswith("#"):
            value = match.group(2).strip().strip("\"'")
            if value:
                found = True
            lines.append(f"{match.group(1)}{MASK}")
        else:
            lines.append(line)
    return "\n".join(lines), found


def mask_secrets(text: str, path: str = "") -> tuple[str, bool]:
    """Replace likely secrets with ``***MASKED***``.

    Args:
        text: File content.
        path: Repository-relative path (dotenv files are fully masked).

    Returns:
        ``(masked_text, found_any_secret)``.
    """
    found = False
    if path and _is_env_file(path):
        text, found = _mask_env_file(text)

    def _sub_token(match: re.Match[str]) -> str:
        nonlocal found
        found = True
        return MASK

    text = _PRIVATE_KEY_BLOCK.sub(_sub_token, text)
    for pattern in _TOKEN_PATTERNS:
        text = pattern.sub(_sub_token, text)

    def _sub_quoted(match: re.Match[str]) -> str:
        nonlocal found
        prefix, quote_char, value = match.group(1), match.group(2), match.group(3)
        if _is_placeholder(value):
            return match.group(0)
        found = True
        return f"{prefix}{quote_char}{MASK}{quote_char}"

    def _sub_unquoted(match: re.Match[str]) -> str:
        nonlocal found
        prefix, value = match.group(1), match.group(2)
        if _is_placeholder(value):
            return match.group(0)
        found = True
        return f"{prefix}{MASK}"

    def _sub_url(match: re.Match[str]) -> str:
        nonlocal found
        if _is_placeholder(match.group(2)):
            return match.group(0)
        found = True
        return f"{match.group(1)}{MASK}{match.group(3)}"

    text = _QUOTED_ASSIGNMENT.sub(_sub_quoted, text)
    # Unquoted values are only credible in config-style files; in source code the
    # right-hand side of `password = something` is usually a variable.
    suffix = PurePosixPath(path).suffix.lower()
    if not path or suffix not in CODE_EXTENSIONS or suffix == ".sh":
        text = _UNQUOTED_ASSIGNMENT.sub(_sub_unquoted, text)
    text = _URL_CREDENTIALS.sub(_sub_url, text)
    return text, found


# --- Ranking -----------------------------------------------------------------
def _is_test_path(path: str) -> bool:
    """Heuristically detect test files."""
    pure = PurePosixPath(path.lower())
    if any(part in _TEST_DIR_NAMES for part in pure.parts[:-1]):
        return True
    name = pure.name
    return (
        name.startswith("test_")
        or pure.stem.endswith(("_test", "_spec"))
        or ".test." in name
        or ".spec." in name
        or name.endswith("test.java")
    )


def rank_path(path: str) -> tuple[int, int, str]:
    """Sort key: README → entry points → source code → tests → config/other."""
    pure = PurePosixPath(path)
    name = pure.name.lower()
    depth = len(pure.parts)
    suffix = pure.suffix.lower()
    if name.startswith("readme"):
        tier = 0
    elif suffix in CODE_EXTENSIONS and _is_test_path(path):
        tier = 3
    elif pure.stem.lower() in ENTRY_POINT_STEMS and suffix in CODE_EXTENSIONS:
        tier = 1
    elif suffix in CODE_EXTENSIONS:
        tier = 2
    else:
        tier = 4
    return tier, depth, path.lower()


def guess_primary_language(files: dict[str, str]) -> str | None:
    """Guess the dominant language by bytes of code (markup only as a fallback)."""
    weights: Counter[str] = Counter()
    for path, content in files.items():
        language = LANGUAGE_BY_EXT.get(PurePosixPath(path).suffix.lower())
        if language:
            weights[language] += len(content)
    if not weights:
        return None
    programming = [(lang, w) for lang, w in weights.most_common() if lang not in _MARKUP_LANGUAGES]
    return programming[0][0] if programming else weights.most_common(1)[0][0]


def build_tree(all_paths: list[str], skipped_dirs: list[str], selected: set[str]) -> str:
    """Render a flat file tree; junk dirs are collapsed, selected files are starred."""
    lines: list[str] = []
    for path in sorted(all_paths, key=str.lower):
        if _collapsed_skip_dir(path) is not None:
            continue
        marker = "* " if path in selected else "  "
        lines.append(f"{marker}{path}")
    lines.extend(f"  {directory}/ (skipped)" for directory in skipped_dirs)
    if len(lines) > MAX_TREE_LINES:
        extra = len(lines) - MAX_TREE_LINES
        lines = [*lines[:MAX_TREE_LINES], f"  ... and {extra} more entries"]
    return "\n".join(lines)


def build_snapshot(
    tar_bytes: bytes, max_files: int | None = None, max_bytes: int | None = None
) -> RepoSnapshot:
    """Build the AI-facing snapshot of a repository tarball.

    Args:
        tar_bytes: The (gzipped) tarball downloaded from GitHub.
        max_files: Cap on selected files (default ``settings.ROAST_MAX_FILES``).
        max_bytes: Cap on total selected characters (default ``settings.ROAST_MAX_BYTES``).

    Raises:
        RepoFilterError: ``repo_empty`` if no reviewable file survives filtering.
    """
    file_cap = max_files if max_files is not None else settings.ROAST_MAX_FILES
    byte_cap = max_bytes if max_bytes is not None else settings.ROAST_MAX_BYTES

    candidates, all_paths, skipped_dirs = extract_text_files(tar_bytes)

    has_secrets = False
    masked: dict[str, str] = {}
    for path, content in candidates.items():
        masked_content, found = mask_secrets(content, path)
        masked[path] = masked_content
        has_secrets = has_secrets or found

    selected: list[RepoFile] = []
    used_bytes = 0
    for path in sorted(masked, key=rank_path):
        if len(selected) >= file_cap:
            break
        content = masked[path]
        size = len(content.encode("utf-8"))
        if used_bytes + size > byte_cap:
            continue
        selected.append(RepoFile(path=path, content=content))
        used_bytes += size

    if not selected:
        raise RepoFilterError(
            "repo_empty",
            f"no reviewable files (total={len(all_paths)}, candidates={len(candidates)})",
        )

    selected_paths = {repo_file.path for repo_file in selected}
    return RepoSnapshot(
        files=selected,
        tree=build_tree(all_paths, skipped_dirs, selected_paths),
        files_analyzed=len(selected),
        total_files=len(all_paths),
        has_committed_secrets=has_secrets,
        primary_language=guess_primary_language(candidates),
        skipped_dirs=skipped_dirs,
    )
