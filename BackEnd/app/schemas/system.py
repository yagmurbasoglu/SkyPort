from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class MaintenanceState(BaseModel):
    enabled: bool
    message: str
    since: datetime | None = None


class MaintenanceUpdateRequest(BaseModel):
    enabled: bool
    message: str | None = None


class SystemMetricsResponse(BaseModel):
    maintenance: MaintenanceState
    request_counts: dict[str, int]
    status_counts: dict[int, int]
    average_latency_ms: float
    sample_count: int
    active_jobs: dict
