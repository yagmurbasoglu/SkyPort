from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping
from sqlalchemy import delete, func, select

from app.db.session import SessionLocal
from app.models.analysis import Analysis, AnalysisResult
from app.models.geodata import GeodataH3Cell, GeodataIngestJob


def _analysis_to_dict(analysis: Analysis) -> dict[str, Any]:
    return {
        "id": analysis.id,
        "user_id": analysis.user_id,
        "geodata_job_id": analysis.geodata_job_id,
        "region_name": analysis.region_name,
        "status": analysis.status,
        "criteria_weights": analysis.criteria_weights or {},
        "started_at": analysis.started_at,
        "completed_at": analysis.completed_at,
        "created_at": analysis.created_at,
    }


def _score_to_float(value: Decimal | float | int) -> float:
    return float(value)


def _result_to_dict(result: AnalysisResult, include_geometry: bool = False) -> dict[str, Any]:
    payload = {
        "id": result.id,
        "analysis_id": result.analysis_id,
        "cell_index": result.cell_index,
        "suitability_score": _score_to_float(result.suitability_score),
        "criteria_breakdown": result.criteria_breakdown or {},
        "created_at": result.created_at,
    }
    if include_geometry:
        payload["geometry"] = mapping(to_shape(result.cell_geom)) if result.cell_geom is not None else None
    return payload


def get_geodata_job(job_id: str) -> dict[str, Any] | None:
    with SessionLocal() as db:
        job = db.get(GeodataIngestJob, job_id)
        if job is None:
            return None
        return {
            "job_id": job.job_id,
            "region_name": job.region_name,
            "status": job.status,
            "warnings": job.warnings or [],
            "layer_counts": job.layer_counts or {},
            "extracted_layers": job.extracted_layers or {},
            "bounding_box": job.bounding_box,
            "h3_resolution": job.h3_resolution,
        }


def list_geodata_cells(job_id: str) -> list[str]:
    with SessionLocal() as db:
        stmt = select(GeodataH3Cell.cell_index).where(GeodataH3Cell.job_id == job_id)
        return list(db.execute(stmt).scalars().all())


def create_analysis(
    *,
    user_id: int,
    geodata_job_id: str,
    region_name: str | None,
    criteria_weights: dict[str, float],
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        analysis = Analysis(
            user_id=user_id,
            geodata_job_id=geodata_job_id,
            region_name=region_name,
            status="running",
            criteria_weights=criteria_weights,
            started_at=now,
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return _analysis_to_dict(analysis)


def reset_analysis(analysis_id: int, *, criteria_weights: dict[str, float]) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        analysis = db.get(Analysis, analysis_id)
        if analysis is None:
            return None

        db.execute(delete(AnalysisResult).where(AnalysisResult.analysis_id == analysis_id))
        analysis.status = "running"
        analysis.criteria_weights = criteria_weights
        analysis.started_at = now
        analysis.completed_at = None
        db.commit()
        db.refresh(analysis)
        return _analysis_to_dict(analysis)


def get_analysis(analysis_id: int) -> dict[str, Any] | None:
    with SessionLocal() as db:
        analysis = db.get(Analysis, analysis_id)
        return _analysis_to_dict(analysis) if analysis else None


def complete_analysis(analysis_id: int, results: list[dict[str, Any]]) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        analysis = db.get(Analysis, analysis_id)
        if analysis is None:
            return None

        db.execute(delete(AnalysisResult).where(AnalysisResult.analysis_id == analysis_id))
        db.add_all(
            [
                AnalysisResult(
                    analysis_id=analysis_id,
                    cell_index=item["cell_index"],
                    suitability_score=item["suitability_score"],
                    criteria_breakdown=item["criteria_breakdown"],
                    cell_geom=from_shape(item["geometry"], srid=4326) if item.get("geometry") is not None else None,
                )
                for item in results
            ]
        )
        analysis.status = "completed"
        analysis.completed_at = now
        db.commit()
        db.refresh(analysis)
        return _analysis_to_dict(analysis)


def fail_analysis(analysis_id: int) -> dict[str, Any] | None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        analysis = db.get(Analysis, analysis_id)
        if analysis is None:
            return None
        analysis.status = "failed"
        analysis.completed_at = now
        db.commit()
        db.refresh(analysis)
        return _analysis_to_dict(analysis)


def list_results(analysis_id: int, *, include_geometry: bool = False) -> list[dict[str, Any]]:
    with SessionLocal() as db:
        stmt = (
            select(AnalysisResult)
            .where(AnalysisResult.analysis_id == analysis_id)
            .order_by(AnalysisResult.suitability_score.desc())
        )
        return [_result_to_dict(row, include_geometry=include_geometry) for row in db.execute(stmt).scalars().all()]


def get_result_by_cell(analysis_id: int, cell_index: str, *, include_geometry: bool = False) -> dict[str, Any] | None:
    with SessionLocal() as db:
        stmt = (
            select(AnalysisResult)
            .where(
                AnalysisResult.analysis_id == analysis_id,
                AnalysisResult.cell_index == cell_index,
            )
            .limit(1)
        )
        row = db.execute(stmt).scalar_one_or_none()
        return _result_to_dict(row, include_geometry=include_geometry) if row else None


def summarize_results(analysis_id: int) -> dict[str, Any]:
    with SessionLocal() as db:
        row = db.execute(
            select(
                func.count(AnalysisResult.id),
                func.avg(AnalysisResult.suitability_score),
                func.max(AnalysisResult.suitability_score),
                func.min(AnalysisResult.suitability_score),
            ).where(AnalysisResult.analysis_id == analysis_id)
        ).one()
        return {
            "cell_count": int(row[0] or 0),
            "average_score": float(row[1]) if row[1] is not None else None,
            "max_score": float(row[2]) if row[2] is not None else None,
            "min_score": float(row[3]) if row[3] is not None else None,
        }
