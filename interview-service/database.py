from pymongo import MongoClient
import logging
from pymongo.database import Database
from contextlib import contextmanager
from config import get_settings
import os

_client = None
_db = None

def get_mongodb_client():
    global _client, _db

    if _client is None:
        # Try to get from config first, then environment variable, then default
        settings = get_settings()
        env_uri = os.getenv("MONGODB_URI", "").strip()
        
        # Get URI from settings or environment, handling empty strings
        mongodb_uri = None
        if settings.mongodb_uri and settings.mongodb_uri.strip():
            mongodb_uri = settings.mongodb_uri.strip()
        elif env_uri:
            mongodb_uri = env_uri
        else:
            mongodb_uri = "mongodb://localhost:27017/"
        
        # Validate URI has correct scheme
        if not (mongodb_uri.startswith("mongodb://") or mongodb_uri.startswith("mongodb+srv://")):
            # If invalid scheme, use default
            logger = logging.getLogger("backend.database")
            logger.warning(
                f"Invalid MongoDB URI scheme '{mongodb_uri}', using default: mongodb://localhost:27017/"
            )
            mongodb_uri = "mongodb://localhost:27017/"
        
        _client = MongoClient(mongodb_uri)
        db_name = settings.mongodb_db_name or os.getenv("MONGODB_DB_NAME", "ai_interviewer")
        _db = _client[db_name]

        # Create indexes used by the application
        _db.interview_sessions.create_index("id", unique=True)
        _db.interview_answers.create_index("id", unique=True)
        _db.interview_answers.create_index([("session_id", 1), ("question_id", 1)])

        # Perform a lightweight ping to verify connection and give a clear startup message
        logger = logging.getLogger("backend.database")
        try:
            _client.admin.command("ping")
            logger.info(f"MongoDB connected successfully -> URI: {mongodb_uri}  DB: {db_name}")
        except Exception as e:
            logger.warning(f"MongoDB ping failed during startup: {e}")

    return _db

@contextmanager
def get_db():
    db = get_mongodb_client()
    try:
        yield db
    finally:
        pass

def close_db():
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
