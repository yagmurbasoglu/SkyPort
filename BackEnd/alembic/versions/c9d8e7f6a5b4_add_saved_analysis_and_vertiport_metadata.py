"""add saved analysis and vertiport metadata

Revision ID: c9d8e7f6a5b4
Revises: b41b8f7b2b18
Create Date: 2026-04-28 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = "b41b8f7b2b18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("saved_name", sa.String(length=160), nullable=True))
    op.add_column("analyses", sa.Column("saved_payload", sa.JSON(), nullable=True))
    op.add_column("analyses", sa.Column("saved_at", sa.DateTime(timezone=True), nullable=True))

    op.add_column("vertiports", sa.Column("features", sa.JSON(), nullable=True))
    op.add_column("vertiports", sa.Column("noise_level", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("vertiports", "noise_level")
    op.drop_column("vertiports", "features")

    op.drop_column("analyses", "saved_at")
    op.drop_column("analyses", "saved_payload")
    op.drop_column("analyses", "saved_name")
