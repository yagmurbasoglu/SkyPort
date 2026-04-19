from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    from_vertiport_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("vertiports.id", ondelete="SET NULL"),
        nullable=True,
    )
    to_vertiport_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("vertiports.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="simulated")
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_tl: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    path_geom: Mapped[object | None] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326),
        nullable=True,
    )
    weather_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
