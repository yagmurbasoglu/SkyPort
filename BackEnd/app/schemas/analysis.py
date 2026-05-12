from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


AnalysisStatus = Literal["pending", "running", "completed", "failed"]


class AnalysisCreateRequest(BaseModel):
    geodata_job_id: str = Field(..., min_length=1, max_length=32)
    region_name: str | None = Field(None, max_length=150)
    criteria_weights: dict[str, float]


class AnalysisCreateResponse(BaseModel):
    analysis_id: int
    status: AnalysisStatus
    message: str


class AnalysisRecalculateRequest(BaseModel):
    criteria_weights: dict[str, float]


class AnalysisSaveRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=160)
    map_view: dict | None = None
    selected_bounds: dict | None = None


class AnalysisSaveResponse(BaseModel):
    analysis_id: int
    saved_name: str
    saved_at: datetime
    message: str


class AnalysisStatusResponse(BaseModel):
    analysis_id: int
    status: AnalysisStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    message: str | None = None


class AnalysisSummary(BaseModel):
    cell_count: int
    average_score: float | None
    max_score: float | None
    min_score: float | None


class CandidateResult(BaseModel):
    rank: int | None = None
    cell_index: str
    suitability_score: float
    criteria_breakdown: dict


class AnalysisResultResponse(BaseModel):
    analysis_id: int
    status: AnalysisStatus
    region_name: str | None
    criteria_weights: dict
    mcdm: dict
    summary: AnalysisSummary
    top_candidates: list[CandidateResult]


class AnalysisHeatmapResponse(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[dict]


class AnalysisCellDetailResponse(BaseModel):
    analysis_id: int
    cell_index: str
    rank: int | None = None
    suitability_score: float
    score_class: str
    criteria_breakdown: dict
    geometry: dict | None = None


class AnalysisCompareRequest(BaseModel):
    analysis_id: int
    cell_indexes: list[str] = Field(..., min_length=2)


class AnalysisCompareResponse(BaseModel):
    analysis_id: int
    ranked_candidates: list[CandidateResult]


class AnalysisHistoryItem(BaseModel):
    analysis_id: int
    region_name: str | None
    status: AnalysisStatus
    created_at: datetime
    saved_name: str | None = None
    saved_at: datetime | None = None
    saved_payload: dict | None = None
    suitability_score: float | None = None


class AnalysisHistoryResponse(BaseModel):
    items: list[AnalysisHistoryItem]


class AnalysisExportResponse(BaseModel):
    report_id: int | None = None
    analysis_id: int
    format: str
    file_name: str | None = None
    download_url: str | None = None
    geojson: dict | None = None
    report: dict | None = None


class AnalysisReportItem(BaseModel):
    report_id: int
    analysis_id: int | None = None
    format: str
    file_name: str
    analysis_name: str | None = None
    created_at: datetime
    download_url: str


class AnalysisReportListResponse(BaseModel):
    items: list[AnalysisReportItem]


class AnalysisReportDeleteResponse(BaseModel):
    report_id: int
    file_name: str
    message: str
