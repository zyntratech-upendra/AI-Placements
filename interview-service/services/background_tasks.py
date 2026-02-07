"""
Background Task Service for async audio transcription
Handles transcription processing without blocking API responses
"""

import logging
from datetime import datetime
from typing import Optional
from io import BytesIO

from services.gridfs_service import get_gridfs_service
from services.transcription_service import transcribe_audio
from database import get_db

logger = logging.getLogger("backend.background_tasks")


async def process_audio_transcription(
    file_id: str,
    session_id: str,
    question_id: str,
    user_id: str
):
    """
    Background task to transcribe audio and update database
    
    This function:
    1. Retrieves audio from GridFS
    2. Transcribes using Whisper API
    3. Updates interview_sessions with transcript
    4. Deletes audio from GridFS (keep only text)
    5. Handles errors gracefully
    
    Args:
        file_id: GridFS file ID
        session_id: Interview session ID
        question_id: Question ID
        user_id: User ID
    """
    gridfs_service = get_gridfs_service()
    
    try:
        logger.info(
            f"Starting transcription: session={session_id}, "
            f"question={question_id}, file={file_id}"
        )
        
        # Mark as processing
        with get_db() as db:
            db.interview_sessions.update_one(
                {"id": session_id},
                {"$set": {
                    f"answers.{question_id}.transcription_status": "processing",
                    f"answers.{question_id}.gridfs_file_id": file_id
                }}
            )
        
        # Step 1: Retrieve audio from GridFS
        audio_data = gridfs_service.get_audio(file_id)
        
        if not audio_data:
            logger.error(f"Audio file not found in GridFS: {file_id}")
            # Mark as failed
            with get_db() as db:
                db.interview_sessions.update_one(
                    {"id": session_id},
                    {"$set": {
                        f"answers.{question_id}.transcription_status": "failed",
                        f"answers.{question_id}.transcript": "",
                        f"answers.{question_id}.transcription_error": "Audio file not found"
                    }}
                )
            return
        
        # Step 2: Transcribe audio using Whisper API
        try:
            # Create BytesIO object for transcription service
            audio_stream = BytesIO(audio_data)
            audio_stream.name = "answer.webm"  # Required by OpenAI API
            
            transcript = transcribe_audio(audio_stream)
            
            if not transcript:
                transcript = ""
                logger.warning(f"Empty transcript for session={session_id}, question={question_id}")
        
        except Exception as transcription_error:
            logger.error(f"Transcription failed: {transcription_error}")
            transcript = ""
            
            # Mark as failed with error
            with get_db() as db:
                db.interview_sessions.update_one(
                    {"id": session_id},
                    {"$set": {
                        f"answers.{question_id}.transcription_status": "failed",
                        f"answers.{question_id}.transcript": "",
                        f"answers.{question_id}.transcription_error": str(transcription_error)
                    }}
                )
            
            # Still delete the audio file to free space
            try:
                gridfs_service.delete_audio(file_id)
            except Exception as delete_error:
                logger.error(f"Failed to delete audio after transcription error: {delete_error}")
            
            return
        
        # Step 3: Update database with transcript
        with get_db() as db:
            db.interview_sessions.update_one(
                {"id": session_id},
                {"$set": {
                    f"answers.{question_id}.transcript": transcript,
                    f"answers.{question_id}.transcription_status": "completed",
                    f"answers.{question_id}.transcribed_at": datetime.utcnow(),
                    f"answers.{question_id}.gridfs_file_id": None  # Clear file reference
                }}
            )
        
        logger.info(
            f"Transcription completed: session={session_id}, "
            f"question={question_id}, length={len(transcript)}"
        )
        
        # Step 4: Delete audio from GridFS (keep only text)
        try:
            gridfs_service.delete_audio(file_id)
            logger.info(f"Audio deleted from GridFS after transcription: {file_id}")
        except Exception as delete_error:
            logger.error(f"Failed to delete audio from GridFS: {delete_error}")
            # Don't fail the whole task if deletion fails
    
    except Exception as e:
        logger.error(f"Background transcription task failed: {e}", exc_info=True)
        
        # Mark as failed
        try:
            with get_db() as db:
                db.interview_sessions.update_one(
                    {"id": session_id},
                    {"$set": {
                        f"answers.{question_id}.transcription_status": "failed",
                        f"answers.{question_id}.transcription_error": str(e)
                    }}
                )
        except Exception as db_error:
            logger.error(f"Failed to update error status in database: {db_error}")


def process_audio_transcription_sync(
    file_id: str,
    session_id: str,
    question_id: str,
    user_id: str
):
    """
    Synchronous wrapper for background transcription
    Used by Celery or other sync task queues
    
    Args:
        file_id: GridFS file ID
        session_id: Interview session ID
        question_id: Question ID
        user_id: User ID
    """
    import asyncio
    
    # Run async function in sync context
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            process_audio_transcription(file_id, session_id, question_id, user_id)
        )
    finally:
        loop.close()
