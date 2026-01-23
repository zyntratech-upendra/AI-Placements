import json
import logging
from groq import Groq
from config import get_settings, get_settingsgpt
from openai import OpenAI


# ---------------------------
# CLIENT HELPERS
# ---------------------------

def get_client():
    """Lazy initialization of Groq client."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is required. Please set it in your .env file.")
    return Groq(api_key=settings.groq_api_key)


def get_clientgpt():
    """Lazy initialization of OpenAI client."""
    settingsgpt = get_settingsgpt()
    if not settingsgpt.openai_api_key:
        raise ValueError("OPENAI_API_KEY is required. Please set it in your .env file.")
    return OpenAI(api_key=settingsgpt.openai_api_key)


# ---------------------------
# QUESTION GENERATION LOGIC
# ---------------------------

def calculate_question_count(duration_seconds: int, seconds_per_question: int = 90) -> int:
    """
    Rule:
    - Each question = 90 seconds.
    - Total questions = floor(duration / 90).
    - Minimum 1 question.
    """
    return max(1, duration_seconds // seconds_per_question)


def generate_questions(job_description: str, resume_text: str, duration_seconds: int, interview_type: str = "technical") -> list:
    logger = logging.getLogger("backend.llm_service")

    # 1. Decide number of questions based on duration
    question_count = calculate_question_count(duration_seconds)

    # 2. Try initializing open ai client
    try:
        client = get_clientgpt()
    except ValueError as e:
        logger.warning(f"{e} Falling back to stub questions.")
        # Fallback default based on interview type
        if interview_type == "hr":
            default_question = "Tell me about yourself and why you're interested in this role."
        else:
            default_question = "Describe a project where you demonstrated problem-solving skills."
        
        return [
            {
                "id": "q1",
                "text": default_question,
                "estimated_seconds": min(180, max(30, int(duration_seconds / 3)))
            }
        ]

    # 3. System Prompt enforcing strict JSON + fixed number of questions + interview type
    interview_type_instructions = ""
    if interview_type == "technical":
        interview_type_instructions = """
- Focus STRICTLY on technical skills, programming concepts, system design, algorithms, and technical problem-solving.
- Ask about specific technologies, tools, frameworks mentioned in the resume or job description.
- Include questions about coding practices, architecture, debugging, and technical challenges.
- Do NOT include HR, behavioral, or soft skills questions.
"""
    elif interview_type == "hr":
        interview_type_instructions = """
- Focus STRICTLY on HR/behavioral questions, soft skills, cultural fit, and interpersonal abilities.
- Ask about teamwork, leadership, conflict resolution, motivation, career goals, and work style.
- Include situational questions (e.g., "Tell me about a time when...").
- Do NOT include technical, coding, or programming questions.
"""
    
    system_prompt = f"""
You are an expert {interview_type} interviewer.
Produce ONLY valid JSON in this exact structure:
{{
  "questions": [
     {{"id": "q1", "text": "Example question?", "estimated_seconds": 90}}
  ]
}}

RULES:
- Generate exactly {question_count} questions.
- IDs must be q1, q2, q3 ... in order.
- Each question MUST relate to the job description & resume.
- Each question MUST have "estimated_seconds": 90.
- Interview Type: {interview_type.upper()}
{interview_type_instructions}
- Do NOT include explanations. Output ONLY JSON.
"""

    # 4. User prompt containing JD, resume, total time, and interview type
    user_prompt = f"""
Job Description:
{job_description}

Resume:
{resume_text}

Total Interview Duration (seconds): {duration_seconds}
Interview Type: {interview_type.upper()}

Generate exactly {question_count} structured {interview_type} interview questions that match the interview type requirements.
"""

    # 5. Call Groq LLM
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=1500,
        )
    except Exception as e:
        raise ValueError(f"Error calling Groq API: {str(e)}") from e

    content = response.choices[0].message.content.strip()

    # 6. Parse JSON from Groq response
    try:
        result = json.loads(content)
        return result.get("questions", [])

    except json.JSONDecodeError:
        # Fix JSON if wrapped in ``` blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        result = json.loads(content)
        return result.get("questions", [])


# ---------------------------
# GENERATE IDEAL REFERENCE ANSWERS
# ---------------------------

def generate_reference_answer(question: str, jd: str, resume: str, interview_type: str = "technical"):
    client = get_clientgpt()
    
    # Adapt system prompt based on interview type
    if interview_type == "technical":
        system_prompt = """
You are an experienced technical interviewer and career coach.
Your task is to write an ideal model answer to each technical interview question.

Guidelines:
- Carefully consider the candidate's resume and the given job description.
- Craft a professional, confident, and concise answer that shows relevant technical experience, depth, and problem-solving ability.
- Highlight practical technical examples, coding practices, system design knowledge, or technical achievements that align with the role.
- Demonstrate technical competency, understanding of concepts, and ability to explain complex technical topics clearly.
- Avoid generic statements, buzzwords, or overly long explanations.
- The tone should sound natural, as if spoken by a well-prepared technical candidate during an interview.
- Do not include explanations, formatting, or commentary — only provide the direct answer text.
"""
    else:  # HR interview
        system_prompt = """
You are an experienced HR interviewer and career coach.
Your task is to write an ideal model answer to each HR/behavioral interview question.

Guidelines:
- Carefully consider the candidate's resume and the given job description.
- Craft a professional, confident, and concise answer that shows relevant soft skills, behavioral examples, and cultural fit.
- Use the STAR method (Situation, Task, Action, Result) when appropriate for behavioral questions.
- Highlight practical examples of teamwork, leadership, problem-solving, conflict resolution, or other relevant soft skills.
- Show self-awareness, emotional intelligence, and alignment with company values.
- Avoid generic statements, buzzwords, or overly long explanations.
- The tone should sound natural, as if spoken by a well-prepared candidate during an HR interview.
- Do not include explanations, formatting, or commentary — only provide the direct answer text.
"""

    
    user_prompt = f"""
Job Description:
{jd}

Resume Summary:
{resume}

Question:
{question}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.5,
        max_tokens=500,
    )
    
    return response.choices[0].message.content.strip()


# ---------------------------
# ANSWER EVALUATION
# ---------------------------

def evaluate_answer(question: str, transcript: str, reference_answer: str, interview_type: str = "technical") -> dict:
    client = get_clientgpt()

    # Adapt evaluation criteria based on interview type
    if interview_type == "technical":
        evaluation_criteria = """
- relevance: Does the answer directly address the technical question asked?
- accuracy: Are the technical statements, concepts, and facts correct and free of errors?
- depth: Does the answer show deep technical reasoning, understanding of trade-offs, and technical understanding?
- clarity: Is the technical explanation well-structured, clear, and easy to follow?
- fit: Overall technical competency for the role based on the answer quality.
"""
        evaluator_role = "expert technical interviewer"
    else:  # HR interview
        evaluation_criteria = """
- relevance: Does the answer directly address the behavioral/HR question asked?
- accuracy: Are the examples and situations described authentic and believable?
- depth: Does the answer show self-awareness, reflection, and understanding of behavioral patterns?
- clarity: Is the answer well-structured using STAR method (if applicable), clear, and concise?
- fit: Overall cultural fit, soft skills, and alignment with role requirements based on the answer quality.
"""
        evaluator_role = "expert HR interviewer"

    system_prompt = f"""
You are an {evaluator_role}. Your job is to evaluate a candidate's response using a structured, consistent rubric.

Follow these rules STRICTLY:

1. Assign each category a score from 1 to 10 (integers only).
2. Base scores ONLY on the candidate's actual text. Do NOT infer missing details.
3. Do NOT give perfect scores unless the answer fully demonstrates excellence.
4. Do NOT include any text outside the JSON. No explanations. No commentary.
5. All output must be valid JSON. If you are unsure, return the closest valid JSON.

Evaluation Criteria ({interview_type.upper()} Interview):

{evaluation_criteria}

Output Format (strict):

{{
  "scores": {{
    "relevance": int,
    "accuracy": int,
    "depth": int,
    "clarity": int,
    "fit": int
  }},
  "total_score": float,
  "feedback": [
    "Short, specific point of improvement",
    "Short, specific strength",
    "Another short, specific note"
  ],
  "comparison_summary": "1–2 sentence comparison with an ideal expert-level answer."
}}

Compute total_score as the average of the five category scores, then scale it to a value between 1 and 10 (rounded to one decimal place).

Return ONLY this JSON. No other text.
"""


    user_prompt = f"""
Question: {question}

Candidate Answer:
{transcript}

Ideal Reference Answer:
{reference_answer}

Score objectively. Penalize vague or incorrect answers.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.2,
        max_tokens=1000,
    )

    content = response.choices[0].message.content.strip()

    # Parse JSON safely
    try:
        return json.loads(content)

    except json.JSONDecodeError:
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content)
