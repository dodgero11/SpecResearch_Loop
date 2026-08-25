import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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
    uvicorn.run("main:app", host=host, port=port, reload=True)
