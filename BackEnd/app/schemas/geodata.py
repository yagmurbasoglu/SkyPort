from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    west: float = Field(..., ge=-180, le=180)
    east: float = Field(..., ge=-180, le=180)
    south: float = Field(..., ge=-90, le=90)
    north: float = Field(..., ge=-90, le=90)


class IngestRequest(BaseModel):
    region_name: str = Field(..., min_length=1, max_length=150)
    h3_resolution: int = Field(8, ge=0, le=15)
    bounding_box: BoundingBox


class IngestResponse(BaseModel):
    job_id: str
    status: Literal["success", "partial_success", "failed", "running"]
    warnings: list[str]
    layer_counts: dict[str, int]
    started_at: datetime
    finished_at: datetime | None


class IngestStatusResponse(BaseModel):
    job_id: str
    status: Literal["success", "partial_success", "failed", "running"]
    warnings: list[str]
    layer_counts: dict[str, int]
    started_at: datetime
    finished_at: datetime | None


class GeoFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[dict]


class IngestLayersResponse(BaseModel):
    job_id: str
    layer_counts: dict[str, int]
    buildings: GeoFeatureCollection
    roads: GeoFeatureCollection


class AirspaceOverlayResponse(BaseModel):
    type: Literal["FeatureCollection"]
    features: list[dict]
    summary: dict[str, int]


class WindOverlayResponse(BaseModel):
    source: str
    condition: str
    wind_kmh: float
    wind_direction_deg: float | None = None
    wind_gusts_kmh: float | None = None
    wind_80m_kmh: float | None = None
    wind_80m_direction_deg: float | None = None
    wind_120m_kmh: float | None = None
    wind_120m_direction_deg: float | None = None
    temperature_2m_c: float | None = None
    precipitation_mm: float | None = None
    visibility_m: float | None = None
    weather_code: int | None = None
    is_fallback: bool
    is_safe: bool
    warning: str | None = None
