"""Submission endpoints: create (202 + background roast), list, quota, detail, re-roast, delete."""

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.submission import (
    QuotaResponse,
    ReroastRequest,
    SubmissionCreate,
    SubmissionListResponse,
    SubmissionResponse,
)
from app.services import submission_service

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a public GitHub repo for roasting",
)
@limiter.limit("10/minute")
async def create_submission(
    request: Request,
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """Queue a roast. 400 ``invalid_repo_url``/``invalid_branch``, 429 ``daily_limit_reached``."""
    submission = submission_service.create_submission(db, user, payload)
    background_tasks.add_task(submission_service.process_submission, submission.id)
    return SubmissionResponse.model_validate(submission)


@router.get("", response_model=SubmissionListResponse, summary="List my submissions")
async def list_submissions(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubmissionListResponse:
    """Return the current user's submissions, newest first."""
    items, total = submission_service.list_submissions(db, user.id, page, size)
    return SubmissionListResponse(
        items=[SubmissionResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        size=size,
    )


@router.get("/quota", response_model=QuotaResponse, summary="My daily roast quota")
async def get_quota(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> QuotaResponse:
    """Return ``{used, limit, resets_at}`` (resets at 00:00 UTC)."""
    return submission_service.get_quota(db, user.id)


@router.get("/{submission_id}", response_model=SubmissionResponse, summary="Get a submission")
async def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """Return status and latest roast. 404 ``submission_not_found`` if missing or not owned."""
    submission = submission_service.get_submission(db, user.id, submission_id)
    return SubmissionResponse.model_validate(submission)


@router.post(
    "/{submission_id}/reroast",
    response_model=SubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-run the roast pipeline",
)
@limiter.limit("10/minute")
async def reroast_submission(
    request: Request,
    submission_id: int,
    background_tasks: BackgroundTasks,
    options: ReroastRequest | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """Re-roast, optionally with a new level/language.

    409 ``already_processing`` if in progress, 429 ``daily_limit_reached``.
    """
    submission = submission_service.start_reroast(db, user, submission_id, options)
    background_tasks.add_task(submission_service.process_submission, submission.id)
    return SubmissionResponse.model_validate(submission)


@router.delete(
    "/{submission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Delete a submission and its roasts",
)
async def delete_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Delete own submission. 404 ``submission_not_found`` if missing or not owned."""
    submission_service.delete_submission(db, user.id, submission_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
