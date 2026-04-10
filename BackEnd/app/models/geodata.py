from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.db.base import Base


class GeodataIngestJob(Base):
    __tablename__ = "geodata_ingest_jobs"

    job_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    region_name: Mapped[str] = mapped_column(String(150), nullable=False)
    h3_resolution: Mapped[int] = mapped_column(Integer, nullable=False)
    bounding_box: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    layer_counts: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class GeodataH3Cell(Base):
    __tablename__ = "geodata_h3_cells"
    __table_args__ = (UniqueConstraint("job_id", "cell_index", name="uq_geodata_h3_job_cell"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("geodata_ingest_jobs.job_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cell_index: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
