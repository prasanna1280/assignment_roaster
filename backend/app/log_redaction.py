"""Mask secrets in request URLs before they reach the access log.

Uvicorn logs every request as ``"METHOD /path?query HTTP/x"``. The Google OAuth
callback carries a one-time ``code`` and the CSRF ``state`` in its query string,
so the values of sensitive query parameters are replaced with ``***``.
"""

import logging
from urllib.parse import parse_qsl, urlencode

SENSITIVE_QUERY_PARAMS = frozenset(
    {
        "code",
        "state",
        "token",
        "access_token",
        "refresh_token",
        "id_token",
        "password",
        "client_secret",
    }
)
REDACTED = "***"


def redact_url(path_with_query: str) -> str:
    """Return the path with sensitive query parameter values replaced by ``***``."""
    path, sep, query = path_with_query.partition("?")
    if not sep:
        return path_with_query
    pairs = parse_qsl(query, keep_blank_values=True)
    if not any(key.lower() in SENSITIVE_QUERY_PARAMS for key, _ in pairs):
        return path_with_query
    redacted = [
        (key, REDACTED if key.lower() in SENSITIVE_QUERY_PARAMS else value) for key, value in pairs
    ]
    return f"{path}?{urlencode(redacted, safe='*')}"


class RedactQueryFilter(logging.Filter):
    """Redact the request path in uvicorn access records.

    Uvicorn's access record ``args`` are ``(client, method, path_with_query, http_version,
    status_code)``; only the path element is rewritten.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        """Rewrite the path argument in place; never drops the record."""
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str):
            record.args = (*args[:2], redact_url(args[2]), *args[3:])
        return True


def install_access_log_redaction() -> None:
    """Attach the redaction filter to uvicorn's access logger (idempotent)."""
    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, RedactQueryFilter) for f in access_logger.filters):
        access_logger.addFilter(RedactQueryFilter())
