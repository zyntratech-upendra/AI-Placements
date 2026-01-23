"""
Sync Routes - Endpoints to sync data between MongoDB and RAG vector store

Provides endpoints for:
1. Syncing all questions from MongoDB to vector store
2. Syncing single company's questions
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from database import get_mongodb_client
from services.rag_service import get_rag_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sync", tags=["Sync"])


class SyncResponse(BaseModel):
    success: bool
    message: str
    synced_count: int = 0
    total_questions: int = 0


@router.post("/questions", response_model=SyncResponse)
async def sync_all_questions():
    """Sync all questions from MongoDB ParsedQuestions to RAG vector store"""
    try:
        # get_mongodb_client returns the database, not the client
        db = get_mongodb_client()
        
        # Try different collection name variations
        parsed_questions = db["parsedquestions"]
        
        rag_service = get_rag_service()
        
        # Get all parsed question documents
        docs = list(parsed_questions.find({}))
        logger.info(f"Found {len(docs)} ParsedQuestion documents")
        
        if not docs:
            # Try alternate collection names
            for coll_name in ["ParsedQuestion", "ParsedQuestions", "parsed_questions"]:
                alt_coll = db[coll_name]
                docs = list(alt_coll.find({}))
                if docs:
                    logger.info(f"Found {len(docs)} documents in {coll_name}")
                    parsed_questions = alt_coll
                    break
        
        all_questions = []
        for doc in docs:
            company = doc.get("company", "")
            topic = doc.get("topic", "General")
            subtopic = doc.get("subfolder", "")
            
            # Extract questions from all difficulty levels
            for difficulty in ["Easy", "Medium", "Difficult"]:
                questions = doc.get("questionsByDifficulty", {}).get(difficulty, [])
                
                for q in questions:
                    all_questions.append({
                        "questionId": q.get("questionId", ""),
                        "text": q.get("text", ""),
                        "options": q.get("options", []),
                        "answer": q.get("answer", ""),
                        "explanation": q.get("explanation"),
                        "topic": topic,
                        "subtopic": subtopic,
                        "difficulty": difficulty,
                        "company": company
                    })
        
        logger.info(f"Found {len(all_questions)} questions to sync")
        
        if not all_questions:
            return SyncResponse(
                success=True,
                message="No questions found to sync",
                synced_count=0,
                total_questions=0
            )
        
        # Embed in batches of 50
        batch_size = 50
        synced = 0
        
        for i in range(0, len(all_questions), batch_size):
            batch = all_questions[i:i + batch_size]
            count = rag_service.embed_questions_batch(batch)
            synced += count
            logger.info(f"Synced batch {i//batch_size + 1}: {count} questions")
        
        return SyncResponse(
            success=True,
            message=f"Successfully synced {synced} questions to vector store",
            synced_count=synced,
            total_questions=len(all_questions)
        )
        
    except Exception as e:
        logger.error(f"Error syncing questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/questions/{company}", response_model=SyncResponse)
async def sync_company_questions(company: str):
    """Sync questions for a specific company"""
    try:
        # get_mongodb_client returns the database, not the client
        db = get_mongodb_client()
        parsed_questions = db["parsedquestions"]
        
        rag_service = get_rag_service()
        
        # Get parsed question documents for this company
        docs = list(parsed_questions.find({"company": company}))
        
        if not docs:
            return SyncResponse(
                success=True,
                message=f"No questions found for company: {company}",
                synced_count=0,
                total_questions=0
            )
        
        all_questions = []
        for doc in docs:
            topic = doc.get("topic", "General")
            subtopic = doc.get("subfolder", "")
            
            for difficulty in ["Easy", "Medium", "Difficult"]:
                questions = doc.get("questionsByDifficulty", {}).get(difficulty, [])
                
                for q in questions:
                    all_questions.append({
                        "questionId": q.get("questionId", ""),
                        "text": q.get("text", ""),
                        "options": q.get("options", []),
                        "answer": q.get("answer", ""),
                        "explanation": q.get("explanation"),
                        "topic": topic,
                        "subtopic": subtopic,
                        "difficulty": difficulty,
                        "company": company
                    })
        
        synced = rag_service.embed_questions_batch(all_questions)
        
        return SyncResponse(
            success=True,
            message=f"Successfully synced {synced} questions for {company}",
            synced_count=synced,
            total_questions=len(all_questions)
        )
        
    except Exception as e:
        logger.error(f"Error syncing company questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
