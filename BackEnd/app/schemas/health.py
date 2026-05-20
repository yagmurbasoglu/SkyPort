from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "maintenance", "error"]
    service: str
    environment: str
    timestamp: datetime
    checks: dict[str, str] = {}
    maintenance: bool = False
