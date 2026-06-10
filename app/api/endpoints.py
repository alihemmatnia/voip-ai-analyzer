import os
import uuid
import datetime
import json
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from db.database import get_db
from models.job import Job, AnalysisResult
from schemas.job import JobResponse, AnalysisResultResponse
from core.config import settings
from services.analyzer import process_voip_pcap_background

router = APIRouter(prefix="/v1")

@router.post("/upload", response_model=JobResponse)
async def upload_pcap(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Receives a PCAP file via multipart/form-data, creates an analysis job record,
    launches background signal processing, and returns immediately with queue status.
    """
    filename = os.path.basename(file.filename or "uploaded_trace.pcap")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".pcap", ".pcapng", ".cap"]:
        raise HTTPException(
            status_code=400, 
            detail="Unsupported file extension. Please upload a .pcap, .pcapng, or .cap file."
        )

    job_id = str(uuid.uuid4())
    safe_filename = f"{job_id}_{filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record PCAP to system block storage: {str(e)}")

    job_record = Job(
        id=job_id,
        filename=filename,
        status="queued"
    )
    db.add(job_record)
    db.commit()
    db.refresh(job_record)

    background_tasks.add_task(process_voip_pcap_background, job_id, file_path)

    return JobResponse(
        job_id=job_record.id,
        status=job_record.status,
        filename=job_record.filename,
        created_at=job_record.created_at
    )


@router.get("/jobs", response_model=List[JobResponse])
def list_jobs(db: Session = Depends(get_db)):
    """
    Lists the recent jobs sorted by creation date for UI dashboard listing.
    """
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return [
        JobResponse(
            job_id=j.id,
            status=j.status,
            filename=j.filename,
            error_message=j.error_message,
            created_at=j.created_at,
            completed_at=j.completed_at
        ) for j in jobs
    ]


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the status information of an active or historically completed job.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="VoIP analysis job not found.")
        
    return JobResponse(
        job_id=job.id,
        status=job.status,
        filename=job.filename,
        error_message=job.error_message,
        created_at=job.created_at,
        completed_at=job.completed_at
    )


@router.get("/results/{job_id}", response_model=AnalysisResultResponse)
def get_job_results(job_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the complete JSON payload of PCAP packet statistics and the corresponding AI diagnostic report.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="VoIP analysis job not found.")

    if job.status != "completed":
        return AnalysisResultResponse(
            job_id=job.id,
            status=job.status,
            result=None,
            error_message=job.error_message
        )

    result_record = db.query(AnalysisResult).filter(AnalysisResult.job_id == job_id).first()
    if not result_record:
        raise HTTPException(status_code=404, detail="Analytical findings result stream not found.")

    try:
        parsed_result = json.loads(result_record.result_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Corrupted system representation stored in SQLite db.")

    return AnalysisResultResponse(
        job_id=job.id,
        status=job.status,
        result=parsed_result
    )
