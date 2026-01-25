"""
Face Events API Routes for Interview Service
Handles face detection events and analytics storage via Python backend
"""

from fastapi import APIRouter, HTTPException, Request, status
from datetime import datetime
from models import FaceAnalyticsModel, PresenceLog, AttentionLog, EmotionLog, AntiCheatIncident
from database import get_db
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/face-events/{session_id}")
async def record_face_events(session_id: str, request: Request):
    """
    Record face detection events for a session
    
    Parameters:
    - session_id: Interview session ID
    - Request body should contain:
      - presence: Presence detection data
      - attention: Attention tracking data
      - emotion: Emotion analysis data
      - anti_cheat: Anti-cheating indicators
    """
    user_id = request.state.user["_id"]
    
    try:
        body = await request.json()
        presence_data = body.get("presence")
        attention_data = body.get("attention")
        emotion_data = body.get("emotion")
        anti_cheat_data = body.get("anti_cheat")
        
        with get_db() as db:
            # Find or create face analytics record
            analytics = db.face_analytics.find_one({
                "session_id": session_id,
                "candidate_id": str(user_id)
            })
            
            if not analytics:
                analytics = {
                    "session_id": session_id,
                    "candidate_id": str(user_id),
                    "presence": {"presenceLogs": []},
                    "attention": {"attentionLogs": []},
                    "emotion": {"emotionTimeline": []},
                    "antiCheat": {"incidents": []},
                    "created_at": datetime.now(),
                    "updated_at": datetime.now()
                }
            
            # Update presence logs
            if presence_data:
                if "presenceLogs" not in analytics.get("presence", {}):
                    analytics["presence"] = analytics.get("presence", {})
                    analytics["presence"]["presenceLogs"] = []
                
                analytics["presence"]["presenceLogs"].append({
                    "timestamp": datetime.now(),
                    "detected": presence_data.get("detected"),
                    "confidence": presence_data.get("confidence"),
                    "faceCount": presence_data.get("faceCount", 0)
                })
            
            # Update attention logs
            if attention_data:
                if "attentionLogs" not in analytics.get("attention", {}):
                    analytics["attention"] = analytics.get("attention", {})
                    analytics["attention"]["attentionLogs"] = []
                
                analytics["attention"]["attentionLogs"].append({
                    "timestamp": datetime.now(),
                    "lookingAway": attention_data.get("lookingAway"),
                    "headRotation": attention_data.get("headRotation"),
                    "eyeAspectRatio": attention_data.get("eyeAspectRatio"),
                    "eyesOpen": attention_data.get("eyesOpen"),
                    "attentionScore": attention_data.get("attentionScore")
                })
            
            # Update emotion logs
            if emotion_data and emotion_data.get("dominantEmotion"):
                if "emotionTimeline" not in analytics.get("emotion", {}):
                    analytics["emotion"] = analytics.get("emotion", {})
                    analytics["emotion"]["emotionTimeline"] = []
                
                analytics["emotion"]["emotionTimeline"].append({
                    "timestamp": datetime.now(),
                    "emotion": emotion_data.get("dominantEmotion"),
                    "confidence": emotion_data.get("dominantEmotionScore"),
                    "confidenceIndicator": emotion_data.get("confidenceIndicator")
                })
            
            # Update anti-cheat incidents
            if anti_cheat_data and anti_cheat_data.get("alerts"):
                if "incidents" not in analytics.get("antiCheat", {}):
                    analytics["antiCheat"] = analytics.get("antiCheat", {})
                    analytics["antiCheat"]["incidents"] = []
                
                for alert in anti_cheat_data["alerts"]:
                    analytics["antiCheat"]["incidents"].append({
                        "timestamp": datetime.now(),
                        "type": alert.get("type"),
                        "severity": alert.get("severity"),
                        "description": alert.get("message")
                    })
                
                analytics["antiCheat"]["cheatingRiskLevel"] = anti_cheat_data.get("riskLevel", "LOW")
                analytics["antiCheat"]["multipleFacesDetected"] = anti_cheat_data.get("faceCount", 0)
            
            analytics["updated_at"] = datetime.now()
            
            # Save or update record
            if "_id" in analytics:
                db.face_analytics.update_one(
                    {"_id": analytics["_id"]},
                    {"$set": analytics}
                )
            else:
                result = db.face_analytics.insert_one(analytics)
                analytics["_id"] = result.inserted_id
            
            logger.info(f"Face events recorded for session {session_id}")
            
            return {
                "success": True,
                "message": "Face events recorded",
                "data": {
                    "session_id": session_id,
                    "presence_logs": len(analytics.get("presence", {}).get("presenceLogs", [])),
                    "attention_logs": len(analytics.get("attention", {}).get("attentionLogs", [])),
                    "emotion_logs": len(analytics.get("emotion", {}).get("emotionTimeline", [])),
                    "anti_cheat_incidents": len(analytics.get("antiCheat", {}).get("incidents", []))
                }
            }
            
    except Exception as e:
        logger.error(f"Error recording face events: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error recording face events: {str(e)}"
        )

@router.get("/face-analytics/{session_id}")
async def get_face_analytics(session_id: str, request: Request):
    """
    Retrieve face analytics for a session
    """
    user_id = request.state.user["_id"]
    
    try:
        with get_db() as db:
            analytics = db.face_analytics.find_one({
                "session_id": session_id,
                "candidate_id": str(user_id)
            })
            
            if not analytics:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Analytics not found"
                )
            
            # Convert ObjectId to string for JSON serialization
            analytics["_id"] = str(analytics["_id"])
            
            # Calculate summary
            summary = calculate_summary(analytics)
            analytics["summary"] = summary
            
            return {
                "success": True,
                "data": analytics
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving face analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving analytics: {str(e)}"
        )

@router.post("/face-analytics/{session_id}/finalize")
async def finalize_face_analytics(session_id: str, request: Request):
    """
    Finalize and calculate final analytics for a session
    """
    user_id = request.state.user["_id"]
    
    try:
        with get_db() as db:
            analytics = db.face_analytics.find_one({
                "session_id": session_id,
                "candidate_id": str(user_id)
            })
            
            if not analytics:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Analytics not found"
                )
            
            # Calculate final summary
            summary = calculate_summary(analytics)
            analytics["summary"] = summary
            analytics["updated_at"] = datetime.now()
            
            # Save
            db.face_analytics.update_one(
                {"_id": analytics["_id"]},
                {"$set": analytics}
            )
            
            logger.info(f"Face analytics finalized for session {session_id}")
            
            analytics["_id"] = str(analytics["_id"])
            
            return {
                "success": True,
                "message": "Analytics finalized",
                "data": analytics
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finalizing face analytics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error finalizing analytics: {str(e)}"
        )

def calculate_summary(analytics: dict) -> dict:
    """
    Calculate summary statistics from analytics data
    """
    summary = {}
    
    # Presence percentage
    presence_logs = analytics.get("presence", {}).get("presenceLogs", [])
    if presence_logs:
        detected = len([p for p in presence_logs if p.get("detected")])
        summary["presencePercentage"] = round((detected / len(presence_logs)) * 100, 2)
    else:
        summary["presencePercentage"] = 0
    
    # Attention score
    attention_logs = analytics.get("attention", {}).get("attentionLogs", [])
    if attention_logs:
        scores = [a.get("attentionScore", 0) for a in attention_logs]
        summary["attentionScore"] = round(sum(scores) / len(scores), 2) if scores else 0
    else:
        summary["attentionScore"] = 0
    
    # Emotional consistency
    emotion_timeline = analytics.get("emotion", {}).get("emotionTimeline", [])
    if emotion_timeline:
        emotion_counts = {}
        for e in emotion_timeline:
            emotion = e.get("emotion")
            emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1
        
        max_count = max(emotion_counts.values()) if emotion_counts else 0
        summary["emotionalConsistency"] = round((max_count / len(emotion_timeline)) * 100, 2) if emotion_timeline else 0
    else:
        summary["emotionalConsistency"] = 0
    
    # Overall suspicion score
    summary["overallSuspicionScore"] = 0
    incidents = analytics.get("antiCheat", {}).get("incidents", [])
    if incidents:
        critical = len([i for i in incidents if i.get("severity") == "CRITICAL"])
        high = len([i for i in incidents if i.get("severity") == "HIGH"])
        summary["overallSuspicionScore"] = min(100, (critical * 30) + (high * 15))
    
    return summary
