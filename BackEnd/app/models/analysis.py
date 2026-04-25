from datetime import datetime
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    geodata_job_id: Mapped[str | None] = mapped_column(
        String(32),
        ForeignKey("geodata_ingest_jobs.job_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    region_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="pending")
    criteria_weights: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cell_index: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    suitability_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    criteria_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    cell_geom: Mapped[object | None] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
