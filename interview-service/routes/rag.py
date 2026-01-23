"""
RAG Routes - API endpoints for RAG functionality

Provides endpoints for:
1. Embedding questions into vector store
2. Finding similar questions
3. Generating explanations for wrong answers
4. Matching resumes to topics
"""

from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from services.rag_service import get_rag_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rag", tags=["RAG"])


# ==========================================
# Request/Response Models
# ==========================================

class QuestionEmbedRequest(BaseModel):
    questionId: str
    text: str
    options: List[str]
    answer: str
    explanation: Optional[str] = None
    topic: str
    subtopic: str = ""
    difficulty: str = "Medium"
    company: str = ""


class BatchEmbedRequest(BaseModel):
    questions: List[Dict[str, Any]]


class SimilarQuestionsRequest(BaseModel):
    query: str
    n_results: int = 5
    topic_filter: Optional[str] = None
    company_filter: Optional[str] = None


class ExplanationRequest(BaseModel):
    question_text: str
    correct_answer: str
    user_answer: str
    topic: str


class ResumeMatchRequest(BaseModel):
    resume_text: str
    available_topics: List[str] = []
    n_results: int = 5


class EmbedResumeRequest(BaseModel):
    student_id: str
    resume_text: str
    skills: List[str] = []


# ==========================================
# Routes
# ==========================================

@router.get("/stats")
async def get_stats():
    """Get RAG service statistics"""
    try:
        rag_service = get_rag_service()
        stats = rag_service.get_stats()
        return {"success": True, "stats": stats}
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embed-question")
async def embed_question(request: QuestionEmbedRequest):
    """Embed a single question into the vector store"""
    try:
        rag_service = get_rag_service()
        success = rag_service.embed_question(
            question_id=request.questionId,
            question_text=request.text,
            options=request.options,
            answer=request.answer,
            explanation=request.explanation,
            topic=request.topic,
            subtopic=request.subtopic,
            difficulty=request.difficulty,
            company=request.company
        )
        
        if success:
            return {"success": True, "message": "Question embedded successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to embed question")
            
    except Exception as e:
        logger.error(f"Error embedding question: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embed-questions-batch")
async def embed_questions_batch(request: BatchEmbedRequest):
    """Embed multiple questions in batch"""
    try:
        rag_service = get_rag_service()
        count = rag_service.embed_questions_batch(request.questions)
        
        return {
            "success": True,
            "embedded_count": count,
            "message": f"Embedded {count} questions"
        }
        
    except Exception as e:
        logger.error(f"Error embedding questions batch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/find-similar")
async def find_similar_questions(request: SimilarQuestionsRequest):
    """Find questions similar to the query"""
    try:
        rag_service = get_rag_service()
        similar = rag_service.find_similar_questions(
            query_text=request.query,
            n_results=request.n_results,
            topic_filter=request.topic_filter,
            company_filter=request.company_filter
        )
        
        return {"success": True, "similar_questions": similar}
        
    except Exception as e:
        logger.error(f"Error finding similar questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-explanation")
async def generate_explanation(request: ExplanationRequest):
    """Generate explanation for a wrong answer using RAG"""
    try:
        rag_service = get_rag_service()
        explanation = rag_service.generate_explanation(
            question_text=request.question_text,
            correct_answer=request.correct_answer,
            user_answer=request.user_answer,
            topic=request.topic
        )
        
        return {"success": True, "explanation": explanation}
        
    except Exception as e:
        logger.error(f"Error generating explanation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embed-resume")
async def embed_resume(request: EmbedResumeRequest):
    """Embed a student's resume for skill matching"""
    try:
        rag_service = get_rag_service()
        success = rag_service.embed_resume(
            student_id=request.student_id,
            resume_text=request.resume_text,
            skills=request.skills
        )
        
        if success:
            return {"success": True, "message": "Resume embedded successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to embed resume")
            
    except Exception as e:
        logger.error(f"Error embedding resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/match-resume-topics")
async def match_resume_to_topics(request: ResumeMatchRequest):
    """Match resume content to relevant question topics"""
    try:
        rag_service = get_rag_service()
        matches = rag_service.match_resume_to_topics(
            resume_text=request.resume_text,
            available_topics=request.available_topics,
            n_results=request.n_results
        )
        
        return {"success": True, "matched_topics": matches}
        
    except Exception as e:
        logger.error(f"Error matching resume to topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear")
async def clear_embeddings():
    """Clear all embeddings (admin only, use with caution)"""
    try:
        rag_service = get_rag_service()
        success = rag_service.clear_all()
        
        if success:
            return {"success": True, "message": "All embeddings cleared"}
        else:
            raise HTTPException(status_code=500, detail="Failed to clear embeddings")
            
    except Exception as e:
        logger.error(f"Error clearing embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))
