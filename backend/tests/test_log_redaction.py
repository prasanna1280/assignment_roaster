"""Tests for masking secrets in uvicorn access-log lines."""

import logging

import pytest

import app.main  # noqa: F401  (installs the filter at import time)
from app.log_redaction import RedactQueryFilter, redact_url

CALLBACK = (
    "/api/v1/auth/google/callback?state=abcDEF123&iss=https%3A%2F%2Faccounts.google.com"
    "&code=4%2F0AXlqoi44L3I_secret&scope=email+profile+openid&authuser=0"
)


def test_callback_code_and_state_are_masked() -> None:
    redacted = redact_url(CALLBACK)
    assert redacted.startswith("/api/v1/auth/google/callback?")
    assert "abcDEF123" not in redacted
    assert "4%2F0AXlqoi44L3I_secret" not in redacted
    assert "0AXlqoi44L3I_secret" not in redacted
    assert "state=***" in redacted
    assert "code=***" in redacted
    # Non-sensitive params stay readable for debugging.
    assert "authuser=0" in redacted
    assert "iss=https%3A%2F%2Faccounts.google.com" in redacted


@pytest.mark.parametrize(
    "url",
    ["/health", "/api/v1/submissions?page=2&size=10", "/api/v1/admin/users?search=kavya"],
)
def test_urls_without_secrets_are_unchanged(url: str) -> None:
    assert redact_url(url) == url


@pytest.mark.parametrize("key", ["access_token", "Refresh_Token", "password", "client_secret"])
def test_other_sensitive_params_are_masked(key: str) -> None:
    assert redact_url(f"/x?{key}=s3cr3t&page=1") == f"/x?{key}=***&page=1"


def test_filter_rewrites_uvicorn_access_record() -> None:
    record = logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg='%s - "%s %s HTTP/%s" %d',
        args=("172.18.0.1:40346", "GET", CALLBACK, "1.1", 302),
        exc_info=None,
    )
    assert RedactQueryFilter().filter(record) is True
    message = record.getMessage()
    assert "4%2F0AXlqoi44L3I_secret" not in message
    assert "abcDEF123" not in message
    assert message.startswith('172.18.0.1:40346 - "GET /api/v1/auth/google/callback?')
    assert message.endswith('HTTP/1.1" 302')


def test_filter_ignores_records_with_other_args() -> None:
    record = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, "plain", None, None)
    assert RedactQueryFilter().filter(record) is True
    assert record.getMessage() == "plain"


def test_filter_is_installed_on_uvicorn_access_logger() -> None:
    filters = logging.getLogger("uvicorn.access").filters
    assert sum(isinstance(f, RedactQueryFilter) for f in filters) == 1
