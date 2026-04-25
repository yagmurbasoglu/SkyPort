"""Link analyses to geodata ingest jobs

Revision ID: b41b8f7b2b18
Revises: f6a7b8c9d0e1
Create Date: 2026-04-25 18:25:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b41b8f7b2b18"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("geodata_job_id", sa.String(length=32), nullable=True))
    op.create_index("ix_analyses_geodata_job_id", "analyses", ["geodata_job_id"], unique=False)
    op.create_foreign_key(
        "fk_analyses_geodata_job_id",
        "analyses",
        "geodata_ingest_jobs",
        ["geodata_job_id"],
        ["job_id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_analyses_geodata_job_id", "analyses", type_="foreignkey")
    op.drop_index("ix_analyses_geodata_job_id", table_name="analyses")
    op.drop_column("analyses", "geodata_job_id")
