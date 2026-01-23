import re
import json
import base64
import io
import logging
from typing import List, Dict, Any
from PIL import Image
import fitz  # PyMuPDF - converts PDF to images without Poppler
from openai import OpenAI
from config import get_settingsgpt

logger = logging.getLogger(__name__)

class OCRProcessor:
    def __init__(self):
        """Initialize OCR processor with GPT-4o-mini Vision API"""
        try:
            settings = get_settingsgpt()
            if not settings.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required. Please set it in your .env file.")
            self.client = OpenAI(api_key=settings.openai_api_key)
            self.debug_mode = False
            logger.info("OCR Processor initialized with GPT-4o-mini Vision")
        except Exception as e:
            logger.error(f"Failed to initialize OCR processor: {str(e)}")
            raise

    # -------------------------------------------------------------------
    #  FILE TO BASE64
    # -------------------------------------------------------------------
    def _file_to_base64(self, file_bytes: bytes, mime_type: str) -> str:
        """Convert file bytes to base64 string"""
        file_base64 = base64.b64encode(file_bytes).decode()
        return file_base64

    # -------------------------------------------------------------------
    #  IMAGE TO BASE64
    # -------------------------------------------------------------------
    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to base64 string"""
        buffered = io.BytesIO()
        # Convert to RGB if necessary (for PNG with transparency)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        image.save(buffered, format="JPEG", quality=85)
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return img_str

    # -------------------------------------------------------------------
    #  PDF TO IMAGES USING PYMUPDF (NO POPPLER REQUIRED)
    # -------------------------------------------------------------------
    def _pdf_to_images_pymupdf(self, file_bytes: bytes) -> List[Image.Image]:
        """Convert PDF bytes to PIL Images using PyMuPDF (no Poppler required)"""
        images = []
        try:
            # Open PDF from bytes
            pdf_document = fitz.open(stream=file_bytes, filetype="pdf")
            
            # Convert each page to an image
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                # Render page to a pixmap (image) at 200 DPI
                mat = fitz.Matrix(200/72, 200/72)  # 200 DPI
                pix = page.get_pixmap(matrix=mat)
                
                # Convert pixmap to PIL Image
                img_data = pix.tobytes("ppm")
                img = Image.open(io.BytesIO(img_data))
                images.append(img)
            
            pdf_document.close()
            return images
        except Exception as e:
            logger.error(f"Error converting PDF to images with PyMuPDF: {str(e)}")
            raise

    # -------------------------------------------------------------------
    #  GPT-4O-MINI VISION EXTRACTION FROM IMAGES
    # -------------------------------------------------------------------
    def _extract_questions_from_pdf_pages(self, file_bytes: bytes) -> List[Dict[str, Any]]:
        """Extract MCQ questions from PDF by converting to images first"""
        
        # Convert PDF pages to images using PyMuPDF
        try:
            images = self._pdf_to_images_pymupdf(file_bytes)
            logger.info(f"Converted PDF to {len(images)} page(s) using PyMuPDF")
        except Exception as e:
            logger.error(f"Failed to convert PDF to images: {str(e)}")
            return []
        
        if not images:
            logger.warning("No images extracted from PDF")
            return []
        
        # Process images in chunks (2 pages per chunk)
        all_questions = []
        chunks = []
        pages_per_chunk = 2
        for i in range(0, len(images), pages_per_chunk):
            chunks.append(images[i:i + pages_per_chunk])
        
        logger.info(f"Split into {len(chunks)} chunk(s) for processing")
        
        # Process each chunk
        for idx, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {idx + 1}/{len(chunks)} ({len(chunk)} page(s))")
            chunk_questions = self._extract_questions_from_images(chunk, chunk_index=idx)
            all_questions.extend(chunk_questions)
        
        return all_questions

    def _extract_questions_from_images(self, images: List[Image.Image], chunk_index: int = 0) -> List[Dict[str, Any]]:
        """Extract MCQ questions from images using GPT-4o-mini Vision"""
        
        # Convert images to base64
        image_contents = []
        for img in images:
            img_base64 = self._image_to_base64(img)
            image_contents.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{img_base64}"
                }
            })

    def _extract_questions_from_images(self, images: List[Image.Image], chunk_index: int = 0) -> List[Dict[str, Any]]:
        """Extract MCQ questions from images using GPT-4o-mini Vision"""
        
        # Convert images to base64
        image_contents = []
        for img in images:
            img_base64 = self._image_to_base64(img)
            image_contents.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{img_base64}"
                }
            })

        # System prompt for MCQ extraction
        system_prompt = """You are an expert at extracting Multiple Choice Questions (MCQ) from exam papers and question documents.

Your task is to analyze the provided images and extract ALL MCQ questions with their options, correct answers, AND explanations/solutions.

IMPORTANT RULES:
1. Extract EVERY question you find, even if some information seems incomplete
2. Questions may be numbered (1., 2., Q1, Q.1, etc.) or unnumbered
3. Options are typically labeled A), B), C), D) or A., B., C., D. or similar
4. Answers may be indicated as "Answer: A", "Ans: B", "Correct Answer: C", or just "A", "B", "C", "D"
5. A question may span multiple lines
6. Options may be on separate lines or same line
7. Extract the section/topic if mentioned (e.g., "Mathematics", "Physics", etc.)
8. Extract explanations/solutions if provided in the document. Look for:
   - Text after "Explanation:", "Solution:", "Ans:", "Explanation with answer", etc.
   - Details about WHY the answer is correct
   - Step-by-step solution process
   - Any elaboration on the correct answer
9. IDENTIFY ANSWERS BY COLOR MARKING:
   - Look for answers marked in different colors (e.g., red, green, blue) while other text is black
   - Text that stands out in a contrasting color often indicates the correct answer
   - If an answer choice letter (A, B, C, D) is highlighted or colored differently than surrounding text, it's likely the correct answer
   - Pay attention to color intensity and contrast differences in the document

OUTPUT FORMAT (JSON only, no other text):
{
  "questions": [
    {
      "text": "Full question text here",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "answer": "A" or "B" or "C" or "D",
      "section": "Section name if available, else 'General'",
      "explanation": "Explanation or solution text if available, else null"
    }
  ]
}

CRITICAL: 
- Return ONLY valid JSON
- Ensure all questions have at least 2 options
- Answer must be A, B, C, or D (uppercase)
- If answer is not found, set answer to null
- If explanation is not found, set explanation to null
- If section is not found, set section to "General"
- Extract ALL questions, don't skip any
- Make explanations concise but comprehensive (2-3 sentences minimum if available)"""

        user_prompt = f"""Analyze these {len(images)} page(s) of the exam paper and extract all MCQ questions.

Return the questions in the exact JSON format specified. Extract every question you can find."""

        try:
            # Prepare messages
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt}
                    ] + image_contents
                }
            ]

            # Call GPT-4o-mini Vision API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.1,  # Low temperature for accuracy
                max_tokens=4000,
                response_format={"type": "json_object"}  # Force JSON output
            )

            content = response.choices[0].message.content.strip()
            
            # Parse JSON response
            try:
                result = json.loads(content)
                questions = result.get("questions", [])
                logger.info(f"Chunk {chunk_index + 1}: Extracted {len(questions)} questions")
                return questions
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from GPT response: {str(e)}")
                logger.error(f"Response content: {content[:500]}")
                # Try to extract JSON from markdown code blocks
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                try:
                    result = json.loads(content)
                    return result.get("questions", [])
                except:
                    return []

        except Exception as e:
            logger.error(f"Error calling GPT-4o-mini Vision API: {str(e)}")
            return []

    # -------------------------------------------------------------------
    #  PROCESS PDF WITH VISION API (USING PYMUPDF - NO POPPLER NEEDED)
    # -------------------------------------------------------------------
    def extract_questions_from_pdf(self, file_bytes: bytes) -> List[Dict[str, Any]]:
        """Extract questions from PDF using GPT-4o-mini Vision via PyMuPDF (no Poppler required)"""
        try:
            logger.info(f"Processing PDF with GPT-4o-mini Vision using PyMuPDF (size: {len(file_bytes)} bytes)")
            
            # Convert PDF to images and extract questions
            questions = self._extract_questions_from_pdf_pages(file_bytes)
            print(questions)
            
            logger.info(f"Total questions extracted: {len(questions)}")
            return questions
            
        except Exception as e:
            logger.error(f"Error processing PDF: {str(e)}")
            return []

    # -------------------------------------------------------------------
    #  PROCESS IMAGE WITH VISION API
    # -------------------------------------------------------------------
    def extract_questions_from_image(self, file_bytes: bytes) -> List[Dict[str, Any]]:
        """Extract questions from image using GPT-4o-mini Vision"""
        try:
            img = Image.open(io.BytesIO(file_bytes))
            questions = self._extract_questions_from_images([img], chunk_index=0)
            return questions
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            return []

    # -------------------------------------------------------------------
    #  CLEAN AND VALIDATE QUESTIONS
    # -------------------------------------------------------------------
    def _clean_text(self, txt: str) -> str:
        """Clean text by removing special characters and extra whitespace"""
        if not txt:
            return ""
        txt = txt.replace("■", "").replace("□", "").replace("●", "")
        txt = re.sub(r"\s+", " ", txt).strip()
        return txt

    def _validate_question(self, q: Dict[str, Any]) -> bool:
        """Validate that question has required fields"""
        if not q.get("text") or not isinstance(q.get("text"), str):
            return False
        if not q.get("options") or not isinstance(q.get("options"), list):
            return False
        if len(q.get("options", [])) < 2:
            return False
        return True

    def _normalize_question(self, q: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize question format"""
        # Clean question text
        q["text"] = self._clean_text(q.get("text", ""))
        
        # Clean and validate options
        options = q.get("options", [])
        cleaned_options = []
        for opt in options:
            if isinstance(opt, str):
                cleaned = self._clean_text(opt)
                if cleaned:
                    cleaned_options.append(cleaned)
        q["options"] = cleaned_options
        
        # Normalize answer (A, B, C, D)
        answer = q.get("answer")
        if answer:
            answer = str(answer).strip().upper()
            if answer in ["A", "B", "C", "D"]:
                q["answer"] = answer
            else:
                # Try to extract letter from answer string
                match = re.search(r"([A-D])", answer)
                if match:
                    q["answer"] = match.group(1)
                else:
                    q["answer"] = None
        else:
            q["answer"] = None
        
        # Normalize section
        section = q.get("section", "General")
        if not section or not isinstance(section, str):
            section = "General"
        q["section"] = self._clean_text(section) or "General"
        
        # Normalize explanation (clean text if present)
        explanation = q.get("explanation")
        if explanation and isinstance(explanation, str):
            q["explanation"] = self._clean_text(explanation) or None
        else:
            q["explanation"] = None
        
        return q

    # -------------------------------------------------------------------
    #  MAIN PROCESSOR
    # -------------------------------------------------------------------
    def process_document(self, file_bytes: bytes, file_type: str) -> Dict[str, Any]:
        """Main method to process document and extract questions"""
        try:
            file_type_lower = file_type.lower()

            print(file_type_lower)
            # Extract questions based on file type
            if file_type_lower == "pdf":
                questions = self.extract_questions_from_pdf(file_bytes)
            elif file_type_lower in ["jpg", "jpeg", "png"]:
                questions = self.extract_questions_from_image(file_bytes)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            # Normalize and validate questions
            normalized_questions = []
            for q in questions:
                normalized = self._normalize_question(q)
                if self._validate_question(normalized):
                    normalized_questions.append(normalized)
            
            # Format output to match expected structure
            result = {
                "success": len(normalized_questions) > 0,
                "questions": normalized_questions,
                "total_extracted": len(questions),
                "total_valid": len(normalized_questions),
                "error": None if normalized_questions else "No valid questions found"
            }
            
            logger.info(f"Processing complete: {result['total_valid']} valid questions out of {result['total_extracted']} extracted")
            return result

        except Exception as e:
            logger.exception(f"Error in process_document: {str(e)}")
            return {
                "success": False,
                "questions": [],
                "error": str(e),
                "total_extracted": 0,
                "total_valid": 0
            }
