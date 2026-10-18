"""Submission business logic and the background roast pipeline.

Daily limit accounting (``ROAST_DAILY_LIMIT``, window = since 00:00 UTC):
    used = rows in the append-only ``roast_attempts`` ledger created today. One row is
    written per roast started (new submission or re-roast), whether it later succeeds or
    fails. Deleting a submission keeps its ledger rows, so it never refunds quota.
"""

import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

import anyio
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import SessionLocal
from app.exceptions import BadRequestError, ConflictError, NotFoundError, RateLimitError
from app.models.roast import Roast
from app.models.roast_attempt import RoastAttempt
from app.models.submission import RoastLanguage, Submission, SubmissionStatus
from app.models.user import User
from app.schemas.submission import QuotaResponse, ReroastRequest, SubmissionCreate
from app.services import github_service, repo_filter_service, roast_service
from app.services.github_service import GitHubError
from app.services.repo_filter_service import RepoFilterError
from app.services.roast_service import RoastGenerationError

logger = logging.getLogger(__name__)

REPO_URL_RE = re.compile(
    r"^https://github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})(?:\.git)?"
    r"(?:/tree/([^\s?#]+))?/?$"
)
_BRANCH_RE = re.compile(r"^[A-Za-z0-9._/\-]{1,255}$")

TERMINAL_STATUSES = frozenset({SubmissionStatus.completed, SubmissionStatus.failed})

_TANGLISH_ERRORS: dict[str, str] = {
    "repo_not_found_or_private": (
        "Repo private ah illa URL thappa? Public repo link kudu machaan! "
        "(Settings → Change visibility → Public)"
    ),
    "branch_not_found": (
        "Andha branch-ae illa machaan! Branch name check pannitu thirumba try pannu."
    ),
    "github_rate_limited": (
        "GitHub konjam busy ah irukku (rate limit). Oru 10-15 nimisham kazhichu try pannu!"
    ),
    "github_unavailable": "GitHub pakkam konjam problem. Konjam neram kazhichu try pannu machaan.",
    "repo_too_large": (
        "Repo romba perusu machaan! 25 MB ku mela irukku. Build files, datasets, "
        "node_modules ellam remove panni try pannu."
    ),
    "repo_empty": ("Repo la review panna code-ae illa da! Source files push pannitu thirumba vaa."),
    "repo_unreadable": "Repo archive ah padikka mudiyala. Konjam kazhichu thirumba try pannu.",
    "ai_invalid_output": (
        "Namma AI roaster ku konjam confusion aayiduchu. Re-roast click pannu, adutha try la "
        "sariya varum!"
    ),
    "ai_unavailable": (
        "Roast machine ippo konjam overheat aayiduchu. Konjam neram kazhichu re-roast pannu!"
    ),
    "internal_error": "Edho thappa poiduchu machaan. Konjam kazhichu re-roast pannu.",
}

_ENGLISH_ERRORS: dict[str, str] = {
    "repo_not_found_or_private": (
        "We couldn't find that repo. It may be private or the URL may be wrong. Make it public "
        "(Settings → Change visibility → Public) or check the link."
    ),
    "branch_not_found": "That branch doesn't exist. Check the branch name and try again.",
    "github_rate_limited": (
        "GitHub is rate limiting us right now. Please try again in 10-15 minutes."
    ),
    "github_unavailable": "GitHub is having trouble right now. Please try again shortly.",
    "repo_too_large": (
        "This repo is over 25 MB. Remove build output, datasets or node_modules and try again."
    ),
    "repo_empty": "There's no source code to review yet. Push your files and try again.",
    "repo_unreadable": "We couldn't read the repo archive. Please try again shortly.",
    "ai_invalid_output": (
        "The AI reviewer returned an unusable answer. Click Re-roast and it should work next time."
    ),
    "ai_unavailable": "The AI reviewer is busy right now. Please re-roast in a few minutes.",
    "internal_error": "Something went wrong on our side. Please re-roast in a moment.",
}

_TAMIL_ERRORS: dict[str, str] = {
    "repo_not_found_or_private": (
        "இந்த repo கிடைக்கவில்லை. Repo private ஆக இருக்கலாம் அல்லது URL தவறாக இருக்கலாம். "
        "Repo-வை public ஆக்குங்கள் (Settings → Change visibility → Public) அல்லது link-ஐ "
        "சரிபாருங்கள்."
    ),
    "branch_not_found": "அந்த branch இல்லை. Branch பெயரை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
    "github_rate_limited": (
        "GitHub இப்போது rate limit செய்கிறது. 10-15 நிமிடங்கள் கழித்து முயற்சிக்கவும்."
    ),
    "github_unavailable": "GitHub-ல் இப்போது சிக்கல் உள்ளது. சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
    "repo_too_large": (
        "இந்த repo 25 MB-க்கு மேல் உள்ளது. Build files, datasets, node_modules ஆகியவற்றை "
        "நீக்கிவிட்டு முயற்சிக்கவும்."
    ),
    "repo_empty": "Review செய்ய code இல்லை. Source files-ஐ push செய்துவிட்டு மீண்டும் வாருங்கள்.",
    "repo_unreadable": "Repo archive-ஐ படிக்க முடியவில்லை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
    "ai_invalid_output": (
        "AI reviewer சரியான பதில் தரவில்லை. Re-roast click செய்யுங்கள், அடுத்த முறை சரியாக வரும்."
    ),
    "ai_unavailable": "AI reviewer இப்போது busy-ஆக உள்ளது. சில நிமிடங்கள் கழித்து re-roast செய்யுங்கள்.",
    "internal_error": "எங்கள் பக்கம் ஏதோ தவறு நடந்தது. சிறிது நேரம் கழித்து re-roast செய்யுங்கள்.",
}

FRIENDLY_ERRORS: dict[RoastLanguage, dict[str, str]] = {
    RoastLanguage.english: _ENGLISH_ERRORS,
    RoastLanguage.tamil: _TAMIL_ERRORS,
    RoastLanguage.tanglish: _TANGLISH_ERRORS,
}


def friendly_error(code: str, language: RoastLanguage) -> str:
    """Return the student-facing message for an error code in the roast's language."""
    messages = FRIENDLY_ERRORS.get(language, _ENGLISH_ERRORS)
    return messages.get(code, messages["internal_error"])


@dataclass(frozen=True)
class ParsedRepoUrl:
    """A validated, normalized GitHub repo reference."""

    owner: str
    name: str
    branch: str | None
    url: str


# --- Helpers -----------------------------------------------------------------
def _now() -> datetime:
    """Current UTC time (patchable in tests)."""
    return datetime.now(UTC)


def _today_start_utc() -> datetime:
    """Return today's 00:00 UTC."""
    now = _now()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _validate_branch(branch: str) -> str:
    """Validate a branch/ref name, raising 400 ``invalid_branch`` if unsafe."""
    cleaned = branch.strip().strip("/")
    if (
        not _BRANCH_RE.match(cleaned)
        or ".." in cleaned
        or cleaned.startswith("-")
        or "//" in cleaned
    ):
        raise BadRequestError("That branch name doesn't look valid.", error_code="invalid_branch")
    return cleaned


def parse_repo_url(repo_url: str, branch: str | None = None) -> ParsedRepoUrl:
    """Validate and normalize a GitHub repo URL.

    Accepts ``https://github.com/{owner}/{repo}`` with optional ``.git``, trailing
    slash or ``/tree/{branch}``. An explicit ``branch`` wins over the URL branch.

    Raises:
        BadRequestError: ``invalid_repo_url`` or ``invalid_branch``.
    """
    match = REPO_URL_RE.match(repo_url.strip())
    if not match:
        raise BadRequestError(
            "Only public GitHub repo links like https://github.com/owner/repo are supported.",
            error_code="invalid_repo_url",
        )
    owner, name, url_branch = match.group(1), match.group(2), match.group(3)
    if name.lower().endswith(".git"):
        name = name[:-4]
    if not name or name in (".", "..") or owner.startswith("-") or owner.endswith("-"):
        raise BadRequestError(
            "Only public GitHub repo links like https://github.com/owner/repo are supported.",
            error_code="invalid_repo_url",
        )
    chosen = branch or url_branch
    return ParsedRepoUrl(
        owner=owner,
        name=name,
        branch=_validate_branch(chosen) if chosen else None,
        url=f"https://github.com/{owner}/{name}",
    )


def count_used_today(db: Session, user_id: int) -> int:
    """Count roast attempts the user has started since 00:00 UTC (see module docstring)."""
    used = db.scalar(
        select(func.count(RoastAttempt.id)).where(
            RoastAttempt.user_id == user_id, RoastAttempt.created_at >= _today_start_utc()
        )
    )
    return int(used or 0)


def _record_attempt(db: Session, user_id: int, submission_id: int) -> None:
    """Add a quota ledger row for a roast attempt (committed by the caller)."""
    db.add(RoastAttempt(user_id=user_id, submission_id=submission_id, created_at=_now()))


def get_quota(db: Session, user_id: int) -> QuotaResponse:
    """Return the user's daily quota usage and the next reset time (00:00 UTC)."""
    return QuotaResponse(
        used=count_used_today(db, user_id),
        limit=settings.ROAST_DAILY_LIMIT,
        resets_at=_today_start_utc() + timedelta(days=1),
    )


def _enforce_daily_limit(db: Session, user_id: int) -> None:
    """Raise 429 ``daily_limit_reached`` when the user is out of roasts for today."""
    if count_used_today(db, user_id) >= settings.ROAST_DAILY_LIMIT:
        raise RateLimitError(
            f"You've used all {settings.ROAST_DAILY_LIMIT} roasts for today. "
            "Your quota resets at 00:00 UTC.",
            error_code="daily_limit_reached",
        )


# --- CRUD --------------------------------------------------------------------
def create_submission(db: Session, user: User, data: SubmissionCreate) -> Submission:
    """Validate the URL, enforce the daily limit and create a ``queued`` submission.

    Raises:
        BadRequestError: invalid URL/branch (400).
        RateLimitError: daily limit reached (429).
    """
    parsed = parse_repo_url(data.repo_url, data.branch)
    _enforce_daily_limit(db, user.id)
    submission = Submission(
        user_id=user.id,
        repo_url=parsed.url,
        repo_owner=parsed.owner,
        repo_name=parsed.name,
        branch=parsed.branch,
        assignment_title=data.assignment_title,
        assignment_description=data.assignment_description,
        roast_level=data.roast_level,
        roast_language=data.roast_language,
        status=SubmissionStatus.queued,
    )
    db.add(submission)
    db.flush()
    _record_attempt(db, user.id, submission.id)
    db.commit()
    db.refresh(submission)
    logger.info(
        "Submission %s queued for user %s (%s)", submission.id, user.id, submission.repo_url
    )
    return submission


def list_submissions(
    db: Session, user_id: int, page: int, size: int
) -> tuple[list[Submission], int]:
    """Return one page of the user's submissions (newest first) and the total count."""
    total = db.scalar(select(func.count(Submission.id)).where(Submission.user_id == user_id))
    items = db.scalars(
        select(Submission)
        .where(Submission.user_id == user_id)
        .options(selectinload(Submission.roasts))
        .order_by(Submission.created_at.desc(), Submission.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return list(items), int(total or 0)


def get_submission(db: Session, user_id: int, submission_id: int) -> Submission:
    """Return the user's submission or raise 404 (also for other users' submissions)."""
    submission = db.scalar(
        select(Submission)
        .where(Submission.id == submission_id, Submission.user_id == user_id)
        .options(selectinload(Submission.roasts))
    )
    if submission is None:
        raise NotFoundError("Submission not found.", error_code="submission_not_found")
    return submission


def delete_submission(db: Session, user_id: int, submission_id: int) -> None:
    """Delete the user's submission and its roasts (404 if not found/owned)."""
    submission = get_submission(db, user_id, submission_id)
    db.delete(submission)
    db.commit()
    logger.info("Submission %s deleted by user %s", submission_id, user_id)


def start_reroast(
    db: Session, user: User, submission_id: int, options: ReroastRequest | None = None
) -> Submission:
    """Reset a finished submission to ``queued`` for another roast attempt.

    ``options`` may switch the roast level and/or language; omitted fields keep the
    submission's previous choice.

    Raises:
        NotFoundError: not found / not owned (404).
        ConflictError: ``already_processing`` if the submission is not terminal (409).
        RateLimitError: daily limit reached (429).
    """
    submission = get_submission(db, user.id, submission_id)
    if submission.status not in TERMINAL_STATUSES:
        raise ConflictError(
            "This repo is already being roasted. Please wait for it to finish.",
            error_code="already_processing",
        )
    _enforce_daily_limit(db, user.id)
    submission.status = SubmissionStatus.queued
    submission.error_code = None
    submission.error_message = None
    submission.completed_at = None
    if options is not None:
        if options.roast_level is not None:
            submission.roast_level = options.roast_level
        if options.roast_language is not None:
            submission.roast_language = options.roast_language
    _record_attempt(db, user.id, submission.id)
    db.commit()
    db.refresh(submission)
    logger.info("Submission %s re-roast queued by user %s", submission.id, user.id)
    return submission


# --- Background pipeline -----------------------------------------------------
def _set_status(db: Session, submission: Submission, status: SubmissionStatus) -> None:
    """Persist a status transition so pollers see it immediately."""
    submission.status = status
    db.commit()


def _mark_failed(submission_id: int, code: str) -> None:
    """Mark a submission failed in a fresh session (never raises)."""
    db = SessionLocal()
    try:
        submission = db.get(Submission, submission_id)
        if submission is None:
            return
        submission.status = SubmissionStatus.failed
        submission.error_code = code
        submission.error_message = friendly_error(code, submission.roast_language)
        submission.completed_at = _now()
        db.commit()
    except Exception:
        logger.exception("Could not mark submission %s as failed", submission_id)
        db.rollback()
    finally:
        db.close()


async def _run_pipeline(db: Session, submission: Submission) -> None:
    """Fetch → filter → roast → store. Raises domain errors on failure."""
    owner, repo = submission.repo_owner, submission.repo_name

    _set_status(db, submission, SubmissionStatus.fetching)
    metadata = await github_service.get_repo_metadata(owner, repo)
    branch = submission.branch or metadata.default_branch
    sha = await github_service.resolve_commit_sha(owner, repo, branch)
    submission.branch = branch
    submission.commit_sha = sha
    submission.primary_language = metadata.language
    db.commit()

    tarball = await github_service.download_tarball(owner, repo, sha)
    snapshot = await anyio.to_thread.run_sync(repo_filter_service.build_snapshot, tarball)
    del tarball

    submission.files_analyzed = snapshot.files_analyzed
    if not submission.primary_language:
        submission.primary_language = snapshot.primary_language
    _set_status(db, submission, SubmissionStatus.analyzing)

    generation = await roast_service.generate_roast(
        snapshot,
        submission.assignment_title,
        submission.assignment_description,
        level=submission.roast_level,
        language=submission.roast_language,
    )
    result = generation.result
    db.add(
        Roast(
            submission_id=submission.id,
            overall_score=Decimal(str(result.overall_score)).quantize(
                Decimal("0.1"), rounding=ROUND_HALF_UP
            ),
            category_scores=result.category_scores.model_dump(),
            headline=result.headline,
            roast_text=result.roast_text,
            strengths=list(result.strengths),
            improvements=[item.model_dump() for item in result.improvements],
            roast_level=submission.roast_level,
            roast_language=submission.roast_language,
            model_used=generation.model[:100],
            input_tokens=generation.input_tokens,
            output_tokens=generation.output_tokens,
        )
    )
    submission.status = SubmissionStatus.completed
    submission.error_code = None
    submission.error_message = None
    submission.completed_at = _now()
    db.commit()


async def process_submission(submission_id: int) -> None:
    """Background task: run the roast pipeline and always end in a terminal status.

    Opens its own DB session. Domain failures are mapped to friendly
    ``error_message``s; technical details are only logged.
    """
    db = SessionLocal()
    failure_code: str | None = None
    try:
        submission = db.get(Submission, submission_id)
        if submission is None:
            logger.warning("process_submission: submission %s no longer exists", submission_id)
            return
        await _run_pipeline(db, submission)
        logger.info("Submission %s completed", submission_id)
    except GitHubError as exc:
        failure_code = exc.code
        logger.warning("Submission %s GitHub failure: %s", submission_id, exc.message)
    except RepoFilterError as exc:
        failure_code = exc.code
        logger.warning("Submission %s filter failure: %s", submission_id, exc.message)
    except RoastGenerationError as exc:
        failure_code = exc.code
        logger.warning("Submission %s roast failure: %s", submission_id, exc.message)
    except Exception:
        failure_code = "internal_error"
        logger.exception("Submission %s crashed unexpectedly", submission_id)
    finally:
        db.rollback()
        db.close()

    if failure_code is not None:
        _mark_failed(submission_id, failure_code)
