from datetime import datetime

from pydantic import BaseModel, Field


class FlightBookingCreateRequest(BaseModel):
    route_id: int | None = None
    from_vertiport_id: int = Field(..., gt=0)
    to_vertiport_id: int | None = Field(None, gt=0)
    flight_no: str = Field(..., min_length=1, max_length=40)
    gate: str | None = Field(None, max_length=12)
    departure_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    departure_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    passenger_count: int = Field(..., ge=1, le=2)


class FlightBookingCreateResponse(BaseModel):
    id: int
    route_id: int | None = None
    from_vertiport_id: int
    to_vertiport_id: int | None = None
    flight_no: str
    gate: str | None = None
    departure_date: str
    departure_time: str
    passenger_count: int
    created_at: datetime
    message: str


class FlightBookingSlotAvailabilityResponse(BaseModel):
    from_vertiport_id: int
    departure_date: str
    booked_slots: list[str]


class FlightBookingDeleteResponse(BaseModel):
    booking_id: int
    flight_no: str
    departure_date: str
    departure_time: str
    from_vertiport_id: int
    message: str
