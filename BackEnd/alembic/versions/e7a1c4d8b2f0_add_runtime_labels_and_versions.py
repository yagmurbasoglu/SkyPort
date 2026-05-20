"""add runtime labels and versions

Revision ID: e7a1c4d8b2f0
Revises: d91c4e7b2a10
Create Date: 2026-05-13 19:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7a1c4d8b2f0"
down_revision: Union[str, None] = "d91c4e7b2a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "favorites",
        sa.Column("label", sa.String(length=20), nullable=False, server_default=sa.text("'standard'")),
    )
    op.add_column(
        "analyses",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "geodata_ingest_jobs",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_column("geodata_ingest_jobs", "version")
    op.drop_column("analyses", "version")
    op.drop_column("favorites", "label")
