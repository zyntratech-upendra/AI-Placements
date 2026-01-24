from fastapi import APIRouter, HTTPException, Request
from database import get_db
from services.llm_service import generate_adaptive_questions, generate_reference_answer
from datetime import datetime
import uuid

router = APIRouter()

@router.post("/interview/adaptive/{session_id}")
async def create_adaptive_interview(session_id: str, request: Request):
    """
    Create 3 adaptive interview sessions when performance is below 8:
    1. Same questions retry
    2. Focused learning set 1 (new questions on weak areas)
    3. Focused learning set 2 (additional questions on similar topics)
    """
    user_id = request.state.user["_id"]
    
    with get_db() as db:
        # Get the previous session
        previous_session = db.interview_sessions.find_one({
            "id": session_id,
            "user_id": user_id
        })
        
        if not previous_session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        final_score = previous_session.get("final_score")
        if final_score is None or final_score >= 8:
            raise HTTPException(
                status_code=400, 
                detail="Adaptive learning only available for scores below 8"
            )
        
        # Analyze weak areas from previous session
        weak_areas = identify_weak_areas(previous_session, db)
        
        # Get duration for new interview (same as previous)
        duration = previous_session.get("duration_seconds", 300)
        interview_type = previous_session.get("interview_type", "technical")
        previous_questions = previous_session.get("questions", [])
        
        # Create 3 adaptive interview sessions
        adaptive_sessions = []
        
        # Session 1: Same questions retry
        retry_session_id = str(uuid.uuid4())
        db.interview_sessions.insert_one({
            "id": retry_session_id,
            "user_id": user_id,
            "parent_session_id": session_id,
            "is_adaptive": True,
            "adaptive_type": "retry",  # Type of adaptive interview
            "weak_areas": weak_areas,
            "job_description": previous_session.get("job_description", ""),
            "resume_text": previous_session.get("resume_text", ""),
            "duration_seconds": duration,
            "interview_type": interview_type,
            "questions": previous_questions,  # Same questions
            "status": "created",
            "answers": {},
            "final_score": None,
            "created_at": datetime.utcnow(),
            "completed_at": None
        })
        adaptive_sessions.append({
            "session_id": retry_session_id,
            "type": "retry",
            "label": "Same Questions Review"
        })
        
        # Session 2 & 3: Generate new questions with focus on weak areas
        for idx, practice_type in enumerate(["practice1", "practice2"], start=1):
            # Generate adaptive questions for this set
            adaptive_questions = generate_adaptive_questions(
                weak_areas=weak_areas,
                job_description=previous_session.get("job_description", ""),
                resume_text=previous_session.get("resume_text", ""),
                duration_seconds=duration,
                interview_type=interview_type,
                previous_questions=previous_questions,
                practice_num=idx  # Different questions for each set
            )
            
            practice_session_id = str(uuid.uuid4())
            db.interview_sessions.insert_one({
                "id": practice_session_id,
                "user_id": user_id,
                "parent_session_id": session_id,
                "is_adaptive": True,
                "adaptive_type": practice_type,
                "weak_areas": weak_areas,
                "job_description": previous_session.get("job_description", ""),
                "resume_text": previous_session.get("resume_text", ""),
                "duration_seconds": duration,
                "interview_type": interview_type,
                "questions": adaptive_questions,  # New questions
                "status": "created",
                "answers": {},
                "final_score": None,
                "created_at": datetime.utcnow(),
                "completed_at": None
            })
            adaptive_sessions.append({
                "session_id": practice_session_id,
                "type": practice_type,
                "label": f"Focused Learning - Set {idx}"
            })
            
            # Store adaptive learning record for each session
            db.interview_adaptive_learning.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "original_session_id": session_id,
                "adaptive_session_id": practice_session_id,
                "adaptive_type": practice_type,
                "original_score": final_score,
                "weak_areas": weak_areas,
                "created_at": datetime.utcnow(),
                "completed": False
            })
        
        # Store learning record for retry session
        db.interview_adaptive_learning.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "original_session_id": session_id,
            "adaptive_session_id": retry_session_id,
            "adaptive_type": "retry",
            "original_score": final_score,
            "weak_areas": weak_areas,
            "created_at": datetime.utcnow(),
            "completed": False
        })
        
        return {
            "original_session_id": session_id,
            "adaptive_sessions": adaptive_sessions,
            "weak_areas": weak_areas,
            "duration_seconds": duration,
            "interview_type": interview_type,
            "message": "3 adaptive interviews created: 1 retry + 2 focused learning sets"
        }


def identify_weak_areas(session: dict, db) -> list:
    """
    Identify weak areas from interview performance.
    Returns list of weak question IDs and topics.
    """
    weak_areas = []
    answers = session.get("answers", {})
    questions = session.get("questions", [])
    
    # Create question map
    q_map = {q["id"]: q for q in questions}
    
    # Find questions with low scores
    for q_id, answer in answers.items():
        score = answer.get("score")
        if score is not None and score < 6:  # Score below 6 is weak
            question = q_map.get(q_id, {})
            weak_areas.append({
                "question_id": q_id,
                "score": score,
                "topic": question.get("text", "Unknown"),
                "category": question.get("category", "general")
            })
    
    # Sort by lowest score first
    weak_areas.sort(key=lambda x: x["score"])
    
    return weak_areas[:3]  # Top 3 weakest areas


@router.get("/interview/adaptive-sessions/{user_id}")
async def get_adaptive_sessions(user_id: str, request: Request):
    """Get all adaptive interview sessions for a user"""
    current_user_id = request.state.user["_id"]
    
    # Verify user is accessing their own data
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    with get_db() as db:
        sessions = list(db.interview_sessions.find({
            "user_id": user_id,
            "is_adaptive": True
        }).sort("created_at", -1))
        
        for s in sessions:
            s.pop("_id", None)
        
        return {
            "adaptive_sessions": sessions,
            "count": len(sessions)
        }


@router.get("/interview/learning-progress/{user_id}")
async def get_learning_progress(user_id: str, request: Request):
    """Get adaptive learning progress for user"""
    current_user_id = request.state.user["_id"]
    
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    with get_db() as db:
        records = list(db.interview_adaptive_learning.find({
            "user_id": user_id
        }).sort("created_at", -1))
        
        progress_data = []
        
        for record in records:
            record.pop("_id", None)
            
            # Get adaptive session score if completed
            adaptive_session = db.interview_sessions.find_one({
                "id": record["adaptive_session_id"]
            })
            
            adaptive_score = None
            if adaptive_session and adaptive_session.get("final_score") is not None:
                adaptive_score = adaptive_session.get("final_score")
                record["completed"] = True
            
            improvement = None
            if adaptive_score is not None:
                improvement = adaptive_score - record["original_score"]
            
            progress_data.append({
                "original_session_id": record["original_session_id"],
                "adaptive_session_id": record["adaptive_session_id"],
                "original_score": record["original_score"],
                "adaptive_score": adaptive_score,
                "improvement": improvement,
                "weak_areas": record["weak_areas"],
                "created_at": record["created_at"],
                "completed": record["completed"]
            })
        
        return {
            "progress": progress_data,
            "total_sessions": len(records),
            "completed_sessions": len([p for p in progress_data if p["adaptive_score"] is not None])
        }
