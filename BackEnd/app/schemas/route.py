from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


RouteStatus = Literal["simulated", "safe", "warning", "blocked", "unsafe", "weather_risk"]
SafetyStatus = Literal["safe", "warning", "blocked", "unsafe", "weather_risk"]


class RoutePoint(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: str | None = Field(None, max_length=150)


class RouteConstraints(BaseModel):
    avoid_nfz: bool = True
    avoid_obstacles: bool = True
    max_wind_kmh: float = Field(35.0, gt=0, le=120)


class RouteCreateRequest(BaseModel):
    from_vertiport_id: int | None = None
    to_vertiport_id: int | None = None
    from_point: RoutePoint | None = None
    to_point: RoutePoint | None = None
    constraints: RouteConstraints = Field(default_factory=RouteConstraints)

    @model_validator(mode="after")
    def validate_endpoint_pairs(self) -> "RouteCreateRequest":
        has_ids = self.from_vertiport_id is not None or self.to_vertiport_id is not None
        has_points = self.from_point is not None or self.to_point is not None
        if has_ids and has_points:
            raise ValueError("Use either vertiport ids or coordinate points, not both.")
        if has_ids and (self.from_vertiport_id is None or self.to_vertiport_id is None):
            raise ValueError("from_vertiport_id and to_vertiport_id must be provided together.")
        if has_points and (self.from_point is None or self.to_point is None):
            raise ValueError("from_point and to_point must be provided together.")
        if not has_ids and not has_points:
            raise ValueError("Route requires either vertiport ids or coordinate points.")
        return self


class RouteConflict(BaseModel):
    type: str
    severity: Literal["info", "warning", "blocker"]
    message: str
    zone_id: int | None = None
    zone_name: str | None = None
    route_progress: float | None = None
    block_point: list[float] | None = None


class WeatherSnapshot(BaseModel):
    source: str
    condition: str
    wind_kmh: float
    wind_direction_deg: float | None = None
    wind_gusts_kmh: float | None = None
    wind_80m_kmh: float | None = None
    wind_80m_direction_deg: float | None = None
    wind_120m_kmh: float | None = None
    wind_120m_direction_deg: float | None = None
    temperature_2m_c: float | None = None
    precipitation_mm: float | None = None
    visibility_m: float | None = None
    weather_code: int | None = None
    is_fallback: bool
    warning: str | None = None


class RouteResponse(BaseModel):
    route_id: int
    status: RouteStatus
    safety_status: SafetyStatus
    is_safe: bool
    obstacle_data_status: Literal["available", "missing"]
    obstacle_feature_count: int
    blocking_type: str | None = None
    blocking_reason: str | None = None
    stop_progress: float | None = None
    stop_point: list[float] | None = None
    coordinates: list[list[float]]
    distance_km: float
    duration_min: int
    price_tl: float
    from_point: RoutePoint
    to_point: RoutePoint
    weather: WeatherSnapshot
    conflicts: list[RouteConflict] = []
    warnings: list[str] = []
    created_at: datetime | None = None


class RouteSafetyResponse(BaseModel):
    route_id: int
    safety_status: SafetyStatus
    is_safe: bool
    obstacle_data_status: Literal["available", "missing"]
    obstacle_feature_count: int
    blocking_type: str | None = None
    blocking_reason: str | None = None
    stop_progress: float | None = None
    stop_point: list[float] | None = None
    conflicts: list[RouteConflict]
    warnings: list[str]


class RouteSimulationResponse(BaseModel):
    route_id: int
    status: RouteStatus
    safety_status: SafetyStatus
    obstacle_data_status: Literal["available", "missing"]
    obstacle_feature_count: int
    blocking_type: str | None = None
    blocking_reason: str | None = None
    stop_progress: float | None = None
    stop_point: list[float] | None = None
    distance_km: float
    duration_min: int
    price_tl: float
    weather: WeatherSnapshot
    warnings: list[str]
    geojson: dict
