"""Application exception hierarchy mapped to HTTP responses in ``app.main``."""


class AppError(Exception):
    """Base application error rendered as ``{"detail": message, "error_code": code}``."""

    status_code: int = 500
    error_code: str = "internal_error"
    message: str = "An unexpected error occurred."

    def __init__(
        self,
        message: str | None = None,
        error_code: str | None = None,
        status_code: int | None = None,
    ) -> None:
        """Create an error, optionally overriding the class defaults."""
        self.message = message if message is not None else self.message
        self.error_code = error_code if error_code is not None else self.error_code
        self.status_code = status_code if status_code is not None else self.status_code
        super().__init__(self.message)


class BadRequestError(AppError):
    """400 Bad Request."""

    status_code = 400
    error_code = "bad_request"
    message = "Bad request."


class UnauthorizedError(AppError):
    """401 Unauthorized."""

    status_code = 401
    error_code = "unauthorized"
    message = "Not authenticated."


class ForbiddenError(AppError):
    """403 Forbidden."""

    status_code = 403
    error_code = "forbidden"
    message = "You do not have permission to perform this action."


class NotFoundError(AppError):
    """404 Not Found."""

    status_code = 404
    error_code = "not_found"
    message = "Resource not found."


class ConflictError(AppError):
    """409 Conflict."""

    status_code = 409
    error_code = "conflict"
    message = "Resource already exists."


class RateLimitError(AppError):
    """429 Too Many Requests."""

    status_code = 429
    error_code = "rate_limited"
    message = "Too many requests. Please try again later."
