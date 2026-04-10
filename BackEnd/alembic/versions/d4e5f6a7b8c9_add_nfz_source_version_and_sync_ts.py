"""add nfz source version and sync ts

Revision ID: d4e5f6a7b8c9
Revises: c2d3e4f5a6b7
Create Date: 2026-04-10 00:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("nfz_zones", sa.Column("source_version", sa.String(length=80), nullable=True))
    op.add_column("nfz_zones", sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_nfz_zones_source_version", "nfz_zones", ["source_version"], unique=False)
    op.create_index("ix_nfz_zones_last_synced_at", "nfz_zones", ["last_synced_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_nfz_zones_last_synced_at", table_name="nfz_zones")
    op.drop_index("ix_nfz_zones_source_version", table_name="nfz_zones")
    op.drop_column("nfz_zones", "last_synced_at")
    op.drop_column("nfz_zones", "source_version")
