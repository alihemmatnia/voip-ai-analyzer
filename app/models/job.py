import datetime
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from db.database import Base
from models.encrypted_type import EncryptedString

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(EncryptedString(255), nullable=False)
    job_type = Column(String(50), nullable=False, default="pcap")
    status = Column(String(50), nullable=False, default="queued") # queued, processing, completed, failed
    error_message = Column(EncryptedString, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    results = relationship("AnalysisResult", back_populates="job", cascade="all, delete-orphan")
    log_results = relationship("LogAnalysisResult", back_populates="job", cascade="all, delete-orphan")
    chat_sessions = relationship("ChatSession", back_populates="job", cascade="all, delete-orphan")

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, unique=True)
    result_json = Column(EncryptedString, nullable=False) # JSON formatted string
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    job = relationship("Job", back_populates="results")


class LogAnalysisResult(Base):
    __tablename__ = "log_analysis_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, unique=True)
    detected_platform = Column(String(50), nullable=False)
    summary_json = Column(EncryptedString, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    job = relationship("Job", back_populates="log_results")


class ChatSession(Base):
    __tablename__ = "analysis_chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, unique=True)
    suggested_questions = Column(EncryptedString, nullable=True) # Serialized JSON array of strings
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    job = relationship("Job", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "analysis_chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("analysis_chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False) # "user" or "assistant"
    content = Column(EncryptedString, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")
