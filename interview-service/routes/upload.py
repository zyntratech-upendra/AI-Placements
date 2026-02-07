from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Request
from database import get_db
from services.gridfs_service import get_gridfs_service
from services.background_tasks import process_audio_transcription
from typing import Dict, List
import uuid
import time
from datetime import datetime
import logging

logger = logging.getLogger("backend.upload")

router = APIRouter()

@router.post("/upload-answer/{session_id}/{question_id}")
async def upload_answer(
    session_id: str,
    question_id: str,
    audio: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    request: Request = None
):
    """
    Upload audio answer and queue async transcription
    
    Flow:
    1. Validate audio file
    2. Store audio in MongoDB GridFS
    3. Create answer record in interview_sessions (without transcript)
    4. Queue background transcription task
    5. Return immediately (non-blocking)
    
    Returns:
        {
            "status": "processing",
            "message": "Audio uploaded successfully, transcription in progress",
            "file_id": "gridfs_file_id"
        }
    """
    
    try:
        # Get user ID from auth middleware
        user_id = request.state.user["_id"] if request else None
        
        # Step 1: Validate audio file
        content = await audio.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio file received")
        
        logger.info(
            f"Received audio upload: session={session_id}, question={question_id}, "
            f"size={len(content)} bytes"
        )
        
        # Step 2: Store audio in GridFS
        gridfs_service = get_gridfs_service()
        file_extension = audio.filename.split(".")[-1] if "." in audio.filename else "webm"
        filename = f"{uuid.uuid4()}.{file_extension}"
        
        file_id = gridfs_service.store_audio(
            audio_data=content,
            session_id=session_id,
            question_id=question_id,
            user_id=user_id,
            filename=filename
        )
        
        # Step 3: Create answer record in database (without transcript yet)
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                with get_db() as db:
                    answer_id = str(uuid.uuid4())
                    
                    db.interview_sessions.update_one(
                        {"id": session_id},
                        {
                            "$set": {
                                "status": "in_progress",
                                f"answers.{question_id}": {
                                    "id": answer_id,
                                    "question_id": question_id,
                                    "gridfs_file_id": file_id,
                                    "transcript": None,  # Will be filled by background task
                                    "transcription_status": "queued",
                                    "score": None,
                                    "feedback": [],
                                    "model_answer": None,
                                    "created_at": datetime.utcnow()
                                }
                            }
                        }
                    )
                
                break
            
            except Exception as db_error:
                retry_count += 1
                if retry_count >= max_retries:
                    # Cleanup GridFS file on database error
                    try:
                        gridfs_service.delete_audio(file_id)
                    except:
                        pass
                    
                    raise HTTPException(
                        status_code=500,
                        detail=f"Database error after {max_retries} retries: {str(db_error)}"
                    )
                time.sleep(0.1 * retry_count)
        
        # Step 4: Queue background transcription task
        if background_tasks:
            background_tasks.add_task(
                process_audio_transcription,
                file_id=file_id,
                session_id=session_id,
                question_id=question_id,
                user_id=user_id
            )
            logger.info(f"Transcription task queued: file_id={file_id}")
        else:
            logger.warning("BackgroundTasks not available, transcription will not be processed")
        
        # Step 5: Return immediately (non-blocking)
        return {
            "status": "processing",
            "message": "Audio uploaded successfully, transcription in progress",
            "file_id": file_id,
            "transcription_status": "queued"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/transcription-status/{session_id}/{question_id}")
async def get_transcription_status(
    session_id: str,
    question_id: str,
    request: Request
):
    """
    Check transcription status for a specific answer
    
    Returns:
        {
            "status": "queued" | "processing" | "completed" | "failed",
            "transcript": "text" (if completed),
            "error": "error message" (if failed)
        }
    """
    user_id = request.state.user["_id"]
    
    try:
        with get_db() as db:
            session = db.interview_sessions.find_one({
                "id": session_id,
                "user_id": user_id
            })
            
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            
            answers = session.get("answers", {})
            answer = answers.get(question_id)
            
            if not answer:
                raise HTTPException(status_code=404, detail="Answer not found")
            
            status = answer.get("transcription_status", "unknown")
            
            response = {
                "status": status,
                "question_id": question_id
            }
            
            if status == "completed":
                response["transcript"] = answer.get("transcript", "")
            
            if status == "failed":
                response["error"] = answer.get("transcription_error", "Unknown error")
            
            return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get transcription status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transcription-status/{session_id}")
async def get_all_transcription_status(
    session_id: str,
    request: Request
):
    """
    Check transcription status for all answers in a session
    
    Returns:
        {
            "session_id": "...",
            "answers": [
                {
                    "question_id": "...",
                    "status": "queued" | "processing" | "completed" | "failed",
                    "transcript": "..." (if completed)
                }
            ],
            "summary": {
                "total": 5,
                "completed": 3,
                "processing": 1,
                "queued": 1,
                "failed": 0
            }
        }
    """
    user_id = request.state.user["_id"]
    
    try:
        with get_db() as db:
            session = db.interview_sessions.find_one({
                "id": session_id,
                "user_id": user_id
            })
            
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            
            answers_dict = session.get("answers", {})
            
            answers_status = []
            summary = {
                "total": 0,
                "completed": 0,
                "processing": 0,
                "queued": 0,
                "failed": 0
            }
            
            for question_id, answer in answers_dict.items():
                status = answer.get("transcription_status", "unknown")
                
                answer_info = {
                    "question_id": question_id,
                    "status": status
                }
                
                if status == "completed":
                    answer_info["transcript"] = answer.get("transcript", "")
                    summary["completed"] += 1
                elif status == "processing":
                    summary["processing"] += 1
                elif status == "queued":
                    summary["queued"] += 1
                elif status == "failed":
                    answer_info["error"] = answer.get("transcription_error", "Unknown error")
                    summary["failed"] += 1
                
                summary["total"] += 1
                answers_status.append(answer_info)
            
            return {
                "session_id": session_id,
                "answers": answers_status,
                "summary": summary
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get transcription status: {e}")
        raise HTTPException(status_code=500, detail=str(e))
