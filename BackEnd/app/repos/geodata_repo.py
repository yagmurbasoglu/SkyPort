from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.geodata import GeodataH3Cell, GeodataIngestJob


def _job_to_dict(job: GeodataIngestJob) -> dict:
    return {
        "job_id": job.job_id,
        "status": job.status,
        "warnings": job.warnings or [],
        "layer_counts": job.layer_counts or {},
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "updated_at": job.updated_at,
    }


def create_job(job_id: str, payload: dict) -> dict:
    with SessionLocal() as db:
        job = GeodataIngestJob(
            job_id=job_id,
            region_name=payload["region_name"],
            h3_resolution=payload["h3_resolution"],
            bounding_box=payload["bounding_box"],
            status=payload["status"],
            warnings=payload["warnings"],
            layer_counts=payload["layer_counts"],
            started_at=payload["started_at"],
            finished_at=payload["finished_at"],
            updated_at=payload.get("updated_at", datetime.now(timezone.utc)),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return _job_to_dict(job)


def update_job(job_id: str, patch: dict) -> dict | None:
    with SessionLocal() as db:
        job = db.get(GeodataIngestJob, job_id)
        if job is None:
            return None

        h3_cells: list[str] = patch.pop("h3_cells", [])
        for key, value in patch.items():
            setattr(job, key, value)
        job.updated_at = datetime.now(timezone.utc)

        db.query(GeodataH3Cell).filter(GeodataH3Cell.job_id == job_id).delete()
        if h3_cells:
            db.add_all([GeodataH3Cell(job_id=job_id, cell_index=cell) for cell in h3_cells])

        db.commit()
        db.refresh(job)
        return _job_to_dict(job)


def get_job(job_id: str) -> dict | None:
    with SessionLocal() as db:
        stmt = select(GeodataIngestJob).where(GeodataIngestJob.job_id == job_id)
        job = db.execute(stmt).scalar_one_or_none()
        if job is None:
            return None
        return _job_to_dict(job)
