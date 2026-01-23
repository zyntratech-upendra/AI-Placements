import os
import sys
import logging
from pathlib import Path

# Add project root to Python path when running directly
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import session, upload, analyze, ocr
from routes import rag  # RAG routes
from routes import sync  # Sync routes
from routes import recommendations  # LLM Recommendations routes
from routes import resume_assessment  # Resume Assessment routes
from database import get_mongodb_client
from config import get_ocr_config
from middleware.auth import AuthMiddleware

app = FastAPI(title="AI Interviewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuthMiddleware)

app.include_router(session.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(analyze.router, prefix="/api")
app.include_router(ocr.router, prefix="/api")  # OCR Service routes
app.include_router(rag.router, prefix="/api")  # RAG Service routes
app.include_router(sync.router, prefix="/api")  # Sync routes
app.include_router(recommendations.router)  # LLM Recommendations
app.include_router(resume_assessment.router, prefix="/api")  # Resume Assessment


# Use absolute paths
frontend_dir = project_root / "apps" / "frontend"
uploads_dir = Path(__file__).parent / "uploads"

os.makedirs(uploads_dir, exist_ok=True)
os.makedirs(frontend_dir, exist_ok=True)

# Mount uploads directory for serving audio files
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Mount frontend directory (must be last to catch all other routes)
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


# Initialize logging and ensure MongoDB client is created on startup so connection
# is validated when the process starts (prints/logs immediately).
logging.basicConfig(level=logging.INFO)


@app.on_event("startup")
async def startup_event():
    logger = logging.getLogger("backend.main")
    
    # Initialize OCR service upload folder
    try:
        ocr_config = get_ocr_config()
        os.makedirs(ocr_config["UPLOAD_FOLDER"], exist_ok=True)
        logger.info("OCR Service integrated and ready")
    except Exception as e:
        logger.warning(f"OCR service initialization warning: {e}")
    
    # This will create the MongoClient and log connection status from database.py
    try:
        get_mongodb_client()
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        logger.warning("Application will continue but database features may not work")
