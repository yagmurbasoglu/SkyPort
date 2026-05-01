from datetime import datetime
from typing import Any

from app.core.config import get_settings
from app.integrations.weather_client import OpenMeteoClient


def _fallback_weather(max_wind_kmh: float, warning: str | None = None) -> dict[str, Any]:
    fallback_wind_kmh = 12.0
    return {
        "source": "fallback",
        "condition": "standard",
        "wind_kmh": fallback_wind_kmh,
        "wind_direction_deg": None,
        "wind_gusts_kmh": None,
        "wind_80m_kmh": fallback_wind_kmh,
        "wind_80m_direction_deg": None,
        "wind_120m_kmh": fallback_wind_kmh,
        "wind_120m_direction_deg": None,
        "temperature_2m_c": None,
        "precipitation_mm": None,
        "visibility_m": None,
        "weather_code": None,
        "is_fallback": True,
        "is_safe": fallback_wind_kmh <= max_wind_kmh,
        "warning": warning or "Live weather data could not be obtained; standard conditions are applied.",
    }


def _route_midpoint(coordinates: list[list[float]]) -> tuple[float, float]:
    midpoint = coordinates[len(coordinates) // 2]
    return float(midpoint[1]), float(midpoint[0])


def _nearest_hour_index(times: list[str]) -> int:
    if not times:
        return 0
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    best_index = 0
    best_delta = None
    for index, value in enumerate(times):
        try:
            parsed = datetime.fromisoformat(value).replace(tzinfo=None)
        except ValueError:
            continue
        delta = abs((parsed - now).total_seconds())
        if best_delta is None or delta < best_delta:
            best_delta = delta
            best_index = index
    return best_index


def _value_at(hourly: dict[str, list[Any]], key: str, index: int) -> Any:
    values = hourly.get(key)
    if not values or index >= len(values):
        return None
    return values[index]


def _condition_from_weather_code(code: int | None) -> str:
    if code is None:
        return "unknown"
    if code == 0:
        return "clear"
    if code in {1, 2, 3}:
        return "cloudy"
    if code in {45, 48}:
        return "fog"
    if code in {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82}:
        return "rain"
    if code in {71, 73, 75, 77, 85, 86}:
        return "snow"
    if code in {95, 96, 99}:
        return "thunderstorm"
    return "unknown"

class WeatherService:
    def _fetch_weather_at(self, latitude: float, longitude: float, max_wind_kmh: float) -> dict[str, Any]:
        settings = get_settings()
        if not settings.weather_enabled:
            return _fallback_weather(
                max_wind_kmh,
                "Live weather integration is disabled; standard conditions are applied.",
            )

        client = OpenMeteoClient(settings.weather_api_url)
        body = client.fetch_route_weather(
            latitude=latitude,
            longitude=longitude,
            timeout_sec=settings.weather_timeout_sec,
            retry_count=settings.weather_retry_count,
        )
        if not body:
            return _fallback_weather(max_wind_kmh)

        hourly = body.get("hourly") or {}
        index = _nearest_hour_index(hourly.get("time") or [])
        wind_10m = _value_at(hourly, "wind_speed_10m", index)
        wind_80m = _value_at(hourly, "wind_speed_80m", index)
        wind_120m = _value_at(hourly, "wind_speed_120m", index)
        wind_gusts = _value_at(hourly, "wind_gusts_10m", index)
        weather_code = _value_at(hourly, "weather_code", index)
        wind_candidates = [value for value in [wind_10m, wind_80m, wind_120m, wind_gusts] if value is not None]
        if not wind_candidates:
            return _fallback_weather(
                max_wind_kmh,
                "Open-Meteo response did not include wind data; standard conditions are applied.",
            )

        max_observed_wind = float(max(wind_candidates))
        is_safe = max_observed_wind <= max_wind_kmh
        return {
            "source": "open_meteo",
            "condition": _condition_from_weather_code(int(weather_code) if weather_code is not None else None),
            "wind_kmh": float(wind_10m) if wind_10m is not None else max_observed_wind,
            "wind_direction_deg": _value_at(hourly, "wind_direction_10m", index),
            "wind_gusts_kmh": float(wind_gusts) if wind_gusts is not None else None,
            "wind_80m_kmh": float(wind_80m) if wind_80m is not None else None,
            "wind_80m_direction_deg": _value_at(hourly, "wind_direction_80m", index),
            "wind_120m_kmh": float(wind_120m) if wind_120m is not None else None,
            "wind_120m_direction_deg": _value_at(hourly, "wind_direction_120m", index),
            "temperature_2m_c": _value_at(hourly, "temperature_2m", index),
            "precipitation_mm": _value_at(hourly, "precipitation", index),
            "visibility_m": _value_at(hourly, "visibility", index),
            "weather_code": weather_code,
            "is_fallback": False,
            "is_safe": is_safe,
            "warning": None if is_safe else "Observed wind exceeds configured route safety limit.",
        }

    def get_point_weather(self, latitude: float, longitude: float, max_wind_kmh: float = 120.0) -> dict[str, Any]:
        return self._fetch_weather_at(float(latitude), float(longitude), max_wind_kmh)

    def get_route_weather(self, coordinates: list[list[float]], max_wind_kmh: float) -> dict[str, Any]:
        latitude, longitude = _route_midpoint(coordinates)
        return self._fetch_weather_at(latitude, longitude, max_wind_kmh)
