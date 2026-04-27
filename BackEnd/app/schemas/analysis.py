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
    suitability_score: float | None = None


class AnalysisHistoryResponse(BaseModel):
    items: list[AnalysisHistoryItem]


class AnalysisExportResponse(BaseModel):
    analysis_id: int
    format: str
    download_url: str | None = None
    geojson: dict | None = None
    report: dict | None = None
