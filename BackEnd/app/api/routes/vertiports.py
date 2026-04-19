from fastapi import APIRouter, Depends

from app.api.deps import RoleChecker
from app.models.user import User
from app.repos.vertiport_repo import list_active_vertiports
from app.schemas.vertiport import VertiportResponse

router = APIRouter()
allow_authenticated = RoleChecker(["expert", "passenger"])


@router.get("", response_model=list[VertiportResponse])
def list_vertiports(
    current_user: User = Depends(allow_authenticated),
) -> list[VertiportResponse]:
    _ = current_user
    return [VertiportResponse(**item) for item in list_active_vertiports()]
