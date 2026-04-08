"""init core schema with postgis

Revision ID: 8c7d5b1269fb
Revises: 
Create Date: 2026-04-08 13:48:23.787772

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry


# revision identifiers, used by Alembic.
revision: str = '8c7d5b1269fb'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "vertiports",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("location", Geometry(geometry_type="POINT", srid=4326), nullable=False),
        sa.Column("suitability_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("price_per_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_vertiports_location_gist",
        "vertiports",
        ["location"],
        unique=False,
        postgresql_using="gist",
    )

    op.create_table(
        "favorites",
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vertiport_id", sa.BigInteger(), sa.ForeignKey("vertiports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("user_id", "vertiport_id"),
    )

    op.create_table(
        "analyses",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("region_name", sa.String(length=150), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("criteria_weights", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "analysis_results",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("analysis_id", sa.BigInteger(), sa.ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("cell_index", sa.String(length=32), nullable=False),
        sa.Column("suitability_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("criteria_breakdown", sa.JSON(), nullable=True),
        sa.Column("cell_geom", Geometry(geometry_type="POLYGON", srid=4326), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_analysis_results_cell_geom_gist",
        "analysis_results",
        ["cell_geom"],
        unique=False,
        postgresql_using="gist",
    )

    op.create_table(
        "routes",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("from_vertiport_id", sa.BigInteger(), sa.ForeignKey("vertiports.id", ondelete="SET NULL"), nullable=True),
        sa.Column("to_vertiport_id", sa.BigInteger(), sa.ForeignKey("vertiports.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'simulated'")),
        sa.Column("distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("duration_min", sa.Integer(), nullable=True),
        sa.Column("price_tl", sa.Numeric(10, 2), nullable=True),
        sa.Column("path_geom", Geometry(geometry_type="LINESTRING", srid=4326), nullable=True),
        sa.Column("weather_snapshot", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_routes_path_geom_gist",
        "routes",
        ["path_geom"],
        unique=False,
        postgresql_using="gist",
    )

    op.create_table(
        "reports",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("analysis_id", sa.BigInteger(), sa.ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("report_format", sa.String(length=20), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_index("ix_routes_path_geom_gist", table_name="routes")
    op.drop_table("routes")
    op.drop_index("ix_analysis_results_cell_geom_gist", table_name="analysis_results")
    op.drop_table("analysis_results")
    op.drop_table("analyses")
    op.drop_table("favorites")
    op.drop_index("ix_vertiports_location_gist", table_name="vertiports")
    op.drop_table("vertiports")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS postgis")
