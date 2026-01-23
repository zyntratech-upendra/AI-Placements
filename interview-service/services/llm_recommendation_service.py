"""
LLM Recommendation Service
Generates personalized study recommendations using OpenAI LLM
for both resume-based and interview-based learning paths.
"""

from openai import OpenAI
import os
import json
from typing import Optional, List, Dict

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class LLMRecommendationService:
    """Generate LLM-based recommendations for adaptive learning"""
    
    @staticmethod
    async def get_resume_recommendations(
        skills: List[str],
        experience_level: str = "fresher",
        target_role: Optional[str] = None,
        target_company: Optional[str] = None
    ) -> Dict:
        """
        Generate study recommendations based on resume skills.
        
        Args:
            skills: List of skills extracted from resume
            experience_level: fresher, junior, mid, senior
            target_role: Target job role (e.g., "Software Engineer")
            target_company: Target company name (optional)
        
        Returns:
            Dict with recommendations
        """
        try:
            prompt = f"""You are a career advisor and placement preparation expert.

A student has the following profile:
- Skills from Resume: {', '.join(skills)}
- Experience Level: {experience_level}
- Target Role: {target_role or 'Software Engineer'}
{f'- Target Company: {target_company}' if target_company else ''}

Based on this profile, provide personalized recommendations for placement preparation.

Respond in JSON format with this structure:
{{
    "strengths": ["skill1", "skill2"],  // 2-3 strong skills they have
    "gaps": ["area1", "area2"],  // 2-3 areas they should improve
    "study_topics": [
        {{
            "topic": "Topic Name",
            "priority": "high/medium/low",
            "reason": "Why they should study this",
            "resources": ["resource1", "resource2"]
        }}
    ],
    "practice_suggestions": [
        "Practice suggestion 1",
        "Practice suggestion 2"
    ],
    "interview_tips": [
        "Tip 1",
        "Tip 2"
    ],
    "mock_questions": [
        {{
            "type": "technical/behavioral",
            "question": "Sample question they might be asked",
            "hint": "How to approach this"
        }}
    ]
}}

Keep recommendations specific, actionable, and relevant to their skill level."""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a placement preparation expert. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            content = response.choices[0].message.content.strip()
            # Parse JSON from response
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            recommendations = json.loads(content.strip())
            
            return {
                "success": True,
                "type": "resume_based",
                "recommendations": recommendations
            }
            
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse recommendations: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def get_interview_recommendations(
        interview_feedback: Dict,
        interview_type: str = "technical",
        job_description: Optional[str] = None
    ) -> Dict:
        """
        Generate improvement recommendations based on AI interview feedback.
        
        Args:
            interview_feedback: Feedback from completed interview
                - final_score: 0-10 score
                - feedback_summary: Overall feedback
                - weak_areas: List of weak areas identified
                - strong_areas: List of strong areas
            interview_type: technical, behavioral, hr
            job_description: The JD used for the interview
        
        Returns:
            Dict with recommendations
        """
        try:
            prompt = f"""You are an interview coach analyzing a student's AI mock interview performance.

Interview Details:
- Type: {interview_type}
- Score: {interview_feedback.get('final_score', 'N/A')}/10
- Feedback Summary: {interview_feedback.get('feedback_summary', 'No summary available')}
- Weak Areas Identified: {', '.join(interview_feedback.get('weak_areas', ['Not specified']))}
- Strong Areas: {', '.join(interview_feedback.get('strong_areas', ['Not specified']))}
{f'- Job Description: {job_description[:500]}...' if job_description else ''}

Based on this interview performance, provide targeted improvement recommendations.

Respond in JSON format:
{{
    "overall_assessment": "Brief 1-2 sentence assessment",
    "score_interpretation": "What their score means",
    "immediate_improvements": [
        {{
            "area": "Area to improve",
            "priority": "high/medium/low",
            "action": "Specific action to take",
            "example": "Example of what good looks like"
        }}
    ],
    "practice_questions": [
        {{
            "question": "Practice question to try",
            "type": "technical/behavioral",
            "focus_area": "What this tests",
            "tips": "How to answer well"
        }}
    ],
    "study_resources": [
        "Resource or topic to study"
    ],
    "next_steps": [
        "Actionable next step 1",
        "Actionable next step 2"
    ]
}}

Be specific and constructive. Focus on actionable improvements."""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert interview coach. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            content = response.choices[0].message.content.strip()
            # Parse JSON from response
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            recommendations = json.loads(content.strip())
            
            return {
                "success": True,
                "type": "interview_based",
                "interview_score": interview_feedback.get('final_score'),
                "recommendations": recommendations
            }
            
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse recommendations: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def get_combined_recommendations(
        resume_skills: Optional[List[str]] = None,
        interview_history: Optional[List[Dict]] = None,
        weak_areas_from_exams: Optional[List[str]] = None,
        target_company: Optional[str] = None
    ) -> Dict:
        """
        Generate comprehensive recommendations combining all data sources.
        """
        try:
            context_parts = []
            
            if resume_skills:
                context_parts.append(f"Resume Skills: {', '.join(resume_skills)}")
            
            if interview_history:
                avg_score = sum(i.get('final_score', 0) for i in interview_history) / len(interview_history)
                context_parts.append(f"Interview History: {len(interview_history)} interviews, avg score: {avg_score:.1f}/10")
            
            if weak_areas_from_exams:
                context_parts.append(f"Weak Areas from Exams: {', '.join(weak_areas_from_exams)}")
            
            if target_company:
                context_parts.append(f"Target Company: {target_company}")
            
            prompt = f"""You are a comprehensive placement preparation advisor.

Student Profile:
{chr(10).join(context_parts)}

Provide a holistic learning plan that addresses all their needs.

Respond in JSON format:
{{
    "priority_focus": "The #1 thing they should focus on",
    "weekly_plan": [
        {{
            "day": "Monday-Tuesday",
            "focus": "What to focus on",
            "activities": ["Activity 1", "Activity 2"]
        }}
    ],
    "skill_building": [
        {{
            "skill": "Skill name",
            "current_level": "estimated current level",
            "target_level": "where they should be",
            "how_to_improve": "specific steps"
        }}
    ],
    "motivation": "Brief motivational message"
}}"""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a comprehensive placement advisor. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1500
            )
            
            content = response.choices[0].message.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            recommendations = json.loads(content.strip())
            
            return {
                "success": True,
                "type": "combined",
                "recommendations": recommendations
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
llm_recommendation_service = LLMRecommendationService()
