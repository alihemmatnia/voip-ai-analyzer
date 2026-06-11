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

        log_summary = parse_log_file(file_path)
        ai_analysis = analyze_voip_log_summary_with_ai(log_summary)

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
