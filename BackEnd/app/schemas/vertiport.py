from pydantic import BaseModel


class VertiportResponse(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    suitability_score: float | None = None
    price_per_km: float | None = None
    description: str | None = None
    features: list[str] = []
    noise_level: str | None = None
    distance_from_center_km: float | None = None
    is_active: bool
