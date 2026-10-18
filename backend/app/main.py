"""FastAPI application entry point."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.exceptions import AppError
from app.log_redaction import install_access_log_redaction
from app.rate_limit import limiter

logging.basicConfig(
    level=logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
# The OAuth callback's ?code=&state= would otherwise be written to the access log.
install_access_log_redaction()
logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

# --- Rate limiting -------------------------------------------------------
app.state.limiter = limiter


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Render slowapi 429s in the same ``{"detail", "error_code"}`` shape as AppError."""
    logger.info("Rate limit hit (%s) on %s %s", exc.detail, request.method, request.url.path)
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please wait a moment and try again.",
            "error_code": "rate_limited",
        },
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)  # type: ignore[arg-type]
app.add_middleware(SlowAPIMiddleware)

# --- CORS ----------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Exception handlers --------------------------------------------------
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Render AppError subclasses as ``{"detail": ..., "error_code": ...}``."""
    logger.info(
        "AppError %s (%s) on %s %s",
        exc.error_code,
        exc.status_code,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "error_code": exc.error_code},
    )


# --- Routes --------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "healthy"}


# --- Routers -------------------------------------------------------------
# Phase 2: include routers here, e.g.
#   from app.routers import admin, auth, roasts, users
#   app.include_router(auth.router, prefix=API_PREFIX)

from app.routers import auth as auth_router  # noqa: E402

app.include_router(auth_router.router, prefix=API_PREFIX)

from app.routers import submissions as submissions_router  # noqa: E402

app.include_router(submissions_router.router, prefix=API_PREFIX)

from app.routers import admin as admin_router  # noqa: E402

app.include_router(admin_router.router, prefix=API_PREFIX)
