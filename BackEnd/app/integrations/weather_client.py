import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class OpenMeteoClient:
    def __init__(self, url: str) -> None:
        self.url = url

    def fetch_route_weather(
        self,
        *,
        latitude: float,
        longitude: float,
        timeout_sec: float,
        retry_count: int,
    ) -> dict[str, Any] | None:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": ",".join(
                [
                    "temperature_2m",
                    "precipitation",
                    "weather_code",
                    "visibility",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "wind_gusts_10m",
                    "wind_speed_80m",
                    "wind_direction_80m",
                    "wind_speed_120m",
                    "wind_direction_120m",
                ]
            ),
            "forecast_days": 1,
            "wind_speed_unit": "kmh",
            "timezone": "auto",
        }

        for attempt in range(1, max(retry_count, 1) + 1):
            try:
                logger.info(
                    "Fetching Open-Meteo route weather (attempt %s/%s) at %.5f, %.5f",
                    attempt,
                    retry_count,
                    latitude,
                    longitude,
                )
                response = httpx.get(
                    self.url,
                    params=params,
                    timeout=timeout_sec,
                    follow_redirects=True,
                    trust_env=False,
                )
                response.raise_for_status()
                body = response.json()
                return body if isinstance(body, dict) else None
            except Exception as exc:  # pragma: no cover - network dependent
                logger.warning("Open-Meteo fetch failed on attempt %s: %s", attempt, exc)
                if attempt < retry_count:
                    time.sleep(min(2 * attempt, 5))
        return None
