"""expand vertiport review uniqueness

Revision ID: b8d31f4a92c1
Revises: a7c2d91e4f10
Create Date: 2026-05-12 14:42:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b8d31f4a92c1"
down_revision: Union[str, Sequence[str], None] = "a7c2d91e4f10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_vertiport_reviews_user_flight", "vertiport_reviews", type_="unique")
    op.create_unique_constraint(
        "uq_vertiport_reviews_user_flight_vertiport",
        "vertiport_reviews",
        ["user_id", "flight_no", "vertiport_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_vertiport_reviews_user_flight_vertiport", "vertiport_reviews", type_="unique")
    op.create_unique_constraint(
        "uq_vertiport_reviews_user_flight",
        "vertiport_reviews",
        ["user_id", "flight_no"],
    )
