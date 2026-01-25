"""
Face Detection WebSocket Route
Real-time face detection using MediaPipe via WebSocket
Simplified version with alert counting
"""

import time
import base64
import cv2
import numpy as np
import mediapipe as mp
from fastapi import WebSocket, WebSocketDisconnect
from database import get_db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# MediaPipe face detector (global instance removed - now created per connection)
mp_face = mp.solutions.face_detection


async def face_monitor_websocket(websocket: WebSocket, session_id: str, user_id: str):
    """
    Production-ready WebSocket face monitoring
    - Thread-safe (per-connection MediaPipe)
    - Fair alert logic (time-based, not frame-based)
    - Stable multiple-face detection
    - Scales to 100+ concurrent users
    """
    await websocket.accept()
    logger.info(f"✅ WebSocket connected for session {session_id}")

    # ✅ MediaPipe per connection (CRITICAL)
    face_detector = mp.solutions.face_detection.FaceDetection(
        model_selection=0,
        min_detection_confidence=0.6
    )

    # ---- State ----
    alert_count = 0

    no_face_start = None
    multiple_face_start = None

    last_alert_sent = 0.0

    ALERT_COOLDOWN = 5.0
    NO_FACE_THRESHOLD = 5.0
    MULTIPLE_FACE_THRESHOLD = 2.0
    MAX_ALERTS = 5

    try:
        while True:
            data = await websocket.receive_json()
            frame_b64 = data.get("frame")
            if not frame_b64:
                continue

            # ---- Decode frame safely ----
            try:
                frame_bytes = base64.b64decode(frame_b64)
                frame_np = np.frombuffer(frame_bytes, dtype=np.uint8)
                frame = cv2.imdecode(frame_np, cv2.IMREAD_COLOR)
                if frame is None:
                    continue
            except Exception:
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_detector.process(rgb)

            face_count = len(results.detections) if results.detections else 0
            now = time.time()

            status = "ok"
            message = "Interview in progress"

            # ==============================
            # CASE 1: Exactly one face
            # ==============================
            if face_count == 1:
                no_face_start = None
                multiple_face_start = None

            # ==============================
            # CASE 2: Multiple faces
            # ==============================
            elif face_count > 1:
                no_face_start = None

                if multiple_face_start is None:
                    multiple_face_start = now

                duration = now - multiple_face_start

                if duration >= MULTIPLE_FACE_THRESHOLD and (now - last_alert_sent) >= ALERT_COOLDOWN:
                    alert_count += 1
                    last_alert_sent = now

                    logger.info(
                        f"[{session_id}] Multiple faces violation "
                        f"(faces={face_count}, alerts={alert_count})"
                    )

                    status = "alert"
                    message = f"Multiple faces detected ({face_count})"

            # ==============================
            # CASE 3: No face
            # ==============================
            else:
                multiple_face_start = None

                if no_face_start is None:
                    no_face_start = now

                duration = now - no_face_start

                if duration >= NO_FACE_THRESHOLD and (now - last_alert_sent) >= ALERT_COOLDOWN:
                    alert_count += 1
                    last_alert_sent = now

                    logger.info(
                        f"[{session_id}] No-face violation "
                        f"(duration={int(duration)}s, alerts={alert_count})"
                    )

                    status = "warning"
                    message = "Face not detected"

            # ==============================
            # TERMINATION CHECK
            # ==============================
            if alert_count >= MAX_ALERTS:
                status = "terminate"
                message = "Interview terminated due to repeated violations"

                await terminate_interview(
                    session_id,
                    user_id,
                    "Repeated face detection violations"
                )

                await websocket.send_json({
                    "status": status,
                    "message": message,
                    "face_count": face_count,
                    "alert_count": alert_count
                })
                break

            # ---- Send update ----
            await websocket.send_json({
                "status": status,
                "message": message,
                "face_count": face_count,
                "alert_count": alert_count
            })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")

    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")

    finally:
        try:
            await websocket.close()
        except Exception:
            pass

        logger.info(f"🔴 WebSocket closed for session {session_id}")


async def terminate_interview(session_id: str, user_id: str, reason: str):
    """
    Terminate interview and generate feedback with termination reason
    """
    try:
        with get_db() as db:
            session = db.interview_sessions.find_one({
                "id": session_id,
                "user_id": user_id
            })

            if not session:
                logger.error(f"Session {session_id} not found for termination")
                return

            questions = session.get("questions", [])
            interview_type = session.get("interview_type", "technical")
            jd_text = session.get("job_description", "")
            resume_text = session.get("resume_text", "")

            # Get answers from session
            answers_dict = session.get("answers", {})
            answers = list(answers_dict.values()) if isinstance(answers_dict, dict) else []
            q_map = {q["id"]: q.get("text", "") for q in questions}

            total_score = 0
            scored_count = 0
            reference_cache = {}
            updates = {}

            # Evaluate existing answers
            for ans in answers:
                if ans.get("score") is not None or not ans.get("transcript"):
                    continue

                qid = ans.get("question_id")
                question_text = q_map.get(qid)
                if not question_text:
                    continue

                if qid not in reference_cache:
                    from services.llm_service import generate_reference_answer
                    reference_cache[qid] = generate_reference_answer(
                        question_text,
                        jd_text,
                        resume_text,
                        interview_type
                    )

                from services.llm_service import evaluate_answer
                evaluation = evaluate_answer(
                    question_text,
                    ans["transcript"],
                    reference_cache[qid],
                    interview_type
                )

                score = evaluation.get("total_score") or evaluation.get("score") or 0
                feedback = evaluation.get("feedback", [])

                # Add termination reason to feedback
                feedback.append(f"⚠️ Interview terminated: {reason}")

                total_score += score
                scored_count += 1

                updates[qid] = {
                    "score": score,
                    "feedback": feedback,
                    "model_answer": reference_cache[qid]
                }

            # Update all answers
            for qid, update_data in updates.items():
                db.interview_sessions.update_one(
                    {"id": session_id},
                    {"$set": {
                        f"answers.{qid}.score": update_data["score"],
                        f"answers.{qid}.feedback": update_data["feedback"],
                        f"answers.{qid}.model_answer": update_data["model_answer"]
                    }}
                )

            final_score = round(
                total_score / scored_count, 2
            ) if scored_count > 0 else 0

            # Mark session as terminated
            db.interview_sessions.update_one(
                {"id": session_id},
                {"$set": {
                    "status": "terminated",
                    "final_score": final_score,
                    "completed_at": datetime.utcnow(),
                    "termination_reason": reason
                }}
            )

            logger.info(f"Interview {session_id} terminated: {reason}")

    except Exception as e:
        logger.error(f"Error terminating interview {session_id}: {e}")
