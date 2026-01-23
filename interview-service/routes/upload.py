from fastapi import APIRouter, UploadFile, File, HTTPException
from database import get_db
from services.transcription_service import transcribe_audio
from pathlib import Path
import os
import uuid
import shutil
import time
from datetime import datetime

project_root = Path(__file__).parent.parent.parent
uploads_dir = project_root / "interview-uploads"

router = APIRouter()

@router.post("/upload-answer/{session_id}/{question_id}")
async def upload_answer(
    session_id: str,
    question_id: str,
    audio: UploadFile = File(...)
):
    file_path = None
    temp_file_path = None

    try:
        os.makedirs(str(uploads_dir), exist_ok=True)

        content = await audio.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio file received")

        file_extension = audio.filename.split(".")[-1] if "." in audio.filename else "webm"
        filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = uploads_dir / filename

        temp_file_path = uploads_dir / f"{filename}.tmp"

        try:
            with open(str(temp_file_path), "wb") as f:
                f.write(content)

            if os.path.exists(str(file_path)):
                os.remove(str(file_path))
            shutil.move(str(temp_file_path), str(file_path))
            temp_file_path = None
        except (IOError, OSError) as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save audio file: {str(e)}"
            )

        try:
            transcript = transcribe_audio(str(file_path))
        except Exception as e:
            transcript = ""
            print(f"Transcription failed for {file_path}: {str(e)}")

        audio_path_relative = f"uploads/{filename}"

        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
                with get_db() as db:
                    existing = db.interview_answers.find_one({
                        "session_id": session_id,
                        "question_id": question_id
                    })

                    if existing:
                        db.interview_answers.update_one(
                            {"_id": existing["_id"]},
                            {"$set": {
                                "audio_path": audio_path_relative,
                                "transcript": transcript,
                                "updated_at": datetime.utcnow()
                            }}
                        )
                    else:
                        answer_doc = {
                            "id": str(uuid.uuid4()),
                            "session_id": session_id,
                            "question_id": question_id,
                            "audio_path": audio_path_relative,
                            "transcript": transcript,
                            "created_at": datetime.utcnow()
                        }
                        db.interview_answers.insert_one(answer_doc)

                    db.interview_sessions.update_one(
                        {"id": session_id},
                        {"$set": {"status": "in_progress"}}
                    )

                break

            except Exception as db_error:
                retry_count += 1
                if retry_count >= max_retries:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Database error after {max_retries} retries: {str(db_error)}"
                    )
                time.sleep(0.1 * retry_count)

        return {
            "transcript": transcript,
            "audio_path": audio_path_relative
        }

    except HTTPException:
        raise
    except Exception as e:
        if temp_file_path and os.path.exists(str(temp_file_path)):
            try:
                os.remove(str(temp_file_path))
            except:
                pass
        if file_path and os.path.exists(str(file_path)):
            try:
                os.remove(str(file_path))
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
