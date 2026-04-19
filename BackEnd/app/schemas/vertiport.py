from pydantic import BaseModel


class VertiportResponse(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    suitability_score: float | None = None
    price_per_km: float | None = None
    description: str | None = None
    is_active: bool
