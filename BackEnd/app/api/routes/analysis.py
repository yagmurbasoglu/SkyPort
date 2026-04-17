from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict

from app.api.deps import RoleChecker
from app.models.user import User
from app.services.analysis_service import AnalysisService

router = APIRouter()
allow_expert = RoleChecker(["expert"])

class AnalysisRequest(BaseModel):
    region_id: str
    criteria_weights: Dict[str, float]

@router.post("/run")
def run_analysis(
    req: AnalysisRequest,
    current_user: User = Depends(allow_expert),
):
    """
    Run MCDM Analysis (AHP/TOPSIS).
    Access: Experts only.
    """
    analysis_svc = AnalysisService()
    result = analysis_svc.run_ahp_topsis(req.region_id, req.criteria_weights)
    
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
        
    return result

@router.get("/{analysis_id}/status")
def get_analysis_status(
    analysis_id: str,
    current_user: User = Depends(allow_expert),
):
    """
    Get status of an async analysis task.
    """
    # Mocking quick return for now
    return {
        "analysis_id": analysis_id,
        "status": "completed"
    }
