from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SkyPort Backend"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/skyport"
    notam_enabled: bool = False
    notam_api_url: str = "https://notams.aim.faa.gov/notamSearch/search"
    notam_locations: str = "LTBB,LTFM,LTBA,LTFJ"
    notam_poll_minutes: int = 15
    notam_timeout_sec: float = 30.0
    notam_retry_count: int = 3
    weather_enabled: bool = True
    weather_api_url: str = "https://api.open-meteo.com/v1/forecast"
    weather_timeout_sec: float = 5.0
    weather_retry_count: int = 2
    osmnx_use_cache: bool = True
    osmnx_timeout_sec: float = 30.0
    osmnx_overpass_timeout_sec: int | None = None
    osmnx_overpass_url: str | None = None
    osmnx_cache_folder: str | None = None
    ibb_traffic_enabled: bool = False
    ibb_traffic_geojson_path: str | None = None
    ibb_traffic_geojson_url: str | None = None
    ibb_traffic_timeout_sec: float = 10.0
    tuik_population_enabled: bool = False
    tuik_population_csv_path: str | None = None
    tuik_population_csv_url: str | None = None
    tuik_population_timeout_sec: float = 10.0

    # Security
    secret_key: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
