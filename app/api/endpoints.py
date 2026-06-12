import os
import uuid
import datetime
import json
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from db.database import get_db
from models.job import Job, AnalysisResult, LogAnalysisResult, ChatSession, ChatMessage
from schemas.job import JobResponse, AnalysisResultResponse
from core.config import settings
from services.analyzer import process_voip_pcap_background
from log_analyzers.service import process_voip_log_background
from pydantic import BaseModel
from typing import Optional

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
        raw_file_path = file_path + ".raw"
        with open(raw_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            
        # Encrypt the raw file to the final destination and remove the raw file
        from core.security import encrypt_file
        if not encrypt_file(raw_file_path, file_path):
            raise Exception("Encryption engine failed to secure the file.")
        
        os.remove(raw_file_path)
    except Exception as e:
        if os.path.exists(raw_file_path):
            os.remove(raw_file_path)
        raise HTTPException(status_code=500, detail=f"Failed to record PCAP to system block storage: {str(e)}")

    job_record = Job(
        id=job_id,
        filename=filename,
        job_type="pcap",
        status="queued"
    )
    db.add(job_record)
    db.commit()
    db.refresh(job_record)

    background_tasks.add_task(process_voip_pcap_background, job_id, file_path)

    return JobResponse(
        job_id=job_record.id,
        status=job_record.status,
        job_type=job_record.job_type,
        filename=job_record.filename,
        created_at=job_record.created_at
    )


@router.post("/logs/upload", response_model=JobResponse)
async def upload_log(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    filename = os.path.basename(file.filename or "uploaded_log.log")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".log", ".txt"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file extension. Please upload a .log or .txt file."
        )

    job_id = str(uuid.uuid4())
    safe_filename = f"{job_id}_{filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    try:
        raw_file_path = file_path + ".raw"
        with open(raw_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            
        # Encrypt the raw file to the final destination and remove the raw file
        from core.security import encrypt_file
        if not encrypt_file(raw_file_path, file_path):
            raise Exception("Encryption engine failed to secure the file.")
            
        os.remove(raw_file_path)
    except Exception as e:
        if os.path.exists(raw_file_path):
            os.remove(raw_file_path)
        raise HTTPException(status_code=500, detail=f"Failed to save log file: {str(e)}")

    job_record = Job(
        id=job_id,
        filename=filename,
        job_type="log",
        status="queued"
    )
    db.add(job_record)
    db.commit()
    db.refresh(job_record)

    background_tasks.add_task(process_voip_log_background, job_id, file_path)

    return JobResponse(
        job_id=job_record.id,
        status=job_record.status,
        job_type=job_record.job_type,
        filename=job_record.filename,
        created_at=job_record.created_at
    )


@router.get("/logs/results/{job_id}", response_model=AnalysisResultResponse)
def get_log_results(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Log analysis job not found.")

    if job.job_type != "log":
        raise HTTPException(status_code=400, detail="Requested job is not a log analysis job.")

    if job.status != "completed":
        return AnalysisResultResponse(
            job_id=job.id,
            status=job.status,
            result=None,
            error_message=job.error_message
        )

    result_record = db.query(LogAnalysisResult).filter(LogAnalysisResult.job_id == job_id).first()
    if not result_record:
        raise HTTPException(status_code=404, detail="Log analysis result not found.")

    try:
        parsed_result = json.loads(result_record.summary_json)
    except Exception:
        raise HTTPException(status_code=500, detail="Corrupted log analysis record in database.")

    return AnalysisResultResponse(
        job_id=job.id,
        status=job.status,
        result=parsed_result
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
            job_type=j.job_type,
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
        job_type=job.job_type,
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


@router.get("/results/{job_id}/audio/{ssrc}")
def get_job_audio(job_id: str, ssrc: str, codec: str = "PCMU", db: Session = Depends(get_db)):
    """
    Extracts RTP payloads for a given SSRC, decodes them, and returns a playable WAV file.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="VoIP analysis job not found.")
    
    if job.job_type != "pcap":
        raise HTTPException(status_code=400, detail="Audio extraction is only available for PCAP files.")
        
    safe_filename = f"{job_id}_{job.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Original PCAP file not found on disk.")
        
    from parsers.audio_extractor import extract_audio_from_pcap
    from core.security import decrypt_file
    
    temp_file_path = file_path + ".decrypted"
    if not decrypt_file(file_path, temp_file_path):
        raise HTTPException(status_code=500, detail="Failed to decrypt PCAP file for audio extraction.")
        
    try:
        wav_bytes = extract_audio_from_pcap(temp_file_path, ssrc, codec)
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
    
    if not wav_bytes:
        raise HTTPException(status_code=400, detail="Failed to extract audio or unsupported codec.")
        
    return Response(content=wav_bytes, media_type="audio/wav")


class ChatRequest(BaseModel):
    message: str
    mode: Optional[str] = "expert"


@router.post("/analysis/{analysis_id}/chat")
def post_analysis_chat(
    analysis_id: str,
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == analysis_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
        
    if job.status != "completed":
        raise HTTPException(status_code=400, detail="Cannot chat about an analysis that has not completed.")

    # Self-healing Session Initializer
    session = db.query(ChatSession).filter(ChatSession.analysis_id == analysis_id).first()
    if not session:
        # Load results to generate questions
        from llm.llm_client import generate_suggested_questions
        result_json = {}
        if job.job_type == "pcap":
            res_rec = db.query(AnalysisResult).filter(AnalysisResult.job_id == analysis_id).first()
            if res_rec:
                result_json = json.loads(res_rec.result_json)
        else:
            res_rec = db.query(LogAnalysisResult).filter(LogAnalysisResult.job_id == analysis_id).first()
            if res_rec:
                result_json = json.loads(res_rec.summary_json)
                
        questions = generate_suggested_questions(result_json, job.job_type)
        session = ChatSession(
            analysis_id=analysis_id,
            suggested_questions=json.dumps(questions)
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # 1. Build context package
    context = {}
    if job.job_type == "pcap":
        res_rec = db.query(AnalysisResult).filter(AnalysisResult.job_id == analysis_id).first()
        if res_rec:
            try:
                full_data = json.loads(res_rec.result_json)
                pcap_summary = full_data.get("pcap_summary", {})
                ai_analysis = full_data.get("ai_analysis", {})
                
                context = {
                    "root_causes": ai_analysis.get("root_causes", []),
                    "critical_findings": ai_analysis.get("critical_findings", []),
                    "detected_issues": ai_analysis.get("detected_issues", []),
                    "timeline": pcap_summary.get("call_flow_ladder", []),
                    "health_scores": {
                        "call_quality_score": pcap_summary.get("call_quality_score"),
                        "media_stability_score": pcap_summary.get("media_stability_score"),
                        "packet_loss_percent": pcap_summary.get("packet_loss_percent"),
                        "avg_jitter_ms": pcap_summary.get("avg_jitter_ms")
                    },
                    "recommendations": ai_analysis.get("recommendations", []),
                    "raw_summary_data": pcap_summary
                }
            except Exception:
                raise HTTPException(status_code=500, detail="Corrupted PCAP result record.")
    else:
        res_rec = db.query(LogAnalysisResult).filter(LogAnalysisResult.job_id == analysis_id).first()
        if res_rec:
            try:
                full_data = json.loads(res_rec.summary_json)
                log_summary = full_data.get("log_summary", {})
                ai_analysis = full_data.get("ai_analysis", {})
                
                context = {
                    "root_causes": ai_analysis.get("root_causes", []),
                    "critical_findings": ai_analysis.get("critical_findings", []),
                    "timeline": ai_analysis.get("incident_timeline", []) or log_summary.get("call_flow_ladder", []),
                    "health_scores": ai_analysis.get("health_scores", {}),
                    "affected_services": ai_analysis.get("affected_services", []),
                    "recommendations": ai_analysis.get("recommendations", {}),
                    "raw_summary_data": log_summary
                }
            except Exception:
                raise HTTPException(status_code=500, detail="Corrupted Log result record.")

    # 2. Query chat session history
    past_messages = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc()).all()
    history = [{"role": msg.role, "content": msg.content} for msg in past_messages]

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=payload.message
    )
    db.add(user_msg)
    
    # Append the new user message to history context
    history.append({"role": "user", "content": payload.message})

    # 3. Call LLM to get answer
    from llm.llm_client import answer_analysis_chat_message
    assistant_reply = answer_analysis_chat_message(
        chat_history=history,
        analysis_context=context,
        mode=payload.mode or "expert"
    )

    # Save assistant response
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=assistant_reply
    )
    db.add(assistant_msg)
    db.commit()

    return {"response": assistant_reply}


@router.get("/analysis/{analysis_id}/chat/history")
def get_analysis_chat_history(
    analysis_id: str,
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == analysis_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")

    session = db.query(ChatSession).filter(ChatSession.analysis_id == analysis_id).first()
    
    # Self-healing Session Initializer
    if not session:
        result_json = {}
        if job.status == "completed":
            if job.job_type == "pcap":
                res_rec = db.query(AnalysisResult).filter(AnalysisResult.job_id == analysis_id).first()
                if res_rec:
                    result_json = json.loads(res_rec.result_json)
            else:
                res_rec = db.query(LogAnalysisResult).filter(LogAnalysisResult.job_id == analysis_id).first()
                if res_rec:
                    result_json = json.loads(res_rec.summary_json)
                    
        from llm.llm_client import generate_suggested_questions
        questions = generate_suggested_questions(result_json, job.job_type)
        session = ChatSession(
            analysis_id=analysis_id,
            suggested_questions=json.dumps(questions)
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Get messages
    past_messages = db.query(ChatMessage).filter(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc()).all()
    
    try:
        suggested = json.loads(session.suggested_questions) if session.suggested_questions else []
    except Exception:
        suggested = []

    return {
        "session_id": session.id,
        "suggested_questions": suggested,
        "history": [
            {
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat()
            }
            for msg in past_messages
        ]
    }
