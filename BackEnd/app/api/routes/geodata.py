from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import RoleChecker
from app.models.user import User
from app.services.osm_service import OSMService
from app.services.h3_service import H3Service

router = APIRouter()
allow_expert = RoleChecker(["expert"])

class BoundingBox(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float

class GridRequest(BaseModel):
    center_lat: float
    center_lon: float
    resolution: int
    radius_km: float = 5.0

@router.post("/extract-osm")
async def extract_osm_data(
    bbox: BoundingBox,
    current_user: User = Depends(allow_expert),
):
    """
    Extract OpenStreetMap data for a given bounding box.
    Access: Experts only.
    """
    osm_service = OSMService()
    result = await osm_service.extract_osm_data(
        bbox.min_lat, bbox.min_lon, bbox.max_lat, bbox.max_lon
    )
    
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
        
    return result

@router.post("/generate-grid")
def generate_h3_grid(
    req: GridRequest,
    current_user: User = Depends(allow_expert),
):
    """
    Generate H3 Grid layout for analysis.
    Access: Experts only.
    """
    h3_service = H3Service()
    return h3_service.generate_h3_grid(
        lat=req.center_lat,
        lon=req.center_lon,
        resolution=req.resolution,
        radius_km=req.radius_km
    )
