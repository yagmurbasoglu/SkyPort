from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.health import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


def _health_payload() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        environment=settings.app_env,
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/live", response_model=HealthResponse)
async def live() -> HealthResponse:
    return _health_payload()


@router.get("/ready", response_model=HealthResponse)
async def ready() -> HealthResponse:
    return _health_payload()
