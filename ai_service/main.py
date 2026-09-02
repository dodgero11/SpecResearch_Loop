import os
import sys
import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Ensure stdout and stderr are unbuffered for real-time console logging
os.environ["PYTHONUNBUFFERED"] = "1"
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(line_buffering=True, write_through=True)
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(line_buffering=True, write_through=True)
    except Exception:
        pass

# Configure root logger with immediate flush to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)

# Load environment variables
load_dotenv()

from routers.ai_router import router as ai_router

app = FastAPI(
    title="SpecResearch Loop AI Microservice",
    description="Python FastAPI service handling 5-round Multi-Agent loop processing and document checking.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include AI routers
app.include_router(ai_router)

@app.get("/")
async def root():
    return {
        "service": "SpecResearch Loop AI Engine",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy"
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"[AI Service] Starting FastAPI server on {host}:{port} with real-time log output...", flush=True)
    uvicorn.run("main:app", host=host, port=port, reload=True, log_level="info")

