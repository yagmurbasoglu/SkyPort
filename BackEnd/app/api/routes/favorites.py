from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import RoleChecker, get_db
from app.models.user import User
from app.repos.favorite_repo import add_favorite, remove_favorite, get_user_favorites
from app.schemas.favorite import FavoriteItem, FavoriteUpdateRequest, FavoriteUpdateResponse
from app.services.app_facade import AppFacade

router = APIRouter()
allow_passenger = RoleChecker(["passenger"])

@router.get("", response_model=list[FavoriteItem])
def get_favorites(current_user: User = Depends(allow_passenger), db: Session = Depends(get_db)):
    """Returns the user's favorite vertiport IDs."""
    _ = AppFacade(current_user).validate_session()
    return get_user_favorites(db, current_user.id)

@router.post("/{vertiport_id}", response_model=FavoriteUpdateResponse)
def add_favorite_endpoint(
    vertiport_id: int,
    req: FavoriteUpdateRequest | None = None,
    current_user: User = Depends(allow_passenger),
    db: Session = Depends(get_db),
):
    """Adds a vertiport to the user's favorites."""
    _ = AppFacade(current_user).validate_session()
    add_favorite(db, current_user.id, vertiport_id, label=(req.label if req else "standard"))
    return FavoriteUpdateResponse(
        message="Added to favorites",
        vertiport_id=vertiport_id,
        label=req.label if req else "standard",
    )

@router.delete("/{vertiport_id}", response_model=FavoriteUpdateResponse)
def delete_favorite_endpoint(vertiport_id: int, current_user: User = Depends(allow_passenger), db: Session = Depends(get_db)):
    """Removes a vertiport from favorites."""
    _ = AppFacade(current_user).validate_session()
    remove_favorite(db, current_user.id, vertiport_id)
    return FavoriteUpdateResponse(message="Removed from favorites", vertiport_id=vertiport_id, label="standard")
