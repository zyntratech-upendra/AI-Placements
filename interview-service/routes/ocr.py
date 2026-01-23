from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import os
import logging
from config import get_ocr_config
from services.ocr_processor import OCRProcessor
from database import get_db
import uuid
from datetime import datetime
from bson import ObjectId

router = APIRouter()
logger = logging.getLogger(__name__)

try:
    ocr_processor = OCRProcessor()
    logger.info("OCR Processor initialized successfully with GPT-4o-mini Vision")
except Exception as e:
    logger.error(f"Failed to initialize OCR processor: {str(e)}")
    ocr_processor = None

# Get OCR configuration
ocr_config = get_ocr_config()
ALLOWED_EXTENSIONS = ocr_config["ALLOWED_EXTENSIONS"]
MAX_FILE_SIZE = ocr_config["MAX_FILE_SIZE"]

def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_folder_path(db, folder_id: str) -> dict:
    """
    Get complete folder path and context by traversing parent folders.
    Returns: {
        'path': 'Company > Topic > Subfolder > Difficulty',
        'company': 'Company Name',
        'topic': 'Topic Name',
        'subfolder': 'Subfolder Name',
        'difficulty': 'Difficulty Level',
        'folderHierarchy': [folder_id, parent_id, grandparent_id, great_grandparent_id]
    }
    """
    try:
        # Convert string to ObjectId if needed
        if isinstance(folder_id, str):
            folder_id = ObjectId(folder_id)
        
        path_parts = []
        hierarchy = []
        current_id = folder_id
        company_name = None
        
        # Traverse up the folder hierarchy
        for level in range(4):  # Max 4 levels deep
            if not current_id:
                break
            
            folder = db.folders.find_one({"_id": current_id})
            if not folder:
                break
            
            path_parts.append(folder.get('name', 'Unknown'))
            hierarchy.append(str(folder['_id']))
            company_name = folder.get('companyName', company_name)
            current_id = folder.get('parentFolderId')
        
        # Reverse to get correct order (Company > Topic > Subfolder > Difficulty)
        path_parts.reverse()
        hierarchy.reverse()
        
        path_str = ' > '.join(path_parts) if path_parts else 'Unknown'
        
        # Extract components
        company = path_parts[0] if len(path_parts) > 0 else None
        topic = path_parts[1] if len(path_parts) > 1 else None
        subfolder = path_parts[2] if len(path_parts) > 2 else None
        difficulty = path_parts[3] if len(path_parts) > 3 else None
        
        return {
            'path': path_str,
            'company': company,
            'topic': topic,
            'subfolder': subfolder,
            'difficulty': difficulty,
            'companyName': company_name,
            'folderHierarchy': hierarchy
        }
    except Exception as e:
        logger.error(f"Error getting folder path: {str(e)}")
        return {
            'path': 'Unknown',
            'company': None,
            'topic': None,
            'subfolder': None,
            'difficulty': None,
            'companyName': None,
            'folderHierarchy': []
        }

@router.post("/parse-document")
async def parse_document(file: UploadFile = File(...), folderId: str = Form(None), fileId: str = Form(None)):
    """
    Parse document and extract MCQ questions using GPT-4o-mini Vision API.
    Accepts PDF, JPG, JPEG, PNG files.
    
    Parameters:
    - file: The document file to parse
    - folderId (optional): MongoDB folder ID where file was uploaded (for context)
    - fileId (optional): MongoDB file ID (to link parsed questions to file)
    
    For PDFs with multiple pages, the document is automatically split into chunks
    and processed page by page to ensure accurate extraction.
    """
    try:
        if not ocr_processor:
            return JSONResponse(
                status_code=503,
                content={
                    'success': False,
                    'error': 'OCR service not initialized. Check OPENAI_API_KEY in environment variables.',
                    'questions': []
                }
            )

        # Handle missing filename - try to infer from content-type or use default
        filename = file.filename or 'uploaded_file'
        if not file.filename:
            logger.warning("No filename provided, attempting to infer from content-type")
            content_type = file.content_type or ''
            if 'pdf' in content_type:
                filename = 'uploaded_file.pdf'
            elif 'jpeg' in content_type or 'jpg' in content_type:
                filename = 'uploaded_file.jpg'
            elif 'png' in content_type:
                filename = 'uploaded_file.png'

        # Read file content
        file_bytes = await file.read()
        file_size = len(file_bytes)

        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail='Empty file provided'
            )

        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f'File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024 * 1024):.0f}MB'
            )

        # Extract file extension
        if '.' in filename:
            file_ext = filename.rsplit('.', 1)[1].lower()
        else:
            # Try to infer from content type if no extension
            content_type = file.content_type or ''
            if 'pdf' in content_type:
                file_ext = 'pdf'
            elif 'jpeg' in content_type or 'jpg' in content_type:
                file_ext = 'jpg'
            elif 'png' in content_type:
                file_ext = 'png'
            else:
                raise HTTPException(
                    status_code=400,
                    detail='Could not determine file type. Please ensure file has an extension or correct content-type.'
                )

        # Validate file extension is allowed
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}. Received: {file_ext}'
            )

        logger.info(f"Processing file: {filename} ({file_size} bytes, type: {file_ext})")
        
        # Get folder path and context if folderId provided
        folder_context = None
        with get_db() as db:
            if folderId:
                folder_context = get_folder_path(db, folderId)
                logger.info(f"File location: {folder_context.get('path', 'Unknown')}")
        
        # Process document with GPT-4o-mini Vision
        try:
            result = ocr_processor.process_document(file_bytes, file_ext)
            logger.info(f"OCR result: {len(result.get('questions', []))} valid questions extracted")
            
            # Persist extracted questions to `parsedquestions` collection
            try:
                with get_db() as db:
                    # ✅ NEW: Store all questions for this folder as a SINGLE document grouped by difficulty
                    
                    # Group questions by difficulty if available
                    questions_by_difficulty = {
                        'Easy': [],
                        'Medium': [],
                        'Difficult': []
                    }
                    
                    # Organize questions by difficulty with unique IDs
                    for idx, question in enumerate(result.get("questions", [])):
                        # Add unique ID to each question
                        question['questionId'] = str(uuid.uuid4())
                        
                        # Use question's difficulty if present, otherwise use folder's difficulty level
                        raw_difficulty = question.get('difficulty')
                        
                        # If question doesn't have difficulty, use the folder's difficulty level
                        if not raw_difficulty and folder_context:
                            raw_difficulty = folder_context.get('difficulty')
                        
                        # Default to Medium if still no difficulty found
                        difficulty = raw_difficulty.capitalize() if isinstance(raw_difficulty, str) else 'Medium'
                        
                        logger.debug(f"Question {idx}: Raw difficulty='{raw_difficulty}', Processed difficulty='{difficulty}'")
                        
                        if difficulty not in questions_by_difficulty:
                            questions_by_difficulty[difficulty] = []
                        questions_by_difficulty[difficulty].append(question)
                    
                    logger.info(f"Questions grouped by difficulty: Easy={len(questions_by_difficulty.get('Easy', []))}, Medium={len(questions_by_difficulty.get('Medium', []))}, Difficult={len(questions_by_difficulty.get('Difficult', []))}")
                    
                    # Create a single document for this folder with all its questions grouped by difficulty
                    parsed_doc = {
                        "id": str(uuid.uuid4()),
                        "folderId": ObjectId(folderId) if folderId else None,
                        "fileId": ObjectId(fileId) if fileId else None,
                        "filename": filename,
                        "file_ext": file_ext,
                        
                        # ✅ Folder context with complete path
                        "folderContext": folder_context if folder_context else {},
                        "folderPath": folder_context.get('path') if folder_context else None,
                        "company": folder_context.get('company') if folder_context else None,
                        "topic": folder_context.get('topic') if folder_context else None,
                        "subfolder": folder_context.get('subfolder') if folder_context else None,
                        "difficulty": folder_context.get('difficulty') if folder_context else None,
                        
                        # ✅ Questions grouped by difficulty level WITH EXPLANATIONS
                        "questionsByDifficulty": {
                            "Easy": questions_by_difficulty.get('Easy', []),
                            "Medium": questions_by_difficulty.get('Medium', []),
                            "Difficult": questions_by_difficulty.get('Difficult', [])
                        },
                        
                        # ✅ Summary statistics
                        "totalExtracted": result.get("total_extracted", len(result.get("questions", []))),
                        "totalValid": result.get("total_valid", len(result.get("questions", []))),
                        "totalByDifficulty": {
                            "Easy": len(questions_by_difficulty.get('Easy', [])),
                            "Medium": len(questions_by_difficulty.get('Medium', [])),
                            "Difficult": len(questions_by_difficulty.get('Difficult', []))
                        },
                        
                        "created_at": datetime.utcnow()
                    }
                    
                    # Update or insert: If this folder already has parsed questions, update the document
                    if folderId:
                        db.parsedquestions.update_one(
                            {"folderId": ObjectId(folderId)},
                            {"$set": parsed_doc},
                            upsert=True  # Create if doesn't exist, update if does
                        )
                        logger.info(f"Saved {len(result.get('questions', []))} parsed questions (with explanations) for folder {folderId} (location={parsed_doc.get('folderPath', 'Unknown')})")
                    else:
                        db.parsedquestions.insert_one(parsed_doc)
                        logger.info(f"Saved {len(result.get('questions', []))} parsed questions (with explanations) to parsedquestions (id={parsed_doc['id']})")
            except Exception as db_err:
                logger.exception(f"Failed to save parsed questions to DB: {db_err}")

            # ✅ Include folder context in response
            response_data = result.copy()
            if folder_context:
                response_data['folderContext'] = folder_context
                response_data['folderPath'] = folder_context.get('path')
            
            status_code = 200 if result['success'] else 400
            return JSONResponse(status_code=status_code, content=response_data)
        except ValueError as ve:
            # Handle Poppler installation errors specifically
            error_msg = str(ve)
            if "poppler" in error_msg.lower():
                logger.error("Poppler installation error detected")
                return JSONResponse(
                    status_code=503,
                    content={
                        'success': False,
                        'error': 'Poppler is required for PDF processing. Please install Poppler and ensure it is in your system PATH. See POPPLER_INSTALLATION_WINDOWS.md for instructions.',
                        'questions': [],
                        'total_extracted': 0,
                        'total_valid': 0,
                        'installation_guide': 'https://github.com/oschwartz10612/poppler-windows/releases'
                    }
                )
            raise

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error processing document: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                'success': False,
                'error': f'Server error: {str(e)}',
                'questions': []
            }
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for OCR service"""
    status = 'healthy' if ocr_processor else 'unhealthy'
    return {
        'status': status,
        'service': 'GPT-4o-mini Vision OCR Parser Service',
        'initialized': ocr_processor is not None,
        'endpoint': '/api/parse-document'
    }
