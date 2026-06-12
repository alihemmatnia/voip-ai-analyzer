import os
from pathlib import Path
from pydantic import ConfigDict
from pydantic_settings import BaseSettings

ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT_DIR / ".env"

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./storage/voip_analyzer.db"
    UPLOAD_DIR: str = "./storage/uploads"

    OPENAI_API_KEY: str = "dummy"
    OPENAI_BASE_URL: str = "http://localhost:1234/v1"
    OPENAI_MODEL: str = "gemma-3-12b-it"

    # Database Encryption Key (base64 encoded 32-byte key)
    # Required field, loaded from .env
    ENCRYPTION_KEY: str

    model_config = ConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.dirname(settings.DATABASE_URL.replace("sqlite:///", "")), exist_ok=True)
