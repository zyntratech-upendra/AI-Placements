"""
API Routes for LLM-based Recommendations
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from services.llm_recommendation_service import llm_recommendation_service

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])


class ResumeRecommendationRequest(BaseModel):
    skills: List[str]
    experience_level: Optional[str] = "fresher"
    target_role: Optional[str] = None
    target_company: Optional[str] = None


class InterviewRecommendationRequest(BaseModel):
    interview_feedback: Dict
    interview_type: Optional[str] = "technical"
    job_description: Optional[str] = None


class CombinedRecommendationRequest(BaseModel):
    resume_skills: Optional[List[str]] = None
    interview_history: Optional[List[Dict]] = None
    weak_areas_from_exams: Optional[List[str]] = None
    target_company: Optional[str] = None


@router.post("/resume")
async def get_resume_recommendations(request: ResumeRecommendationRequest):
    """
    Get personalized study recommendations based on resume skills.
    
    Request body:
    - skills: List of skills from resume
    - experience_level: fresher/junior/mid/senior (optional)
    - target_role: Target job role (optional)
    - target_company: Target company (optional)
    """
    if not request.skills or len(request.skills) == 0:
        raise HTTPException(status_code=400, detail="At least one skill is required")
    
    result = await llm_recommendation_service.get_resume_recommendations(
        skills=request.skills,
        experience_level=request.experience_level,
        target_role=request.target_role,
        target_company=request.target_company
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate recommendations"))
    
    return result


@router.post("/interview")
async def get_interview_recommendations(request: InterviewRecommendationRequest):
    """
    Get improvement recommendations based on AI interview feedback.
    
    Request body:
    - interview_feedback: Dict with final_score, feedback_summary, weak_areas, strong_areas
    - interview_type: technical/behavioral/hr (optional)
    - job_description: The JD used in interview (optional)
    """
    if not request.interview_feedback:
        raise HTTPException(status_code=400, detail="Interview feedback is required")
    
    result = await llm_recommendation_service.get_interview_recommendations(
        interview_feedback=request.interview_feedback,
        interview_type=request.interview_type,
        job_description=request.job_description
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate recommendations"))
    
    return result


@router.post("/combined")
async def get_combined_recommendations(request: CombinedRecommendationRequest):
    """
    Get comprehensive recommendations combining all data sources.
    
    Request body (all optional):
    - resume_skills: Skills from resume
    - interview_history: List of past interview feedbacks
    - weak_areas_from_exams: Weak areas from placement exams
    - target_company: Target company
    """
    result = await llm_recommendation_service.get_combined_recommendations(
        resume_skills=request.resume_skills,
        interview_history=request.interview_history,
        weak_areas_from_exams=request.weak_areas_from_exams,
        target_company=request.target_company
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate recommendations"))
    
    return result


@router.get("/health")
async def health_check():
    """Health check for recommendations service"""
    return {"status": "ok", "service": "llm-recommendations"}
