"""
RAG Service - Embedding and Retrieval for Adaptive Learning

Uses ChromaDB for vector storage and OpenAI embeddings for semantic search.
Provides contextual question retrieval for:
1. Wrong answer explanations
2. Similar question finding
3. Resume-to-topic matching
"""

import os
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from openai import OpenAI
from config import get_settingsgpt

logger = logging.getLogger(__name__)


class RAGService:
    """
    Retrieval-Augmented Generation service for adaptive learning.
    Handles embeddings and semantic search over the question bank.
    """

    def __init__(self):
        """Initialize RAG service with ChromaDB and OpenAI embeddings"""
        try:
            settings = get_settingsgpt()
            self.openai_client = OpenAI(api_key=settings.openai_api_key)
            
            # Initialize ChromaDB with persistent storage
            persist_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
            os.makedirs(persist_dir, exist_ok=True)
            
            self.chroma_client = chromadb.PersistentClient(
                path=persist_dir,
                settings=Settings(anonymized_telemetry=False)
            )
            
            # Create or get collections
            self.questions_collection = self.chroma_client.get_or_create_collection(
                name="questions",
                metadata={"description": "Question bank embeddings"}
            )
            
            self.resumes_collection = self.chroma_client.get_or_create_collection(
                name="resumes",
                metadata={"description": "Resume embeddings"}
            )
            
            logger.info("RAG Service initialized successfully")
            logger.info(f"Questions collection has {self.questions_collection.count()} items")
            
        except Exception as e:
            logger.error(f"Failed to initialize RAG service: {e}")
            raise

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding vector for text using OpenAI"""
        try:
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error getting embedding: {e}")
            raise

    def _get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for multiple texts in batch"""
        try:
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"Error getting batch embeddings: {e}")
            raise

    # ==========================================
    # Question Bank Embedding Functions
    # ==========================================

    def embed_question(
        self,
        question_id: str,
        question_text: str,
        options: List[str],
        answer: str,
        explanation: Optional[str],
        topic: str,
        subtopic: str,
        difficulty: str,
        company: str
    ) -> bool:
        """Embed a single question into the vector store"""
        try:
            # Create rich text for embedding
            options_text = " | ".join([f"{chr(65+i)}. {opt}" for i, opt in enumerate(options)])
            full_text = f"Question: {question_text}\nOptions: {options_text}\nTopic: {topic}/{subtopic}\nDifficulty: {difficulty}"
            
            if explanation:
                full_text += f"\nExplanation: {explanation}"
            
            embedding = self._get_embedding(full_text)
            
            # Add to ChromaDB
            self.questions_collection.upsert(
                ids=[question_id],
                embeddings=[embedding],
                documents=[full_text],
                metadatas=[{
                    "question_text": question_text[:500],  # Truncate for metadata
                    "answer": answer,
                    "topic": topic,
                    "subtopic": subtopic,
                    "difficulty": difficulty,
                    "company": company,
                    "has_explanation": bool(explanation)
                }]
            )
            
            logger.info(f"Embedded question: {question_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to embed question {question_id}: {e}")
            return False

    def embed_questions_batch(self, questions: List[Dict[str, Any]]) -> int:
        """Embed multiple questions in batch for efficiency"""
        try:
            if not questions:
                return 0
            
            ids = []
            documents = []
            metadatas = []
            
            for q in questions:
                question_id = q.get("questionId", q.get("_id", ""))
                if not question_id:
                    continue
                    
                question_text = q.get("text", "")
                options = q.get("options", [])
                options_text = " | ".join([f"{chr(65+i)}. {opt}" for i, opt in enumerate(options)])
                
                full_text = f"Question: {question_text}\nOptions: {options_text}"
                
                if q.get("explanation"):
                    full_text += f"\nExplanation: {q['explanation']}"
                
                ids.append(str(question_id))
                documents.append(full_text)
                metadatas.append({
                    "question_text": question_text[:500],
                    "answer": q.get("answer", ""),
                    "topic": q.get("topic", q.get("section", "General")),
                    "subtopic": q.get("subtopic", ""),
                    "difficulty": q.get("difficulty", "Medium"),
                    "company": q.get("company", ""),
                    "has_explanation": bool(q.get("explanation"))
                })
            
            if not ids:
                return 0
            
            # Get embeddings in batch
            embeddings = self._get_embeddings_batch(documents)
            
            # Upsert to ChromaDB
            self.questions_collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas
            )
            
            logger.info(f"Embedded {len(ids)} questions in batch")
            return len(ids)
            
        except Exception as e:
            logger.error(f"Failed to embed questions batch: {e}")
            return 0

    # ==========================================
    # Retrieval Functions
    # ==========================================

    def find_similar_questions(
        self,
        query_text: str,
        n_results: int = 5,
        topic_filter: Optional[str] = None,
        company_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Find questions similar to the query text"""
        try:
            query_embedding = self._get_embedding(query_text)
            
            # Build where filter
            where_filter = None
            if topic_filter or company_filter:
                conditions = []
                if topic_filter:
                    conditions.append({"topic": topic_filter})
                if company_filter:
                    conditions.append({"company": company_filter})
                
                if len(conditions) == 1:
                    where_filter = conditions[0]
                else:
                    where_filter = {"$and": conditions}
            
            results = self.questions_collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
            
            # Format results
            similar_questions = []
            for i, doc_id in enumerate(results["ids"][0]):
                similar_questions.append({
                    "id": doc_id,
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i],
                    "similarity": 1 - results["distances"][0][i]  # Convert distance to similarity
                })
            
            return similar_questions
            
        except Exception as e:
            logger.error(f"Error finding similar questions: {e}")
            return []

    def get_questions_with_explanations(
        self,
        topic: str,
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """Get questions that have explanations for a given topic"""
        try:
            results = self.questions_collection.query(
                query_texts=[f"Topic: {topic}"],
                n_results=n_results,
                where={"$and": [
                    {"topic": topic},
                    {"has_explanation": True}
                ]},
                include=["documents", "metadatas"]
            )
            
            return [{
                "id": results["ids"][0][i],
                "document": results["documents"][0][i],
                "metadata": results["metadatas"][0][i]
            } for i in range(len(results["ids"][0]))]
            
        except Exception as e:
            logger.error(f"Error getting questions with explanations: {e}")
            return []

    # ==========================================
    # Resume Embedding Functions
    # ==========================================

    def embed_resume(
        self,
        student_id: str,
        resume_text: str,
        skills: List[str] = None
    ) -> bool:
        """Embed a student's resume for skill matching"""
        try:
            full_text = f"Resume: {resume_text}"
            if skills:
                full_text += f"\nSkills: {', '.join(skills)}"
            
            embedding = self._get_embedding(full_text)
            
            self.resumes_collection.upsert(
                ids=[student_id],
                embeddings=[embedding],
                documents=[full_text],
                metadatas=[{
                    "student_id": student_id,
                    "skills": ",".join(skills) if skills else ""
                }]
            )
            
            logger.info(f"Embedded resume for student: {student_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to embed resume: {e}")
            return False

    def match_resume_to_topics(
        self,
        resume_text: str,
        available_topics: List[str],
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """Match resume content to relevant question topics"""
        try:
            # Create topic descriptions for matching
            topic_query = f"Find relevant topics for: {resume_text[:1000]}"
            
            results = self.questions_collection.query(
                query_texts=[topic_query],
                n_results=n_results * 2,  # Get more to deduplicate
                include=["metadatas", "distances"]
            )
            
            # Deduplicate by topic and rank by relevance
            topic_scores = {}
            for i, metadata in enumerate(results["metadatas"][0]):
                topic = metadata.get("topic", "General")
                distance = results["distances"][0][i]
                
                if topic not in topic_scores or distance < topic_scores[topic]:
                    topic_scores[topic] = distance
            
            # Sort by relevance (lower distance = more relevant)
            sorted_topics = sorted(topic_scores.items(), key=lambda x: x[1])
            
            return [{
                "topic": topic,
                "relevance_score": 1 - distance,
                "distance": distance
            } for topic, distance in sorted_topics[:n_results]]
            
        except Exception as e:
            logger.error(f"Error matching resume to topics: {e}")
            return []

    # ==========================================
    # Explanation Generation
    # ==========================================

    def generate_explanation(
        self,
        question_text: str,
        correct_answer: str,
        user_answer: str,
        topic: str
    ) -> str:
        """Generate contextual explanation for a wrong answer using RAG"""
        try:
            # Find similar questions with explanations
            similar = self.find_similar_questions(
                question_text,
                n_results=3,
                topic_filter=topic
            )
            
            # Build context from similar questions
            context = ""
            for q in similar:
                if q["metadata"].get("has_explanation"):
                    context += f"\n---\n{q['document']}\n"
            
            # Generate explanation using LLM
            prompt = f"""You are an expert tutor. A student got this question wrong. 
Help them understand why their answer was incorrect and explain the correct answer.

Question: {question_text}
Correct Answer: {correct_answer}
Student's Answer: {user_answer}

{f"Here are similar questions and explanations for context:{context}" if context else ""}

Provide a clear, concise explanation (2-3 sentences) that helps the student understand:
1. Why their answer was wrong
2. Why the correct answer is right
3. A tip for similar questions in the future
"""
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=300
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating explanation: {e}")
            return "Unable to generate explanation at this time."

    # ==========================================
    # Stats and Management
    # ==========================================

    def get_stats(self) -> Dict[str, Any]:
        """Get RAG service statistics"""
        return {
            "questions_count": self.questions_collection.count(),
            "resumes_count": self.resumes_collection.count()
        }

    def clear_all(self) -> bool:
        """Clear all embeddings (use with caution)"""
        try:
            self.chroma_client.delete_collection("questions")
            self.chroma_client.delete_collection("resumes")
            
            # Recreate empty collections
            self.questions_collection = self.chroma_client.create_collection("questions")
            self.resumes_collection = self.chroma_client.create_collection("resumes")
            
            logger.info("Cleared all RAG embeddings")
            return True
        except Exception as e:
            logger.error(f"Error clearing embeddings: {e}")
            return False


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get or create RAG service singleton"""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
