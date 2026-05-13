from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FlightBooking(Base):
    __tablename__ = "flight_bookings"
    __table_args__ = (
        UniqueConstraint(
            "from_vertiport_id",
            "departure_date",
            "departure_time",
            name="uq_flight_bookings_departure_slot",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    route_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("routes.id", ondelete="SET NULL"),
        nullable=True,
    )
    from_vertiport_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("vertiports.id", ondelete="CASCADE"),
        nullable=False,
    )
    to_vertiport_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("vertiports.id", ondelete="SET NULL"),
        nullable=True,
    )
    flight_no: Mapped[str] = mapped_column(String(40), nullable=False)
    gate: Mapped[str | None] = mapped_column(String(12), nullable=True)
    departure_date: Mapped[date] = mapped_column(Date, nullable=False)
    departure_time: Mapped[str] = mapped_column(String(5), nullable=False)
    passenger_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
