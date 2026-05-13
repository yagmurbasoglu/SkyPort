from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import RoleChecker
from app.models.user import User
from app.repos.vertiport_repo import get_vertiport
from app.repos.vertiport_review_repo import list_user_reviews, upsert_review
from app.schemas.vertiport_review import (
    VertiportReviewCreateRequest,
    VertiportReviewCreateResponse,
    VertiportReviewListResponse,
)

router = APIRouter()
allow_passenger = RoleChecker(["passenger"])


@router.get("/me", response_model=VertiportReviewListResponse)
def get_my_vertiport_reviews(
    current_user: User = Depends(allow_passenger),
) -> VertiportReviewListResponse:
    return VertiportReviewListResponse(items=list_user_reviews(current_user.id))


@router.post("", response_model=VertiportReviewCreateResponse)
def create_vertiport_review(
    req: VertiportReviewCreateRequest,
    current_user: User = Depends(allow_passenger),
) -> VertiportReviewCreateResponse:
    vertiport = get_vertiport(req.vertiport_id)
    if vertiport is None or not vertiport.get("is_active"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vertiport not found")

    review = upsert_review(
        user_id=current_user.id,
        vertiport_id=req.vertiport_id,
        flight_no=req.flight_no.strip(),
        satisfaction_rating=req.satisfaction_rating,
        comfort_rating=req.comfort_rating,
    )
    if review is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This flight has already been reviewed for the selected vertiport.",
        )
    return VertiportReviewCreateResponse(**review, message="Review saved successfully.")
