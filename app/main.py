from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import logging

from sqlalchemy import text
from core.config import settings
from db.database import engine, Base
from models.server import PBXServer
from api.endpoints import router as api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("VoIPAnalyzer")

def ensure_sqlite_migrations() -> None:
    """Apply lightweight SQLite schema fixes for existing databases."""
    if engine.dialect.name != "sqlite":
        return

    with engine.begin() as conn:
        result = conn.execute(text("PRAGMA table_info(jobs)"))
        existing_columns = [row[1] for row in result.fetchall()]
        if "job_type" not in existing_columns:
            logger.info("Migrating existing jobs table to add job_type column.")
            conn.execute(
                text("ALTER TABLE jobs ADD COLUMN job_type VARCHAR(50) NOT NULL DEFAULT 'pcap'")
            )
            logger.info("job_type column added to jobs table.")

try:
    logger.info("Initializing SQLite database records & creating structured schemas.")
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_migrations()
    logger.info("Database schemas initialized successfully.")
except Exception as e:
    logger.critical(f"Critical error bootstrappig DB structures: {e}")

app = FastAPI(
    title="VoIP AI Analyzer Engine",
    description="Advanced API for VoIP pcap signal processing, call flow reconstruction, and AI root cause analysis.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.servers import router as servers_router

app.include_router(api_router, prefix="/api")
app.include_router(servers_router, prefix="/api/v1")

@app.get("/")
def redirect_to_docs():
    """
    Redirect root visitors to Swagger interactive console directly.
    """
    return RedirectResponse(url="/docs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
