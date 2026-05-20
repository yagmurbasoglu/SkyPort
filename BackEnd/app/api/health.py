from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.core.runtime import runtime_state
from app.db.session import SessionLocal
from app.schemas.health import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


def _health_payload() -> HealthResponse:
    settings = get_settings()
    maintenance = runtime_state.maintenance_snapshot()
    return HealthResponse(
        status="maintenance" if maintenance["enabled"] else "ok",
        service=settings.app_name,
        environment=settings.app_env,
        timestamp=datetime.now(timezone.utc),
        checks={"app": "ok"},
        maintenance=maintenance["enabled"],
    )


@router.get("/live", response_model=HealthResponse)
async def live() -> HealthResponse:
    return _health_payload()


@router.get("/ready", response_model=HealthResponse)
async def ready() -> HealthResponse:
    payload = _health_payload()
    checks = {"app": "ok"}
    status = "ok"

    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"
        status = "error"

    settings = get_settings()
    checks["weather_api"] = "configured" if settings.weather_enabled else "disabled"
    checks["notam_api"] = "configured" if settings.notam_enabled else "disabled"

    maintenance = runtime_state.maintenance_snapshot()
    if maintenance["enabled"] and status != "error":
        status = "maintenance"

    return HealthResponse(
        status=status,
        service=payload.service,
        environment=payload.environment,
        timestamp=payload.timestamp,
        checks=checks,
        maintenance=maintenance["enabled"],
    )
