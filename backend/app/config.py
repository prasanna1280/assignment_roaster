"""Application settings loaded from environment variables and .env files."""

import json
from functools import lru_cache
from typing import Annotated, Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application configuration.

    Values are read from the process environment first, then from ``../.env``
    (repo root when running from ``backend/``) and ``.env``. Secret values are
    plain strings and must never be logged.
    """

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    APP_NAME: str = "Assignment Roaster"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    GITHUB_TOKEN: str = ""

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    # Reasoning models only (e.g. gpt-5.x). Empty = don't send the parameter, which
    # older models such as gpt-4o reject.
    OPENAI_REASONING_EFFORT: Literal["", "minimal", "low", "medium", "high"] = ""

    ROAST_DAILY_LIMIT: int = 5
    ROAST_MAX_FILES: int = 150
    ROAST_MAX_BYTES: int = 200000

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: Any) -> Any:
        """Accept a JSON list or a comma-separated string for CORS_ORIGINS."""
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return value

    @field_validator("OPENAI_REASONING_EFFORT", mode="before")
    @classmethod
    def _normalize_reasoning_effort(cls, value: Any) -> Any:
        """Accept any case and surrounding whitespace, e.g. " Low "."""
        return value.strip().lower() if isinstance(value, str) else value

    @property
    def is_production(self) -> bool:
        """Return True when running in the production environment."""
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
