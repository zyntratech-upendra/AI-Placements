from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from database import get_db
from services.pdf_service import extract_text_from_pdf
from services.llm_service import generate_questions
import uuid
from datetime import datetime

router = APIRouter()

@router.post("/create-session")
async def create_session(
    request: Request,
    job_description: str = Form(...),
    resume: UploadFile = File(...),
    duration: int = Form(...),
    interview_type: str = Form("technical")
):
    user_id = request.state.user["_id"]

    if interview_type not in ["technical", "hr"]:
        raise HTTPException(status_code=400, detail="Invalid interview type")

    resume_bytes = await resume.read()
    resume_text = extract_text_from_pdf(resume_bytes)

    questions = generate_questions(
        job_description,
        resume_text,
        duration,
        interview_type
    )

    session_id = str(uuid.uuid4())

    with get_db() as db:
        db.interview_sessions.insert_one({
            "id": session_id,
            "user_id": user_id,
            "job_description": job_description,
            "resume_text": resume_text,
            "duration_seconds": duration,
            "interview_type": interview_type,
            "questions": questions,
            "status": "created",
            "final_score": None,
            "created_at": datetime.utcnow(),
            "completed_at": None
        })

    return {
        "session_id": session_id,
        "questions": questions,
        "duration_seconds": duration,
        "interview_type": interview_type
    }


@router.get("/session/{session_id}")
async def get_session(session_id: str, request: Request):
    user_id = request.state.user["_id"]

    with get_db() as db:
        session = db.interview_sessions.find_one({
            "id": session_id,
            "user_id": user_id
        })

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        session.pop("_id", None)

        answers = list(db.interview_answers.find({"session_id": session_id}))
        for a in answers:
            a.pop("_id", None)

    return {
        "session": session,
        "answers": answers
    }



@router.get("/my-sessions")
async def get_my_sessions(request: Request):
    # ✅ AUTH CHECK (prevents crash)
    if not request.state.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # ✅ FIXED KEY NAME
    user_id = request.state.user["_id"]

    print("Fetching sessions for user:", user_id)

    with get_db() as db:
        sessions = list(
            db.interview_sessions
            .find({"user_id": user_id})
            .sort("created_at", -1)
        )

        for s in sessions:
            s.pop("_id", None)

    return {"sessions": sessions}
