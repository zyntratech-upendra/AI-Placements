# OCR Migration: Tesseract → GPT-4o-mini Vision

## Overview
The OCR functionality has been migrated from Tesseract (local executable) to GPT-4o-mini Vision API for better accuracy and cloud deployment compatibility.

## Changes Made

### 1. `services/ocr_processor.py`
- **Removed**: Tesseract OCR implementation (`pytesseract`)
- **Added**: GPT-4o-mini Vision API integration
- **Features**:
  - PDF to image conversion using `pdf2image`
  - Automatic page chunking (2 pages per chunk) for large PDFs
  - Vision API calls with structured prompts for MCQ extraction
  - JSON response parsing with fallback handling
  - Question normalization and validation

### 2. `routes/ocr.py`
- Updated error messages to reflect GPT-4o-mini usage
- Updated health check endpoint
- No breaking changes to API interface

### 3. `requirements.txt`
- Added `pdf2image==1.16.3` (for PDF to image conversion)
- Added `Pillow==10.2.0` (for image processing)

## System Dependencies

**Important**: `pdf2image` requires `poppler` to be installed on the system:

### Ubuntu/Debian:
```bash
sudo apt-get install poppler-utils
```

### macOS:
```bash
brew install poppler
```

### Windows:
Download poppler binaries from: https://github.com/oschwartz10612/poppler-windows/releases
Add to PATH or set environment variable.

## Environment Variables

Ensure `OPENAI_API_KEY` is set in your `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

## API Compatibility

The API endpoint `/api/parse-document` maintains the same interface:

**Request**: 
- `POST /api/parse-document`
- `file`: PDF, JPG, JPEG, or PNG file

**Response**:
```json
{
  "success": true,
  "questions": [
    {
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "A",
      "section": "General"
    }
  ],
  "total_extracted": 10,
  "total_valid": 10,
  "error": null
}
```

## Benefits

1. **Cloud Deployable**: No local executable dependencies
2. **Better Accuracy**: GPT-4o-mini Vision understands context better than OCR
3. **Handles Complex Layouts**: Better at extracting structured data from various PDF formats
4. **Automatic Chunking**: Large PDFs are automatically split for processing

## Processing Flow

1. PDF uploaded → Converted to images (200 DPI)
2. Images split into chunks (2 pages per chunk)
3. Each chunk sent to GPT-4o-mini Vision with extraction prompt
4. JSON responses parsed and combined
5. Questions normalized and validated
6. Results returned in expected format

## Error Handling

- Graceful fallback if API calls fail
- JSON parsing with markdown code block extraction
- Validation ensures only complete questions are returned
- Detailed logging for debugging

## Notes

- Processing time may be longer for large PDFs due to API calls
- API rate limits apply (check OpenAI usage limits)
- Cost: Uses GPT-4o-mini Vision API tokens (check pricing)

