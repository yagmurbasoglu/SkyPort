from datetime import datetime

from pydantic import BaseModel, Field


class VertiportReviewCreateRequest(BaseModel):
    vertiport_id: int
    flight_no: str = Field(..., min_length=1, max_length=40)
    satisfaction_rating: int = Field(..., ge=1, le=5)
    comfort_rating: int = Field(..., ge=1, le=5)


class VertiportReviewItem(BaseModel):
    id: int
    user_id: int | None = None
    vertiport_id: int | None = None
    flight_no: str
    satisfaction_rating: int
    timing_rating: int
    comfort_rating: int
    overall_rating: float
    created_at: datetime
    updated_at: datetime


class VertiportReviewCreateResponse(VertiportReviewItem):
    message: str


class VertiportReviewListResponse(BaseModel):
    items: list[VertiportReviewItem]
