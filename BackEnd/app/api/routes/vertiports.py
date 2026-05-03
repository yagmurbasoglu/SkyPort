from fastapi import APIRouter, Depends

from app.api.deps import RoleChecker
from app.models.user import User
from app.repos.vertiport_repo import list_active_vertiports
from app.schemas.vertiport import VertiportResponse

router = APIRouter()
allow_authenticated = RoleChecker(["expert", "passenger"])


@router.get("", response_model=list[VertiportResponse])
def list_vertiports(
    min_score: float | None = None,
    max_price: float | None = None,
    max_distance_km: float | None = None,
    center_lat: float | None = None,
    center_lng: float | None = None,
    low_noise: bool = False,
    metro: bool = False,
    parking: bool = False,
    ev_charging: bool = False,
    current_user: User = Depends(allow_authenticated),
) -> list[VertiportResponse]:
    _ = current_user
    return [
        VertiportResponse(**item)
        for item in list_active_vertiports(
            min_score=min_score,
            max_price=max_price,
            max_distance_km=max_distance_km,
            center_lat=center_lat,
            center_lng=center_lng,
            low_noise=low_noise,
            metro=metro,
            parking=parking,
            ev_charging=ev_charging,
        )
    ]
