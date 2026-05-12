"""add vertiport reviews table

Revision ID: a7c2d91e4f10
Revises: c9d8e7f6a5b4
Create Date: 2026-05-12 14:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7c2d91e4f10"
down_revision: Union[str, Sequence[str], None] = "c9d8e7f6a5b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vertiport_reviews",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("vertiport_id", sa.BigInteger(), nullable=True),
        sa.Column("flight_no", sa.String(length=40), nullable=False),
        sa.Column("satisfaction_rating", sa.Integer(), nullable=False),
        sa.Column("pilot_rating", sa.Integer(), nullable=False),
        sa.Column("comfort_rating", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("comfort_rating BETWEEN 1 AND 5", name="ck_vertiport_reviews_comfort_range"),
        sa.CheckConstraint("pilot_rating BETWEEN 1 AND 5", name="ck_vertiport_reviews_pilot_range"),
        sa.CheckConstraint("satisfaction_rating BETWEEN 1 AND 5", name="ck_vertiport_reviews_satisfaction_range"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vertiport_id"], ["vertiports.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "flight_no", name="uq_vertiport_reviews_user_flight"),
    )
    op.create_index("ix_vertiport_reviews_vertiport_id", "vertiport_reviews", ["vertiport_id"], unique=False)
    op.create_index("ix_vertiport_reviews_user_id", "vertiport_reviews", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_vertiport_reviews_user_id", table_name="vertiport_reviews")
    op.drop_index("ix_vertiport_reviews_vertiport_id", table_name="vertiport_reviews")
    op.drop_table("vertiport_reviews")
