from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import RoleChecker
from app.models.user import User
from app.repos.flight_booking_repo import create_booking, delete_booking, list_booked_slots
from app.repos.vertiport_repo import get_vertiport
from app.schemas.flight_booking import (
    FlightBookingCreateRequest,
    FlightBookingCreateResponse,
    FlightBookingDeleteResponse,
    FlightBookingSlotAvailabilityResponse,
)

router = APIRouter()
allow_passenger = RoleChecker(["passenger"])


@router.get("/slots", response_model=FlightBookingSlotAvailabilityResponse)
def get_departure_slot_availability(
    from_vertiport_id: int = Query(..., gt=0),
    departure_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(allow_passenger),
) -> FlightBookingSlotAvailabilityResponse:
    vertiport = get_vertiport(from_vertiport_id)
    if vertiport is None or not vertiport.get("is_active"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vertiport not found")

    try:
        parsed_date = date.fromisoformat(departure_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid departure date") from exc

    return FlightBookingSlotAvailabilityResponse(
        from_vertiport_id=from_vertiport_id,
        departure_date=departure_date,
        booked_slots=list_booked_slots(from_vertiport_id=from_vertiport_id, departure_date=parsed_date),
    )


@router.post("", response_model=FlightBookingCreateResponse)
def create_flight_booking(
    req: FlightBookingCreateRequest,
    current_user: User = Depends(allow_passenger),
) -> FlightBookingCreateResponse:
    vertiport = get_vertiport(req.from_vertiport_id)
    if vertiport is None or not vertiport.get("is_active"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Departure vertiport not found")

    try:
        parsed_date = date.fromisoformat(req.departure_date)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid departure date") from exc

    booking = create_booking(
        user_id=current_user.id,
        route_id=req.route_id,
        from_vertiport_id=req.from_vertiport_id,
        to_vertiport_id=req.to_vertiport_id,
        flight_no=req.flight_no.strip(),
        gate=req.gate.strip() if req.gate else None,
        departure_date=parsed_date,
        departure_time=req.departure_time,
        passenger_count=req.passenger_count,
    )
    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This departure slot has just been booked. Please choose another time.",
        )

    return FlightBookingCreateResponse(**booking, message="Booking saved successfully.")


@router.delete("/{booking_id}", response_model=FlightBookingDeleteResponse)
def cancel_flight_booking(
    booking_id: int,
    current_user: User = Depends(allow_passenger),
) -> FlightBookingDeleteResponse:
    booking = delete_booking(booking_id=booking_id, user_id=current_user.id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    return FlightBookingDeleteResponse(
        booking_id=booking["id"],
        flight_no=booking["flight_no"],
        departure_date=booking["departure_date"],
        departure_time=booking["departure_time"],
        from_vertiport_id=booking["from_vertiport_id"],
        message="Booking cancelled and departure slot released.",
    )
