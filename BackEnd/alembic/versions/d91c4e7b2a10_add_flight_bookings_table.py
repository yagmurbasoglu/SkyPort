"""add flight bookings table

Revision ID: d91c4e7b2a10
Revises: c61af4e2d9b3
Create Date: 2026-05-13 15:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d91c4e7b2a10"
down_revision: Union[str, None] = "c61af4e2d9b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "flight_bookings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("route_id", sa.BigInteger(), nullable=True),
        sa.Column("from_vertiport_id", sa.BigInteger(), nullable=False),
        sa.Column("to_vertiport_id", sa.BigInteger(), nullable=True),
        sa.Column("flight_no", sa.String(length=40), nullable=False),
        sa.Column("gate", sa.String(length=12), nullable=True),
        sa.Column("departure_date", sa.Date(), nullable=False),
        sa.Column("departure_time", sa.String(length=5), nullable=False),
        sa.Column("passenger_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["from_vertiport_id"], ["vertiports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["route_id"], ["routes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["to_vertiport_id"], ["vertiports.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("from_vertiport_id", "departure_date", "departure_time", name="uq_flight_bookings_departure_slot"),
    )


def downgrade() -> None:
    op.drop_table("flight_bookings")
