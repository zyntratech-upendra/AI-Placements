from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from database import get_db
from services.llm_service import evaluate_answer, generate_reference_answer
from services.export_service import generate_pdf_report
from datetime import datetime
import time

router = APIRouter()

@router.post("/analyze/{session_id}")
async def analyze_session(session_id: str, request: Request):
    user_id = request.state.user["_id"]
    retries = 0

    while retries < 3:
        try:
            with get_db() as db:
                session = db.interview_sessions.find_one({
                    "id": session_id,
                    "user_id": user_id
                })

                if not session:
                    raise HTTPException(status_code=404, detail="Session not found")

                questions = session.get("questions", [])
                interview_type = session.get("interview_type", "technical")
                jd_text = session.get("job_description", "")
                resume_text = session.get("resume_text", "")

                answers = list(db.interview_answers.find({"session_id": session_id}))
                q_map = {q["id"]: q.get("text", "") for q in questions}

                total_score = 0
                scored_count = 0
                reference_cache = {}

                for ans in answers:
                    if ans.get("score") is not None or not ans.get("transcript"):
                        continue

                    qid = ans.get("question_id")
                    question_text = q_map.get(qid)
                    if not question_text:
                        continue

                    if qid not in reference_cache:
                        reference_cache[qid] = generate_reference_answer(
                            question_text,
                            jd_text,
                            resume_text,
                            interview_type
                        )

                    evaluation = evaluate_answer(
                        question_text,
                        ans["transcript"],
                        reference_cache[qid],
                        interview_type
                    )

                    score = evaluation.get("total_score") or evaluation.get("score") or 0
                    feedback = evaluation.get("feedback", [])

                    total_score += score
                    scored_count += 1

                    db.interview_answers.update_one(
                        {"id": ans["id"]},
                        {"$set": {
                            "score": score,
                            "feedback": feedback,
                            "model_answer": reference_cache[qid]
                        }}
                    )

                final_score = round(
                    total_score / scored_count, 2
                ) if scored_count > 0 else 0

                db.interview_sessions.update_one(
                    {"id": session_id},
                    {"$set": {
                        "status": "completed",
                        "final_score": final_score,
                        "completed_at": datetime.utcnow()
                    }}
                )

            return {
                "status": "success",
                "final_score": final_score
            }

        except Exception as e:
            retries += 1
            time.sleep(0.2 * retries)
            if retries == 3:
                raise HTTPException(status_code=500, detail=str(e))


@router.get("/export-pdf/{session_id}")
async def export_pdf(session_id: str, request: Request):
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

    pdf_bytes = generate_pdf_report(session, answers)

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition":
            f"attachment; filename=interview_{session_id[:8]}.pdf"
        }
    )
