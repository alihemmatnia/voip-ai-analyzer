import datetime
import json
import logging
from sqlalchemy.orm import Session
from db.database import SessionLocal
from models.job import Job, LogAnalysisResult
from .parser import parse_log_file
from llm.llm_client import analyze_voip_log_summary_with_ai

logger = logging.getLogger("VoIPAnalyzer")


def process_voip_log_background(job_id: str, file_path: str):
    db: Session = SessionLocal()
    try:
        logger.info(f"Background log analysis started for Job: {job_id}")

        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Log analysis job {job_id} not found in database context.")
            return

        job.status = "processing"
        db.commit()

        import os
        from core.security import decrypt_file
        temp_file_path = file_path + ".decrypted"
        if not decrypt_file(file_path, temp_file_path):
            raise Exception("Failed to decrypt log file for analysis.")
            
        try:
            log_summary = parse_log_file(temp_file_path)
        finally:
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
        # Optimize size for LLM prompt context while saving full parsed lines in DB
        ai_input_summary = log_summary.copy()
        if "matched_lines" in ai_input_summary:
            ai_input_summary["matched_lines"] = ai_input_summary["matched_lines"][:150]
            
        ai_analysis = analyze_voip_log_summary_with_ai(ai_input_summary)

        combined_result = {
            "log_summary": log_summary,
            "ai_analysis": ai_analysis,
        }

        db_result = LogAnalysisResult(
            job_id=job_id,
            detected_platform=log_summary.get("platform", "Unknown"),
            summary_json=json.dumps(combined_result),
        )
        db.add(db_result)

        # Pre-generate suggested chat questions
        try:
            from llm.llm_client import generate_suggested_questions
            from models.job import ChatSession
            questions = generate_suggested_questions(combined_result, "log")
            chat_session = ChatSession(
                analysis_id=job_id,
                suggested_questions=json.dumps(questions)
            )
            db.add(chat_session)
        except Exception as chat_err:
            logger.warning(f"Failed to initialize chat session in background for log job {job_id}: {chat_err}")

        job.status = "completed"
        job.completed_at = datetime.datetime.utcnow()
        db.commit()
        logger.info(f"Log analysis job {job_id} completed successfully.")
    except Exception as exc:
        logger.exception(f"Error processing log analysis job {job_id}")
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = datetime.datetime.utcnow()
            db.commit()
    finally:
        db.close()
