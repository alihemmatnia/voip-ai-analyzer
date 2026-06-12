import datetime
import json
import logging
from sqlalchemy.orm import Session
from db.database import SessionLocal
from models.job import Job, AnalysisResult
from parsers.pcap_parser import parse_pcap_file
from llm.llm_client import analyze_voip_summary_with_ai

logger = logging.getLogger("VoIPAnalyzer")

def process_voip_pcap_background(job_id: str, file_path: str):
    """
    Task worker that runs within a background thread.
    Parses the PCAP, executes AI-based analysis, and persists the findings.
    """
    db: Session = SessionLocal()
    try:
        logger.info(f"Background analysis started for Job: {job_id}")
        
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found in database context.")
            return
            
        job.status = "processing"
        db.commit()

        logger.info(f"Running PCAP parser for Job {job_id} at {file_path}")
        import os
        from core.security import decrypt_file
        temp_file_path = file_path + ".decrypted"
        if not decrypt_file(file_path, temp_file_path):
            raise Exception("Failed to decrypt PCAP file for analysis.")
            
        try:
            pcap_summary = parse_pcap_file(temp_file_path)
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
        logger.info(f"Requesting AI analysis for Job {job_id}")
        ai_analysis = analyze_voip_summary_with_ai(pcap_summary)
        
        complete_result = {
            "pcap_summary": pcap_summary,
            "ai_analysis": ai_analysis
        }
        
        db_result = AnalysisResult(
            job_id=job_id,
            result_json=json.dumps(complete_result)
        )
        db.add(db_result)
        
        # Pre-generate suggested chat questions
        try:
            from llm.llm_client import generate_suggested_questions
            from models.job import ChatSession
            questions = generate_suggested_questions(complete_result, "pcap")
            chat_session = ChatSession(
                analysis_id=job_id,
                suggested_questions=json.dumps(questions)
            )
            db.add(chat_session)
        except Exception as chat_err:
            logger.warning(f"Failed to initialize chat session in background for job {job_id}: {chat_err}")
        
        job.status = "completed"
        job.completed_at = datetime.datetime.utcnow()
        db.commit()
        logger.info(f"Job {job_id} completed successfully.")
        
    except Exception as e:
        logger.exception(f"Error handling job {job_id} inside background analyzer.")
        db.rollback()
        
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.datetime.utcnow()
            db.commit()
    finally:
        db.close()
