"""add geodata ingest job tables

Revision ID: b1f2c3d4e5f6
Revises: 8c7d5b1269fb
Create Date: 2026-04-09 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1f2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "8c7d5b1269fb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "geodata_ingest_jobs",
        sa.Column("job_id", sa.String(length=32), primary_key=True),
        sa.Column("region_name", sa.String(length=150), nullable=False),
        sa.Column("h3_resolution", sa.Integer(), nullable=False),
        sa.Column("bounding_box", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.Column("layer_counts", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_geodata_ingest_jobs_status", "geodata_ingest_jobs", ["status"], unique=False)
    op.create_index("ix_geodata_ingest_jobs_updated_at", "geodata_ingest_jobs", ["updated_at"], unique=False)

    op.create_table(
        "geodata_h3_cells",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "job_id",
            sa.String(length=32),
            sa.ForeignKey("geodata_ingest_jobs.job_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("cell_index", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("job_id", "cell_index", name="uq_geodata_h3_job_cell"),
    )
    op.create_index("ix_geodata_h3_cells_job_id", "geodata_h3_cells", ["job_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_geodata_h3_cells_job_id", table_name="geodata_h3_cells")
    op.drop_table("geodata_h3_cells")
    op.drop_index("ix_geodata_ingest_jobs_updated_at", table_name="geodata_ingest_jobs")
    op.drop_index("ix_geodata_ingest_jobs_status", table_name="geodata_ingest_jobs")
    op.drop_table("geodata_ingest_jobs")
