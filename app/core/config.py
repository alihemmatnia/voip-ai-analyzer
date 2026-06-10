import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./storage/voip_analyzer.db"
    UPLOAD_DIR: str = "./storage/uploads"
    
    OPENAI_API_KEY: str = "dummy"
    OPENAI_BASE_URL: str = "http://localhost:1234/v1"
    OPENAI_MODEL: str = "gemma-3-12b-it"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.dirname(settings.DATABASE_URL.replace("sqlite:///", "")), exist_ok=True)
