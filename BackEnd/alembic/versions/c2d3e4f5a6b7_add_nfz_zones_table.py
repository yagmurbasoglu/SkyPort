"""add nfz zones table

Revision ID: c2d3e4f5a6b7
Revises: b1f2c3d4e5f6
Create Date: 2026-04-10 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1f2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "nfz_zones",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("zone_code", sa.String(length=80), nullable=True),
        sa.Column("zone_name", sa.String(length=255), nullable=True),
        sa.Column("zone_type", sa.String(length=40), nullable=True),
        sa.Column("lower_limit", sa.String(length=60), nullable=True),
        sa.Column("upper_limit", sa.String(length=60), nullable=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("geom", Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_nfz_zones_source", "nfz_zones", ["source"], unique=False)
    op.create_index("ix_nfz_zones_zone_code", "nfz_zones", ["zone_code"], unique=False)
    op.create_index("ix_nfz_zones_is_active", "nfz_zones", ["is_active"], unique=False)
    op.create_index(
        "ix_nfz_zones_geom_gist",
        "nfz_zones",
        ["geom"],
        unique=False,
        postgresql_using="gist",
    )


def downgrade() -> None:
    op.drop_index("ix_nfz_zones_geom_gist", table_name="nfz_zones")
    op.drop_index("ix_nfz_zones_is_active", table_name="nfz_zones")
    op.drop_index("ix_nfz_zones_zone_code", table_name="nfz_zones")
    op.drop_index("ix_nfz_zones_source", table_name="nfz_zones")
    op.drop_table("nfz_zones")
