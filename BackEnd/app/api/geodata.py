from fastapi import APIRouter

from app.schemas.geodata import IngestRequest, IngestResponse, IngestStatusResponse
from app.services.geodata_service import get_status, ingest

router = APIRouter(prefix="/geodata", tags=["geodata"])


@router.post("/ingest", response_model=IngestResponse)
async def ingest_geodata(req: IngestRequest) -> IngestResponse:
    result = ingest(req)
    return IngestResponse(**result)


@router.get("/ingest/{job_id}", response_model=IngestStatusResponse)
async def get_ingest_status(job_id: str) -> IngestStatusResponse:
    result = get_status(job_id)
    return IngestStatusResponse(**result)
