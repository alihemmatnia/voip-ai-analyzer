import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List

class JobResponse(BaseModel):
    job_id: str
    status: str
    job_type: Optional[str] = None
    filename: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AnalysisResultResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
