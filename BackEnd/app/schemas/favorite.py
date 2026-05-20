from datetime import datetime
from typing import Literal

from pydantic import BaseModel


FavoriteLabel = Literal["standard", "home", "work"]


class FavoriteItem(BaseModel):
    vertiport_id: int
    label: FavoriteLabel = "standard"
    created_at: datetime | None = None


class FavoriteUpdateRequest(BaseModel):
    label: FavoriteLabel = "standard"


class FavoriteUpdateResponse(BaseModel):
    message: str
    vertiport_id: int
    label: FavoriteLabel
