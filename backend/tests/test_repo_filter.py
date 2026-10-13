"""Tests for safe tar extraction, junk filtering, ranking, caps and secret masking."""

import io
import tarfile

import pytest

from app.services import repo_filter_service as rfs
from tests.roaster_helpers import TOP, make_tarball, normal_repo_files


def _paths(snapshot: rfs.RepoSnapshot) -> list[str]:
    return [f.path for f in snapshot.files]


def test_normal_repo_ranked_and_binary_skipped() -> None:
    snapshot = rfs.build_snapshot(make_tarball(normal_repo_files()))

    paths = _paths(snapshot)
    assert paths[0] == "README.md"
    assert paths[1] == "main.py"
    assert paths.index("app/core.py") < paths.index("tests/test_core.py")
    assert paths.index("tests/test_core.py") < paths.index("pyproject.toml")
    assert "logo.png" not in paths
    assert snapshot.files_analyzed == 5
    assert snapshot.total_files == 6
    assert snapshot.primary_language == "Python"
    assert snapshot.has_committed_secrets is False
    assert "* README.md" in snapshot.tree
    assert "  logo.png" in snapshot.tree
    # Top-level "{owner}-{repo}-{sha}/" folder is stripped.
    assert all(not p.startswith(TOP) for p in paths)


def test_node_modules_heavy_repo_is_filtered() -> None:
    files: dict[str, str | bytes] = {
        "index.js": "console.log('hi')\n",
        "package.json": '{"name": "x"}',
        "package-lock.json": "{}",
        "dist/bundle.min.js": "var a=1;",
        "static/app.js.map": "{}",
        "venv/lib/site.py": "x = 1",
        "src/__pycache__/x.py": "x = 1",
    }
    for i in range(200):
        files[f"node_modules/lib{i}/index.js"] = "module.exports = 1;\n"
    snapshot = rfs.build_snapshot(make_tarball(files))

    assert _paths(snapshot) == ["index.js", "package.json"]
    assert "node_modules/ (skipped)" in snapshot.tree
    assert "node_modules/lib1/index.js" not in snapshot.tree
    assert "node_modules" in snapshot.skipped_dirs
    assert snapshot.primary_language == "JavaScript"


def test_huge_and_binary_files_skipped() -> None:
    files: dict[str, str | bytes] = {
        "main.py": "print('ok')\n",
        "big.py": "x = 1\n" * 30_000,  # > 100 KB
        "data.txt": b"abc\x00def",  # null byte -> binary
    }
    snapshot = rfs.build_snapshot(make_tarball(files))
    assert _paths(snapshot) == ["main.py"]


def test_caps_on_files_and_bytes() -> None:
    files: dict[str, str | bytes] = {f"src/mod{i}.py": "x = 1\n" * 10 for i in range(20)}
    snapshot = rfs.build_snapshot(make_tarball(files), max_files=5)
    assert snapshot.files_analyzed == 5
    assert snapshot.total_files == 20

    snapshot = rfs.build_snapshot(make_tarball(files), max_bytes=130)
    assert snapshot.files_analyzed == 2  # 60 bytes each


def test_path_traversal_absolute_and_links_rejected() -> None:
    def info(name: str, kind: bytes = tarfile.REGTYPE, link: str = "") -> tarfile.TarInfo:
        member = tarfile.TarInfo(name)
        member.type = kind
        member.linkname = link
        return member

    raw = [
        (info(f"{TOP}/../evil.py"), b"evil = 1"),
        (info("../../etc/passwd.py"), b"root = 1"),
        (info("/abs/path.py"), b"abs = 1"),
        (info(f"{TOP}/link.py", tarfile.SYMTYPE, "/etc/passwd"), None),
        (info(f"{TOP}/hard.py", tarfile.LNKTYPE, f"{TOP}/main.py"), None),
        (info(f"{TOP}/dev", tarfile.CHRTYPE), None),
        (info(f"{TOP}/fifo", tarfile.FIFOTYPE), None),
    ]
    tar_bytes = make_tarball({"main.py": "x = 1\n"}, raw_members=raw)
    snapshot = rfs.build_snapshot(tar_bytes)

    assert _paths(snapshot) == ["main.py"]
    assert "evil" not in snapshot.tree
    assert "passwd" not in snapshot.tree
    assert "link.py" not in snapshot.tree


def test_safe_relative_path() -> None:
    assert rfs._safe_relative_path("top/a/b.py") == "a/b.py"
    assert rfs._safe_relative_path("top") is None
    assert rfs._safe_relative_path("top/../x") is None
    assert rfs._safe_relative_path("/top/x") is None
    assert rfs._safe_relative_path("C:/top/x") is None
    assert rfs._safe_relative_path("top\\..\\x") is None


def test_empty_repo_raises_repo_empty() -> None:
    tar_bytes = make_tarball({"logo.png": b"\x89PNG", "node_modules/a.js": "x"})
    with pytest.raises(rfs.RepoFilterError) as exc_info:
        rfs.build_snapshot(tar_bytes)
    assert exc_info.value.code == "repo_empty"


def test_corrupt_tarball_raises_repo_unreadable() -> None:
    with pytest.raises(rfs.RepoFilterError) as exc_info:
        rfs.build_snapshot(b"this is not a tarball")
    assert exc_info.value.code == "repo_unreadable"


def test_too_many_members(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rfs, "MAX_MEMBERS", 3)
    tar_bytes = make_tarball({f"f{i}.py": "x = 1" for i in range(5)})
    with pytest.raises(rfs.RepoFilterError) as exc_info:
        rfs.build_snapshot(tar_bytes)
    assert exc_info.value.code == "repo_too_large"


def test_uncompressed_bomb_guard(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rfs, "MAX_UNCOMPRESSED_BYTES", 1024)
    tar_bytes = make_tarball({f"f{i}.py": "x = 1\n" * 100 for i in range(5)})
    with pytest.raises(rfs.RepoFilterError) as exc_info:
        rfs.build_snapshot(tar_bytes)
    assert exc_info.value.code == "repo_too_large"


def test_uncompressed_plain_tar_supported() -> None:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        data = b"x = 1\n"
        member = tarfile.TarInfo(f"{TOP}/a.py")
        member.size = len(data)
        archive.addfile(member, io.BytesIO(data))
    assert _paths(rfs.build_snapshot(buffer.getvalue())) == ["a.py"]


# --- Secret masking ------------------------------------------------------------
SECRET_SAMPLES = {
    "aws": "aws_id = AKIAABCDEFGHIJKLMNOP\n",
    "github": "tok = ghp_" + "a" * 36 + "\n",
    "github_pat": "tok = github_pat_" + "B" * 40 + "\n",
    "openai": "client = OpenAI(api_key=sk-proj-" + "c" * 40 + ")\n",
    "google": "key = AIza" + "d" * 35 + "\n",
    "assignment": 'SECRET_KEY = "super-s3cret-value"\n',
    "json": '{"db_password": "hunter2hunter2"}\n',
}


@pytest.mark.parametrize("name", list(SECRET_SAMPLES))
def test_mask_secrets_patterns(name: str) -> None:
    text = SECRET_SAMPLES[name]
    masked, found = rfs.mask_secrets(text, "config.txt")
    assert found is True
    assert rfs.MASK in masked
    for secret in ("AKIAABCDEF", "ghp_aaaa", "github_pat_BBB", "sk-proj-ccc", "AIzaddd"):
        assert secret not in masked
    assert "super-s3cret-value" not in masked
    assert "hunter2hunter2" not in masked


def test_mask_private_key_block() -> None:
    text = (
        "key = '''\n-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nabc\n"
        "-----END RSA PRIVATE KEY-----\n'''\nother = 1\n"
    )
    masked, found = rfs.mask_secrets(text, "keys.py")
    assert found
    assert "MIIEow" not in masked
    assert "other = 1" in masked


def test_mask_unterminated_private_key() -> None:
    masked, found = rfs.mask_secrets("-----BEGIN PRIVATE KEY-----\nMIIEow\n", "k.pem")
    assert found and "MIIEow" not in masked


def test_dotenv_fully_masked() -> None:
    text = "# comment\nDATABASE_URL=postgres://u:realpass123@db/x\nDEBUG=true\nEMPTY=\n"
    masked, found = rfs.mask_secrets(text, ".env")
    assert found
    assert "realpass123" not in masked
    assert "DEBUG=***MASKED***" in masked
    assert "# comment" in masked


def test_dotenv_example_not_flagged_for_placeholders() -> None:
    text = "SECRET_KEY=your-secret-key\nDB_PASSWORD=changeme\nAPI_KEY=\n"
    masked, found = rfs.mask_secrets(text, ".env.example")
    assert found is False
    assert masked == text


def test_unquoted_yaml_secret_masked_but_code_variables_not() -> None:
    masked, found = rfs.mask_secrets("db:\n  password: s3cr3tP4ss\n", "docker-compose.yml")
    assert found and "s3cr3tP4ss" not in masked

    code = (
        "password = form_password\n"
        "SECRET_KEY = os.getenv('SECRET_KEY')\n"
        "token = settings.API_TOKEN\n"
        "label_password = 'Enter your password'\n"
        "tokenizer = 'bert-base'\n"
        "TOKEN_URL = 'https://oauth2.googleapis.com/token'\n"
    )
    masked, found = rfs.mask_secrets(code, "app.py")
    assert found is False
    assert masked == code


def test_url_credentials_masked() -> None:
    masked, found = rfs.mask_secrets("url = 'mysql://admin:Sup3rS3cret@host/db'", "x.txt")
    assert found and "Sup3rS3cret" not in masked
    # Placeholder credentials (postgres:postgres) are not flagged.
    _, found = rfs.mask_secrets("URL=postgresql://postgres:postgres@db:5432/x", "c.txt")
    assert found is False


def test_committed_secrets_repo_snapshot() -> None:
    files: dict[str, str | bytes] = {
        "main.py": 'OPENAI_KEY = "sk-' + "z" * 40 + '"\nprint("hi")\n',
        ".env": "AWS_SECRET_ACCESS_KEY=abcdEFGH1234abcdEFGH1234\n",
    }
    snapshot = rfs.build_snapshot(make_tarball(files))
    assert snapshot.has_committed_secrets is True
    joined = "\n".join(f.content for f in snapshot.files)
    assert "z" * 40 not in joined
    assert "abcdEFGH1234" not in joined
    assert rfs.MASK in joined


def test_rank_and_language_helpers() -> None:
    assert rfs.rank_path("README.md")[0] == 0
    assert rfs.rank_path("src/index.ts")[0] == 1
    assert rfs.rank_path("src/utils.ts")[0] == 2
    assert rfs.rank_path("src/utils.test.ts")[0] == 3
    assert rfs.rank_path("Dockerfile")[0] == 4
    assert rfs.guess_primary_language({"a.html": "x" * 100, "b.js": "y"}) == "JavaScript"
    assert rfs.guess_primary_language({"a.html": "x"}) == "HTML"
    assert rfs.guess_primary_language({"a.txt": "x"}) is None


def test_tree_truncated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rfs, "MAX_TREE_LINES", 3)
    tree = rfs.build_tree([f"f{i}.py" for i in range(10)], [], set())
    assert tree.endswith("... and 7 more entries")
