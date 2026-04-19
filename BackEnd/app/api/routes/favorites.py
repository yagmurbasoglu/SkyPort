from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import RoleChecker, get_db
from app.models.user import User
from app.repos.favorite_repo import add_favorite, remove_favorite, get_user_favorites

router = APIRouter()
allow_passenger = RoleChecker(["passenger", "expert"])

@router.get("", response_model=list[int])
def get_favorites(current_user: User = Depends(allow_passenger), db: Session = Depends(get_db)):
    """Returns the user's favorite vertiport IDs."""
    return get_user_favorites(db, current_user.id)

@router.post("/{vertiport_id}", response_model=dict)
def add_favorite_endpoint(vertiport_id: int, current_user: User = Depends(allow_passenger), db: Session = Depends(get_db)):
    """Adds a vertiport to the user's favorites."""
    add_favorite(db, current_user.id, vertiport_id)
    return {"message": "Added to favorites", "vertiport_id": vertiport_id}

@router.delete("/{vertiport_id}", response_model=dict)
def delete_favorite_endpoint(vertiport_id: int, current_user: User = Depends(allow_passenger), db: Session = Depends(get_db)):
    """Removes a vertiport from favorites."""
    remove_favorite(db, current_user.id, vertiport_id)
    return {"message": "Removed from favorites", "vertiport_id": vertiport_id}
