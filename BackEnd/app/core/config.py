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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
