"""
Resume Assessment Routes
Handles resume PDF + job description analysis for assessment generation.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.pdf_service import extract_text_from_pdf
from openai import OpenAI
import os
import json

router = APIRouter(prefix="/resume-assessment", tags=["Resume Assessment"])

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@router.post("/extract-topics")
async def extract_topics_from_resume(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    """
    Extract relevant topics for assessment from resume and job description.
    Returns a list of topics that should be tested.
    """
    try:
        # Parse resume PDF
        resume_bytes = await resume.read()
        resume_text = extract_text_from_pdf(resume_bytes)
        
        if not resume_text or len(resume_text) < 50:
            raise HTTPException(status_code=400, detail="Could not extract text from resume PDF")
        
        # Use LLM to extract topics
        prompt = f"""You are an assessment generator for placement preparation.

Given a candidate's resume and the job description they're applying for, identify the key technical topics that should be tested.

RESUME:
{resume_text[:3000]}

JOB DESCRIPTION:
{job_description[:2000]}

Based on both the resume skills and job requirements, identify 3-5 topics for a technical assessment.
Focus on topics that are:
1. Mentioned in the job description as requirements
2. Present in the candidate's resume (to test current knowledge)
3. Common in placement exams for this role

Return ONLY a JSON object with this structure:
{{
    "topics": [
        {{
            "name": "Topic Name",
            "subtopic": "Specific subtopic (optional)",
            "difficulty": "Easy/Medium/Hard",
            "reason": "Why this topic is important for the role"
        }}
    ],
    "job_title": "Extracted job title from JD",
    "estimated_duration": 15,
    "question_count": 10
}}

Return ONLY the JSON, no other text."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a technical assessment expert. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse JSON
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        
        result = json.loads(content.strip())
        
        return {
            "success": True,
            "resume_length": len(resume_text),
            "topics": result.get("topics", []),
            "job_title": result.get("job_title", "Software Engineer"),
            "estimated_duration": result.get("estimated_duration", 15),
            "question_count": result.get("question_count", 10)
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse LLM response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-questions")
async def generate_llm_questions(
    topics: str = Form(...),
    question_count: int = Form(5),
    difficulty: str = Form("Medium")
):
    """
    Generate questions using LLM for topics not in question bank.
    This is the fallback when question bank doesn't have matching topics.
    """
    try:
        prompt = f"""Generate {question_count} multiple choice questions for a placement assessment.

Topics to cover: {topics}
Difficulty: {difficulty}

Generate questions that are:
1. Clear and unambiguous
2. Have exactly 4 options (A, B, C, D)
3. Have one correct answer
4. Appropriate for the difficulty level

Return ONLY a JSON array:
[
    {{
        "text": "Question text here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": "A",
        "topic": "Topic name",
        "difficulty": "{difficulty}"
    }}
]

Return ONLY the JSON array, no other text."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a technical interviewer creating assessment questions. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=2000
        )
        
        content = response.choices[0].message.content.strip()
        
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        
        questions = json.loads(content.strip())
        
        # Add IDs
        for idx, q in enumerate(questions):
            q["questionId"] = f"llm-{idx}-{hash(q['text']) % 100000}"
        
        return {
            "success": True,
            "questions": questions,
            "source": "llm_generated"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
