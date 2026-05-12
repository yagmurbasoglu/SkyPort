from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VertiportReview(Base):
    __tablename__ = "vertiport_reviews"
    __table_args__ = (
        UniqueConstraint("user_id", "flight_no", "vertiport_id", name="uq_vertiport_reviews_user_flight_vertiport"),
        CheckConstraint("satisfaction_rating BETWEEN 1 AND 5", name="ck_vertiport_reviews_satisfaction_range"),
        CheckConstraint("pilot_rating BETWEEN 1 AND 5", name="ck_vertiport_reviews_pilot_range"),
        CheckConstraint("comfort_rating BETWEEN 1 AND 5", name="ck_vertiport_reviews_comfort_range"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    vertiport_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("vertiports.id", ondelete="CASCADE"),
        nullable=True,
    )
    flight_no: Mapped[str] = mapped_column(String(40), nullable=False)
    satisfaction_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    pilot_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comfort_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
