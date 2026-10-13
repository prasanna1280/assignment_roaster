"""Initial schema: users, refresh_tokens, submissions, roasts.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-10 00:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSONType = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _timestamps() -> list[sa.Column]:
    """Return fresh created_at / updated_at columns."""
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    """Create all tables, indexes and constraints."""
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=120), server_default="", nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("oauth_provider", sa.String(length=50), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_timestamps(),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("repo_url", sa.String(length=300), nullable=False),
        sa.Column("repo_owner", sa.String(length=100), nullable=False),
        sa.Column("repo_name", sa.String(length=100), nullable=False),
        sa.Column("branch", sa.String(length=255), nullable=True),
        sa.Column("commit_sha", sa.String(length=40), nullable=True),
        sa.Column("assignment_title", sa.String(length=200), nullable=True),
        sa.Column("assignment_description", sa.Text(), nullable=True),
        sa.Column("primary_language", sa.String(length=50), nullable=True),
        sa.Column("files_analyzed", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "queued",
                "fetching",
                "analyzing",
                "completed",
                "failed",
                name="submission_status",
                native_enum=False,
                length=20,
            ),
            server_default="queued",
            nullable=False,
        ),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
    )
    op.create_index("ix_submissions_user_id", "submissions", ["user_id"])
    op.create_index("ix_submissions_status", "submissions", ["status"])
    op.create_index(
        "ix_submissions_user_id_created_at",
        "submissions",
        ["user_id", sa.text("created_at DESC")],
    )

    op.create_table(
        "roasts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "submission_id",
            sa.Integer(),
            sa.ForeignKey("submissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("overall_score", sa.Numeric(precision=3, scale=1), nullable=False),
        sa.Column("category_scores", JSONType, nullable=False),
        sa.Column("headline", sa.String(length=300), nullable=False),
        sa.Column("roast_text", sa.Text(), nullable=False),
        sa.Column("strengths", JSONType, nullable=False),
        sa.Column("improvements", JSONType, nullable=False),
        sa.Column("model_used", sa.String(length=100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("output_tokens", sa.Integer(), server_default="0", nullable=False),
        *_timestamps(),
        sa.CheckConstraint(
            "overall_score >= 0 AND overall_score <= 10", name="ck_roasts_overall_score_range"
        ),
    )
    op.create_index("ix_roasts_submission_id", "roasts", ["submission_id"])


def downgrade() -> None:
    """Drop all tables and indexes in reverse dependency order."""
    op.drop_index("ix_roasts_submission_id", table_name="roasts")
    op.drop_table("roasts")

    op.drop_index("ix_submissions_user_id_created_at", table_name="submissions")
    op.drop_index("ix_submissions_status", table_name="submissions")
    op.drop_index("ix_submissions_user_id", table_name="submissions")
    op.drop_table("submissions")

    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
