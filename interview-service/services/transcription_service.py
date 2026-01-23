import os
from openai import OpenAI
from typing import Union, BinaryIO
from fastapi import UploadFile
from config import get_settingsgpt

def get_clientgpt():
    """Lazy initialization of OpenAI client."""
    settingsgpt = get_settingsgpt()
    if not settingsgpt.openai_api_key:
        raise ValueError("OPENAI_API_KEY is required. Please set it in your .env file.")
    return OpenAI(api_key=settingsgpt.openai_api_key)

# Initialize OpenAI client (reads OPENAI_API_KEY automatically)
client = get_clientgpt()

def transcribe_audio(audio_source: Union[str, BinaryIO, UploadFile]) -> str:
    """
    Transcribe an audio file using OpenAI's Whisper API.
    
    Args:
        audio_source: path to file (str), file-like object (BinaryIO),
                      or FastAPI UploadFile.

    Returns:
        str: transcribed text
    """
    # Open file handle safely
    if isinstance(audio_source, str):
        # Local file path
        if not os.path.exists(audio_source):
            raise FileNotFoundError(f"Audio file not found: {audio_source}")
        audio_file = open(audio_source, "rb")
        close_when_done = True
    elif isinstance(audio_source, UploadFile):
        # FastAPI upload object
        audio_file = audio_source.file
        close_when_done = False
    else:
        # BinaryIO stream
        audio_file = audio_source
        close_when_done = False

    try:
        # Perform transcription
        response = client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",  # newer, faster Whisper model
            file=audio_file,
        )
        text = (response.text or "").strip()
        return text

    except Exception as e:
        raise RuntimeError(f"Transcription failed: {str(e)}")

    finally:
        if close_when_done:
            try:
                audio_file.close()
            except Exception:
                pass
