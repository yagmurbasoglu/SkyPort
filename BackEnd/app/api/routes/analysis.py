from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.deps import RoleChecker
from app.models.user import User
from app.schemas.analysis import (
    AnalysisCellDetailResponse,
    AnalysisCompareRequest,
    AnalysisCompareResponse,
    AnalysisCreateRequest,
    AnalysisCreateResponse,
    AnalysisSaveRequest,
    AnalysisSaveResponse,
    AnalysisHeatmapResponse,
    AnalysisRecalculateRequest,
    AnalysisResultResponse,
    AnalysisStatusResponse,
    AnalysisHistoryResponse,
    AnalysisExportResponse,
)
from app.services.analysis_service import AnalysisService

router = APIRouter()
allow_expert = RoleChecker(["expert"])


class LegacyAnalysisRequest(BaseModel):
    region_id: str
    criteria_weights: dict[str, float]


@router.post("", response_model=AnalysisCreateResponse)
def create_analysis(
    req: AnalysisCreateRequest,
    current_user: User = Depends(allow_expert),
) -> AnalysisCreateResponse:
    """
    Start an async MCDM analysis from a completed geodata ingest job.
    Access: Experts only.
    """
    analysis_svc = AnalysisService()
    result = analysis_svc.start_analysis(
        user_id=current_user.id,
        geodata_job_id=req.geodata_job_id,
        region_name=req.region_name,
        criteria_weights=req.criteria_weights,
    )
    return AnalysisCreateResponse(**result)


@router.post("/{analysis_id}/recalculate", response_model=AnalysisCreateResponse)
def recalculate_analysis(
    analysis_id: int,
    req: AnalysisRecalculateRequest,
    current_user: User = Depends(allow_expert),
) -> AnalysisCreateResponse:
    """
    Re-run an existing analysis with updated criteria weights.
    Access: Experts only.
    """
    result = AnalysisService().recalculate_analysis(
        user_id=current_user.id,
        analysis_id=analysis_id,
        criteria_weights=req.criteria_weights,
    )
    return AnalysisCreateResponse(**result)


@router.get("/{analysis_id}/status", response_model=AnalysisStatusResponse)
def get_analysis_status(
    analysis_id: int,
    current_user: User = Depends(allow_expert),
) -> AnalysisStatusResponse:
    """
    Get status of an async analysis job.
    """
    result = AnalysisService().get_status(analysis_id)
    return AnalysisStatusResponse(**result)


@router.get("/{analysis_id}/result", response_model=AnalysisResultResponse)
def get_analysis_result(
    analysis_id: int,
    current_user: User = Depends(allow_expert),
) -> AnalysisResultResponse:
    result = AnalysisService().get_result(analysis_id)
    return AnalysisResultResponse(**result)


@router.get("/{analysis_id}/heatmap", response_model=AnalysisHeatmapResponse)
def get_analysis_heatmap(
    analysis_id: int,
    current_user: User = Depends(allow_expert),
) -> AnalysisHeatmapResponse:
    result = AnalysisService().get_heatmap(analysis_id)
    return AnalysisHeatmapResponse(**result)


@router.get("/{analysis_id}/cells/{cell_index}", response_model=AnalysisCellDetailResponse)
def get_analysis_cell_detail(
    analysis_id: int,
    cell_index: str,
    current_user: User = Depends(allow_expert),
) -> AnalysisCellDetailResponse:
    result = AnalysisService().get_cell_detail(analysis_id, cell_index)
    return AnalysisCellDetailResponse(**result)


@router.post("/{analysis_id}/save", response_model=AnalysisSaveResponse)
def save_analysis_to_profile(
    analysis_id: int,
    req: AnalysisSaveRequest,
    current_user: User = Depends(allow_expert),
) -> AnalysisSaveResponse:
    result = AnalysisService().save_to_profile(
        user_id=current_user.id,
        analysis_id=analysis_id,
        name=req.name,
        map_view=req.map_view,
        selected_bounds=req.selected_bounds,
    )
    return AnalysisSaveResponse(**result)


@router.get("/history", response_model=AnalysisHistoryResponse)
def get_analysis_history(
    current_user: User = Depends(allow_expert),
) -> AnalysisHistoryResponse:
    """
    List all past analyses for the current expert.
    """
    result = AnalysisService().get_user_history(current_user.id)
    return AnalysisHistoryResponse(**result)


@router.get("/{analysis_id}/export", response_model=AnalysisExportResponse)
def export_analysis(
    analysis_id: int,
    format: str = "geojson",
    current_user: User = Depends(allow_expert),
) -> AnalysisExportResponse:
    """
    Export analysis results as GeoJSON or PDF report data.
    """
    result = AnalysisService().export_results(user_id=current_user.id, analysis_id=analysis_id, format=format)
    return AnalysisExportResponse(**result)


@router.get("/reports/{report_id}/download")
def download_exported_report(
    report_id: int,
    current_user: User = Depends(allow_expert),
):
    payload = AnalysisService().get_report_download(user_id=current_user.id, report_id=report_id)
    media_type = "application/geo+json" if payload["format"] == "geojson" else "application/pdf"
    return FileResponse(
        path=payload["file_path"],
        media_type=media_type,
        filename=payload["file_path"].name,
    )


@router.post("/compare", response_model=AnalysisCompareResponse)
def compare_analysis_candidates(
    req: AnalysisCompareRequest,
    current_user: User = Depends(allow_expert),
) -> AnalysisCompareResponse:
    result = AnalysisService().compare_candidates(req.analysis_id, req.cell_indexes)
    return AnalysisCompareResponse(**result)


@router.post("/run")
def run_analysis_legacy(
    req: LegacyAnalysisRequest,
    current_user: User = Depends(allow_expert),
):
    """
    Backward-compatible alias for the prototype ExpertPage flow.
    Prefer POST /api/analysis.
    """
    return AnalysisService().run_ahp_topsis(req.region_id, req.criteria_weights)
