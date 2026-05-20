from fastapi import APIRouter, Depends

from app.api.deps import RoleChecker
from app.core.runtime import runtime_state
from app.models.user import User
from app.schemas.system import MaintenanceState, MaintenanceUpdateRequest, SystemMetricsResponse

router = APIRouter()
allow_expert = RoleChecker(["expert"])


@router.get("/maintenance", response_model=MaintenanceState)
def get_maintenance_state(
    current_user: User = Depends(allow_expert),
) -> MaintenanceState:
    _ = current_user
    return MaintenanceState(**runtime_state.maintenance_snapshot())


@router.post("/maintenance", response_model=MaintenanceState)
def update_maintenance_state(
    req: MaintenanceUpdateRequest,
    current_user: User = Depends(allow_expert),
) -> MaintenanceState:
    _ = current_user
    return MaintenanceState(**runtime_state.set_maintenance(req.enabled, req.message))


@router.get("/metrics", response_model=SystemMetricsResponse)
def get_system_metrics(
    current_user: User = Depends(allow_expert),
) -> SystemMetricsResponse:
    _ = current_user
    return SystemMetricsResponse(**runtime_state.metrics_snapshot())
