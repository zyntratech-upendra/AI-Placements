from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    groq_api_key: Optional[str] =  None
    openai_api_key: Optional[str] = None
    # Load these values from environment/.env via BaseSettings
    mongodb_uri: Optional[str] = None
    mongodb_db_name: str = "ai_interviewer"

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="allow"
    )

class Settingsgpt(BaseSettings):
    openai_api_key: Optional[str] = None

    model_config = ConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="allow"
    )


@lru_cache()
def get_settings():
    return Settings()

@lru_cache()
def get_settingsgpt():
    return Settingsgpt()

# OCR Configuration (moved from ml_service)
def get_ocr_config():
    """Get OCR service configuration"""
    return {
        "MAX_FILE_SIZE": 50 * 1024 * 1024,  # 50MB
        "ALLOWED_EXTENSIONS": {'pdf', 'jpg', 'jpeg', 'png'},
        "UPLOAD_FOLDER": os.getenv('UPLOAD_FOLDER', '/tmp/ocr_uploads')
    }
