from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.flight_booking import FlightBooking


def _booking_to_dict(booking: FlightBooking) -> dict[str, Any]:
    return {
        "id": booking.id,
        "user_id": booking.user_id,
        "route_id": booking.route_id,
        "from_vertiport_id": booking.from_vertiport_id,
        "to_vertiport_id": booking.to_vertiport_id,
        "flight_no": booking.flight_no,
        "gate": booking.gate,
        "departure_date": booking.departure_date.isoformat(),
        "departure_time": booking.departure_time,
        "passenger_count": booking.passenger_count,
        "created_at": booking.created_at,
    }


def list_booked_slots(*, from_vertiport_id: int, departure_date: date) -> list[str]:
    with SessionLocal() as db:
        stmt = (
            select(FlightBooking.departure_time)
            .where(
                FlightBooking.from_vertiport_id == from_vertiport_id,
                FlightBooking.departure_date == departure_date,
            )
            .order_by(FlightBooking.departure_time.asc())
        )
        return [row[0] for row in db.execute(stmt).all()]


def create_booking(
    *,
    user_id: int,
    route_id: int | None,
    from_vertiport_id: int,
    to_vertiport_id: int | None,
    flight_no: str,
    gate: str | None,
    departure_date: date,
    departure_time: str,
    passenger_count: int,
) -> dict[str, Any] | None:
    with SessionLocal() as db:
        booking = FlightBooking(
            user_id=user_id,
            route_id=route_id,
            from_vertiport_id=from_vertiport_id,
            to_vertiport_id=to_vertiport_id,
            flight_no=flight_no,
            gate=gate,
            departure_date=departure_date,
            departure_time=departure_time,
            passenger_count=passenger_count,
        )
        db.add(booking)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return None
        db.refresh(booking)
        return _booking_to_dict(booking)


def delete_booking(*, booking_id: int, user_id: int) -> dict[str, Any] | None:
    with SessionLocal() as db:
        booking = db.get(FlightBooking, booking_id)
        if booking is None or booking.user_id != user_id:
            return None

        payload = _booking_to_dict(booking)
        db.delete(booking)
        db.commit()
        return payload
