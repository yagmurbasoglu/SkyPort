from fastapi import APIRouter, Query

from app.schemas.geodata import AirspaceOverlayResponse, BoundingBox, IngestRequest, IngestResponse, IngestStatusResponse
from app.services.geodata_service import get_airspace_overlay, get_status, ingest

router = APIRouter(prefix="/geodata", tags=["geodata"])


@router.post("/ingest", response_model=IngestResponse)
async def ingest_geodata(req: IngestRequest) -> IngestResponse:
    result = ingest(req)
    return IngestResponse(**result)


@router.get("/ingest/{job_id}", response_model=IngestStatusResponse)
async def get_ingest_status(job_id: str) -> IngestStatusResponse:
    result = get_status(job_id)
    return IngestStatusResponse(**result)


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
