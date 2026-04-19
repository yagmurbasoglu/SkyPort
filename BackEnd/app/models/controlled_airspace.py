from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ControlledAirspaceZone(Base):
    __tablename__ = "controlled_airspace_zones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    source_version: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    airspace_class: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    zone_code: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    zone_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lower_limit: Mapped[str | None] = mapped_column(String(60), nullable=True)
    upper_limit: Mapped[str | None] = mapped_column(String(60), nullable=True)
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", index=True)
    geom: Mapped[object] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
