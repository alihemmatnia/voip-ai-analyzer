from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import logging

from api.endpoints import router as api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("VoIPAnalyzer")

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
