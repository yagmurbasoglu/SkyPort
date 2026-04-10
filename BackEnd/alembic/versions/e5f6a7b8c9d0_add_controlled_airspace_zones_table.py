"""add controlled airspace zones table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-10 00:20:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "controlled_airspace_zones",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source", sa.String(length=60), nullable=False),
        sa.Column("source_version", sa.String(length=80), nullable=True),
        sa.Column("airspace_class", sa.String(length=30), nullable=True),
        sa.Column("zone_code", sa.String(length=80), nullable=True),
        sa.Column("zone_name", sa.String(length=255), nullable=True),
        sa.Column("lower_limit", sa.String(length=60), nullable=True),
        sa.Column("upper_limit", sa.String(length=60), nullable=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("geom", Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_controlled_airspace_zones_source", "controlled_airspace_zones", ["source"], unique=False)
    op.create_index(
        "ix_controlled_airspace_zones_source_version",
        "controlled_airspace_zones",
        ["source_version"],
        unique=False,
    )
    op.create_index(
        "ix_controlled_airspace_zones_airspace_class",
        "controlled_airspace_zones",
        ["airspace_class"],
        unique=False,
    )
    op.create_index("ix_controlled_airspace_zones_zone_code", "controlled_airspace_zones", ["zone_code"], unique=False)
    op.create_index("ix_controlled_airspace_zones_is_active", "controlled_airspace_zones", ["is_active"], unique=False)
    op.create_index(
        "ix_controlled_airspace_zones_last_synced_at",
        "controlled_airspace_zones",
        ["last_synced_at"],
        unique=False,
    )
    op.create_index(
        "ix_controlled_airspace_zones_geom_gist",
        "controlled_airspace_zones",
        ["geom"],
        unique=False,
        postgresql_using="gist",
    )


def downgrade() -> None:
    op.drop_index("ix_controlled_airspace_zones_geom_gist", table_name="controlled_airspace_zones")
    op.drop_index("ix_controlled_airspace_zones_last_synced_at", table_name="controlled_airspace_zones")
    op.drop_index("ix_controlled_airspace_zones_is_active", table_name="controlled_airspace_zones")
    op.drop_index("ix_controlled_airspace_zones_zone_code", table_name="controlled_airspace_zones")
    op.drop_index("ix_controlled_airspace_zones_airspace_class", table_name="controlled_airspace_zones")
    op.drop_index("ix_controlled_airspace_zones_source_version", table_name="controlled_airspace_zones")
    op.drop_index("ix_controlled_airspace_zones_source", table_name="controlled_airspace_zones")
    op.drop_table("controlled_airspace_zones")
