"""Roast schemas: the validated AI contract (``RoastResult``) and API responses.

Two families of models live here:

* ``RoastResult`` / ``CategoryScores`` / ``Improvement`` carry the PRP constraints
  (scores 0-10, at least 1 strength, 3-15 improvements, headline <= 300 chars).
  Every AI response is re-validated against these.
* ``LLMRoastResult`` and friends are the *LLM-facing* mirror without numeric or
  length constraints. OpenAI strict Structured Outputs reject (or ignore) those
  keywords, so the JSON schema sent to the model is generated from these.
"""

import re
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator

Severity = Literal["low", "medium", "high"]


def _as_utc_iso(value: datetime) -> str:
    """Serialize datetimes as ISO-8601 with an explicit UTC offset (SQLite drops tzinfo)."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


UTCDateTime = Annotated[datetime, PlainSerializer(_as_utc_iso, return_type=str)]

Score = Annotated[float, Field(ge=0, le=10)]


# --- Validated contract ------------------------------------------------------
class CategoryScores(BaseModel):
    """Per-category scores, each between 0.0 and 10.0."""

    code_quality: Score
    structure: Score
    readability: Score
    documentation: Score
    testing: Score
    best_practices: Score


class Improvement(BaseModel):
    """A concrete, file-referenced fix suggested by the roast."""

    file: str = Field(min_length=1, max_length=500)
    line_hint: str | None = None
    issue: str = Field(min_length=1)
    suggestion: str = Field(min_length=1)
    severity: Severity


_PLACEHOLDER_FILES = frozenset(
    {"", "-", "n/a", "na", "none", "project", "repo", "repository", "general", "various",
     "multiple", "all", "all files", "entire project", "whole project", "codebase"}
)


_TAMIL_SCRIPT = re.compile(r"[஀-௿]")


def contains_tamil_script(text: str) -> bool:
    """True if ``text`` contains characters from the Tamil Unicode block."""
    return bool(_TAMIL_SCRIPT.search(text))


def is_placeholder_file(path: str) -> bool:
    """True for non-path file references like ``(project)``, ``N/A`` or ``various``."""
    value = path.strip()
    if value.startswith("(") and value.endswith(")"):
        return True
    return value.lower() in _PLACEHOLDER_FILES


class RoastResult(BaseModel):
    """The full, validated roast returned by the AI."""

    overall_score: Score
    category_scores: CategoryScores
    headline: str = Field(min_length=1, max_length=300)
    roast_text: str = Field(min_length=1)
    strengths: list[str] = Field(min_length=1)
    improvements: list[Improvement] = Field(min_length=3, max_length=15)

    # Checked here rather than on ``Improvement`` so roasts already stored with a
    # placeholder still load through ``RoastResponse``.
    @field_validator("improvements", mode="after")
    @classmethod
    def _require_real_file_paths(cls, value: list[Improvement]) -> list[Improvement]:
        bad = [item.file for item in value if is_placeholder_file(item.file)]
        if bad:
            raise ValueError(
                f"file must be a real path from the repo (or a new file to create), "
                f"not a placeholder like {bad[0]!r}"
            )
        return value


# --- LLM-facing schema (no numeric/length constraints) -----------------------
class LLMCategoryScores(BaseModel):
    """Category scores as sent to the model (0-10 enforced after parsing)."""

    code_quality: float
    structure: float
    readability: float
    documentation: float
    testing: float
    best_practices: float


class LLMImprovement(BaseModel):
    """Improvement item as sent to the model."""

    file: str
    line_hint: str | None
    issue: str
    suggestion: str
    severity: Severity


class LLMRoastResult(BaseModel):
    """Structured Outputs response format; validated into ``RoastResult`` afterwards."""

    overall_score: float
    category_scores: LLMCategoryScores
    headline: str
    roast_text: str
    strengths: list[str]
    improvements: list[LLMImprovement]


# --- API responses -----------------------------------------------------------
class RoastResponse(BaseModel):
    """A stored roast as returned by the API (token counts intentionally omitted)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    overall_score: float
    category_scores: CategoryScores
    headline: str
    roast_text: str
    strengths: list[str]
    improvements: list[Improvement]
    model_used: str
    created_at: UTCDateTime
