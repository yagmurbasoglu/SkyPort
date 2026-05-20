from fastapi import APIRouter, Query

from app.schemas.geodata import (
    AirspaceOverlayResponse,
    BoundingBox,
    IngestLayersResponse,
    IngestRequest,
    IngestResponse,
    IngestStatusResponse,
    WindOverlayResponse,
)
from app.services.geodata_service import get_airspace_overlay, get_layers, get_status, ingest, pause_ingest_job, resume_ingest_job
from app.services.weather_service import WeatherService

router = APIRouter(prefix="/geodata", tags=["geodata"])
weather_service = WeatherService()


@router.post("/ingest", response_model=IngestResponse)
async def ingest_geodata(req: IngestRequest) -> IngestResponse:
    result = ingest(req)
    return IngestResponse(**result)


@router.get("/ingest/{job_id}", response_model=IngestStatusResponse)
async def get_ingest_status(job_id: str) -> IngestStatusResponse:
    result = get_status(job_id)
    return IngestStatusResponse(**result)


@router.post("/ingest/{job_id}/pause", response_model=IngestStatusResponse)
async def pause_ingest(job_id: str) -> IngestStatusResponse:
    result = pause_ingest_job(job_id)
    return IngestStatusResponse(**result)


@router.post("/ingest/{job_id}/resume", response_model=IngestStatusResponse)
async def resume_ingest(job_id: str) -> IngestStatusResponse:
    result = resume_ingest_job(job_id)
    return IngestStatusResponse(**result)


@router.get("/ingest/{job_id}/layers", response_model=IngestLayersResponse)
async def get_ingest_layers(job_id: str) -> IngestLayersResponse:
    result = get_layers(job_id)
    return IngestLayersResponse(**result)


@router.get("/airspace", response_model=AirspaceOverlayResponse)
async def get_airspace(
    west: float = Query(..., ge=-180, le=180),
    east: float = Query(..., ge=-180, le=180),
    south: float = Query(..., ge=-90, le=90),
    north: float = Query(..., ge=-90, le=90),
) -> AirspaceOverlayResponse:
    bbox = BoundingBox(west=west, east=east, south=south, north=north)
    result = get_airspace_overlay(bbox)
    return AirspaceOverlayResponse(**result)


@router.get("/wind", response_model=WindOverlayResponse)
async def get_wind_overlay(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> WindOverlayResponse:
    result = weather_service.get_point_weather(latitude=lat, longitude=lng)
    return WindOverlayResponse(**result)
