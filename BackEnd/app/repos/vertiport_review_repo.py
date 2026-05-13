from typing import Any

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.vertiport_review import VertiportReview


def _review_to_dict(review: VertiportReview) -> dict[str, Any]:
    overall_rating = round(
        (review.satisfaction_rating + review.comfort_rating) / 2.0,
        2,
    )
    return {
        "id": review.id,
        "user_id": review.user_id,
        "vertiport_id": review.vertiport_id,
        "flight_no": review.flight_no,
        "satisfaction_rating": review.satisfaction_rating,
        "timing_rating": review.timing_rating,
        "comfort_rating": review.comfort_rating,
        "overall_rating": overall_rating,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


def list_user_reviews(user_id: int) -> list[dict[str, Any]]:
    with SessionLocal() as db:
        stmt = select(VertiportReview).where(VertiportReview.user_id == user_id).order_by(VertiportReview.updated_at.desc())
        return [_review_to_dict(row) for row in db.execute(stmt).scalars().all()]


def get_user_review_for_flight(user_id: int, flight_no: str, vertiport_id: int) -> dict[str, Any] | None:
    with SessionLocal() as db:
        stmt = select(VertiportReview).where(
            VertiportReview.user_id == user_id,
            VertiportReview.flight_no == flight_no,
            VertiportReview.vertiport_id == vertiport_id,
        )
        review = db.execute(stmt).scalar_one_or_none()
        return _review_to_dict(review) if review else None


def upsert_review(
    *,
    user_id: int,
    vertiport_id: int,
    flight_no: str,
    satisfaction_rating: int,
    comfort_rating: int,
) -> dict[str, Any] | None:
    with SessionLocal() as db:
        stmt = select(VertiportReview).where(
            VertiportReview.user_id == user_id,
            VertiportReview.flight_no == flight_no,
            VertiportReview.vertiport_id == vertiport_id,
        )
        review = db.execute(stmt).scalar_one_or_none()
        if review is not None:
            return None
        review = VertiportReview(
            user_id=user_id,
            vertiport_id=vertiport_id,
            flight_no=flight_no,
            satisfaction_rating=satisfaction_rating,
            timing_rating=comfort_rating,
            comfort_rating=comfort_rating,
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        return _review_to_dict(review)
