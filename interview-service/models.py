"""
Face Analytics Model for MongoDB
Stores face detection events and analytics for interviews
"""

from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field

class HeadRotation(BaseModel):
    """Head rotation angles"""
    yaw: float = 0  # Left/Right
    pitch: float = 0  # Up/Down
    roll: float = 0  # Tilt

class PresenceLog(BaseModel):
    """Individual presence detection log"""
    timestamp: datetime
    detected: bool
    confidence: float
    faceCount: int

class AttentionLog(BaseModel):
    """Individual attention check log"""
    timestamp: datetime
    lookingAway: bool
    headRotation: HeadRotation
    eyeAspectRatio: float
    eyesOpen: bool
    attentionScore: float

class PresenceData(BaseModel):
    """Presence detection summary"""
    totalTimeDetected: Optional[int] = None
    totalTimeNotDetected: Optional[int] = None
    presencePercentage: Optional[float] = None
    presenceLogs: List[PresenceLog] = []

class AttentionData(BaseModel):
    """Attention tracking summary"""
    totalCheckCount: Optional[int] = None
    lookingAwayCount: Optional[int] = None
    lookingAwayPercentage: Optional[float] = None
    averageHeadRotation: Optional[float] = None
    attentionScore: Optional[float] = None
    attentionLogs: List[AttentionLog] = []

class IdentityData(BaseModel):
    """Identity verification data"""
    verified: Optional[bool] = None
    faceMatchScore: Optional[float] = None
    verificationAttempts: Optional[int] = None
    identityAlerts: List[Dict] = []

class EmotionLog(BaseModel):
    """Individual emotion detection log"""
    timestamp: datetime
    emotion: str
    confidence: float
    confidenceIndicator: str

class EmotionData(BaseModel):
    """Emotion analysis summary"""
    dominantEmotions: Dict[str, float] = {}
    emotionTimeline: List[EmotionLog] = []
    overallConfidenceScore: Optional[float] = None

class AntiCheatIncident(BaseModel):
    """Individual anti-cheating incident"""
    timestamp: datetime
    type: str
    severity: str
    description: str

class AntiCheatData(BaseModel):
    """Anti-cheating detection summary"""
    multipleFacesDetected: Optional[int] = None
    phonesDetected: Optional[int] = None
    backgroundPeopleDetected: Optional[int] = None
    cheatingRiskLevel: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    incidents: List[AntiCheatIncident] = []

class SummaryStatistics(BaseModel):
    """Summary statistics for the interview"""
    totalDuration: Optional[float] = None
    presencePercentage: Optional[float] = None
    attentionScore: Optional[float] = None
    emotionalConsistency: Optional[float] = None
    overallSuspicionScore: Optional[float] = None

class FaceAnalyticsModel(BaseModel):
    """Complete face analytics record"""
    session_id: str
    candidate_id: str
    interview_id: Optional[str] = None
    
    presence: PresenceData = Field(default_factory=PresenceData)
    attention: AttentionData = Field(default_factory=AttentionData)
    identity: IdentityData = Field(default_factory=IdentityData)
    emotion: EmotionData = Field(default_factory=EmotionData)
    antiCheat: AntiCheatData = Field(default_factory=AntiCheatData)
    summary: SummaryStatistics = Field(default_factory=SummaryStatistics)
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session_123",
                "candidate_id": "candidate_456",
                "interview_id": "interview_789",
                "presence": {
                    "presencePercentage": 95.5,
                    "presenceLogs": []
                },
                "attention": {
                    "attentionScore": 82.3,
                    "attentionLogs": []
                },
                "emotion": {
                    "dominantEmotions": {
                        "neutral": 0.45,
                        "happy": 0.25,
                        "sad": 0.15
                    },
                    "overallConfidenceScore": 78.5
                },
                "antiCheat": {
                    "cheatingRiskLevel": "LOW",
                    "incidents": []
                }
            }
        }
