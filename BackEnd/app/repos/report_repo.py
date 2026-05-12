from typing import Any

from sqlalchemy import delete
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.report import Report


def _report_to_dict(report: Report) -> dict[str, Any]:
    return {
        "id": report.id,
        "analysis_id": report.analysis_id,
        "user_id": report.user_id,
        "report_format": report.report_format,
        "file_path": report.file_path,
        "created_at": report.created_at,
    }


def create_report(
    *,
    analysis_id: int,
    user_id: int,
    report_format: str,
    file_path: str,
) -> dict[str, Any]:
    with SessionLocal() as db:
        report = Report(
            analysis_id=analysis_id,
            user_id=user_id,
            report_format=report_format,
            file_path=file_path,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return _report_to_dict(report)


def get_report(report_id: int) -> dict[str, Any] | None:
    with SessionLocal() as db:
        report = db.get(Report, report_id)
        return _report_to_dict(report) if report else None


def list_user_reports(user_id: int) -> list[dict[str, Any]]:
    with SessionLocal() as db:
        stmt = select(Report).where(Report.user_id == user_id).order_by(Report.created_at.desc())
        return [_report_to_dict(row) for row in db.execute(stmt).scalars().all()]


def delete_report(report_id: int) -> dict[str, Any] | None:
    with SessionLocal() as db:
        report = db.get(Report, report_id)
        if report is None:
            return None
        payload = _report_to_dict(report)
        db.execute(delete(Report).where(Report.id == report_id))
        db.commit()
        return payload
