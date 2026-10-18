"""Add roast_level and roast_language to submissions and roasts.

Revision ID: 0003_roast_level_language
Revises: 0002_roast_attempts
Create Date: 2026-10-18 00:00:00

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_roast_level_language"
down_revision: str | None = "0002_roast_attempts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("submissions", "roasts")


def upgrade() -> None:
    """Add both columns; existing rows default to the original medium Tanglish roast."""
    for table in _TABLES:
        with op.batch_alter_table(table) as batch:
            batch.add_column(
                sa.Column(
                    "roast_level", sa.String(length=20), server_default="medium", nullable=False
                )
            )
            batch.add_column(
                sa.Column(
                    "roast_language",
                    sa.String(length=20),
                    server_default="tanglish",
                    nullable=False,
                )
            )
            batch.create_check_constraint(
                f"ck_{table}_roast_level", "roast_level IN ('lite', 'medium', 'spicy')"
            )
            batch.create_check_constraint(
                f"ck_{table}_roast_language",
                "roast_language IN ('english', 'tamil', 'tanglish')",
            )


def downgrade() -> None:
    """Drop both columns."""
    for table in _TABLES:
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f"ck_{table}_roast_language", type_="check")
            batch.drop_constraint(f"ck_{table}_roast_level", type_="check")
            batch.drop_column("roast_language")
            batch.drop_column("roast_level")
