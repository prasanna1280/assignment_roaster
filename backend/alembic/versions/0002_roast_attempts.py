"""Add roast_attempts ledger for daily quota accounting.

Revision ID: 0002_roast_attempts
Revises: 0001_initial
Create Date: 2026-10-13 00:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_roast_attempts"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create roast_attempts and backfill it from existing roasts and unfinished submissions."""
    op.create_table(
        "roast_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "submission_id",
            sa.Integer(),
            sa.ForeignKey("submissions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_roast_attempts_user_id", "roast_attempts", ["user_id"])
    op.create_index("ix_roast_attempts_submission_id", "roast_attempts", ["submission_id"])
    op.create_index("ix_roast_attempts_created_at", "roast_attempts", ["created_at"])

    # Preserve usage under the previous accounting rule so the deploy doesn't refund quota.
    op.execute(
        """
        INSERT INTO roast_attempts (user_id, submission_id, created_at)
        SELECT s.user_id, s.id, r.created_at
        FROM roasts r JOIN submissions s ON s.id = r.submission_id
        """
    )
    op.execute(
        """
        INSERT INTO roast_attempts (user_id, submission_id, created_at)
        SELECT user_id, id, updated_at FROM submissions WHERE status <> 'completed'
        """
    )


def downgrade() -> None:
    """Drop roast_attempts."""
    op.drop_index("ix_roast_attempts_created_at", table_name="roast_attempts")
    op.drop_index("ix_roast_attempts_submission_id", table_name="roast_attempts")
    op.drop_index("ix_roast_attempts_user_id", table_name="roast_attempts")
    op.drop_table("roast_attempts")
