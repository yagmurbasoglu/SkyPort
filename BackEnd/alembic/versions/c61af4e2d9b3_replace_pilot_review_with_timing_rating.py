"""replace pilot review with timing rating

Revision ID: c61af4e2d9b3
Revises: b8d31f4a92c1
Create Date: 2026-05-13 10:15:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c61af4e2d9b3"
down_revision: Union[str, Sequence[str], None] = "b8d31f4a92c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_vertiport_reviews_pilot_range", "vertiport_reviews", type_="check")
    op.alter_column("vertiport_reviews", "pilot_rating", new_column_name="timing_rating")
    op.create_check_constraint(
        "ck_vertiport_reviews_timing_range",
        "vertiport_reviews",
        "timing_rating BETWEEN 1 AND 5",
    )


def downgrade() -> None:
    op.drop_constraint("ck_vertiport_reviews_timing_range", "vertiport_reviews", type_="check")
    op.alter_column("vertiport_reviews", "timing_rating", new_column_name="pilot_rating")
    op.create_check_constraint(
        "ck_vertiport_reviews_pilot_range",
        "vertiport_reviews",
        "pilot_rating BETWEEN 1 AND 5",
    )
