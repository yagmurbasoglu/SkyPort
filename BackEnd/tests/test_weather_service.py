from app.integrations.weather_client import OpenMeteoClient
from app.services.weather_service import WeatherService


def _coordinates() -> list[list[float]]:
    return [[28.985, 41.0369], [29.0151, 41.022]]


def test_weather_service_parses_open_meteo_winds(monkeypatch) -> None:
    def fake_fetch(self, **_kwargs):
        return {
            "hourly": {
                "time": ["2026-04-18T12:00"],
                "temperature_2m": [18.5],
                "precipitation": [0.0],
                "weather_code": [2],
                "visibility": [20000],
                "wind_speed_10m": [14.0],
                "wind_direction_10m": [45],
                "wind_gusts_10m": [21.0],
                "wind_speed_80m": [26.0],
                "wind_direction_80m": [60],
                "wind_speed_120m": [31.0],
                "wind_direction_120m": [70],
            }
        }

    monkeypatch.setattr(OpenMeteoClient, "fetch_route_weather", fake_fetch)

    weather = WeatherService().get_route_weather(_coordinates(), max_wind_kmh=35)

    assert weather["source"] == "open_meteo"
    assert weather["condition"] == "cloudy"
    assert weather["wind_kmh"] == 14.0
    assert weather["wind_80m_kmh"] == 26.0
    assert weather["wind_120m_kmh"] == 31.0
    assert weather["is_safe"] is True
    assert weather["is_fallback"] is False


def test_weather_service_falls_back_when_open_meteo_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(OpenMeteoClient, "fetch_route_weather", lambda _self, **_kwargs: None)

    weather = WeatherService().get_route_weather(_coordinates(), max_wind_kmh=35)

    assert weather["source"] == "fallback"
    assert weather["wind_120m_kmh"] == 12.0
    assert weather["is_safe"] is True
    assert weather["warning"]


def test_weather_service_flags_high_altitude_wind_risk(monkeypatch) -> None:
    def fake_fetch(self, **_kwargs):
        return {
            "hourly": {
                "time": ["2026-04-18T12:00"],
                "wind_speed_10m": [18.0],
                "wind_gusts_10m": [22.0],
                "wind_speed_80m": [38.0],
                "wind_speed_120m": [44.0],
            }
        }

    monkeypatch.setattr(OpenMeteoClient, "fetch_route_weather", fake_fetch)

    weather = WeatherService().get_route_weather(_coordinates(), max_wind_kmh=35)

    assert weather["source"] == "open_meteo"
    assert weather["wind_120m_kmh"] == 44.0
    assert weather["is_safe"] is False
    assert weather["warning"] == "Observed wind exceeds configured route safety limit."
