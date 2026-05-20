from fastapi import APIRouter, Depends

from app.api.deps import RoleChecker
from app.models.user import User
from app.schemas.route import (
    RouteCreateRequest,
    RouteResponse,
    RouteSafetyResponse,
    RouteSimulationResponse,
)
from app.services.app_facade import AppFacade

router = APIRouter()
allow_authenticated = RoleChecker(["expert", "passenger"])


@router.post("", response_model=RouteResponse)
def create_route(
    req: RouteCreateRequest,
    current_user: User = Depends(allow_authenticated),
) -> RouteResponse:
    result = AppFacade(current_user).route.create_route(user_id=current_user.id, req=req)
    return RouteResponse(**result)


@router.post("/{route_id}/safety-check", response_model=RouteSafetyResponse)
def run_route_safety_check(
    route_id: int,
    current_user: User = Depends(allow_authenticated),
) -> RouteSafetyResponse:
    result = AppFacade(current_user).route.evaluate_safety(route_id, user_id=current_user.id)
    return RouteSafetyResponse(**result)


@router.get("/{route_id}/simulation", response_model=RouteSimulationResponse)
def get_route_simulation(
    route_id: int,
    current_user: User = Depends(allow_authenticated),
) -> RouteSimulationResponse:
    result = AppFacade(current_user).route.get_simulation(route_id, user_id=current_user.id)
    return RouteSimulationResponse(**result)
