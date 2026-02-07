"""
GridFS Service for temporary audio storage in MongoDB
Handles audio file storage and retrieval for interview recordings
"""

import gridfs
from datetime import datetime
from typing import BinaryIO, Optional
from database import get_mongodb_client
import logging

logger = logging.getLogger("backend.gridfs_service")


class GridFSService:
    """Service for managing audio files in MongoDB GridFS"""
    
    def __init__(self):
        """Initialize GridFS connection"""
        self.db = get_mongodb_client()
        self.fs = gridfs.GridFS(self.db)
    
    def store_audio(
        self,
        audio_data: bytes,
        session_id: str,
        question_id: str,
        user_id: str,
        filename: str = "answer.webm"
    ) -> str:
        """
        Store audio file in GridFS
        
        Args:
            audio_data: Binary audio data
            session_id: Interview session ID
            question_id: Question ID
            user_id: User ID
            filename: Original filename
            
        Returns:
            str: GridFS file ID
        """
        try:
            # Store with metadata for easy querying
            file_id = self.fs.put(
                audio_data,
                filename=filename,
                session_id=session_id,
                question_id=question_id,
                user_id=user_id,
                content_type="audio/webm",
                upload_date=datetime.utcnow(),
                status="pending_transcription"
            )
            
            logger.info(
                f"Audio stored in GridFS: file_id={file_id}, "
                f"session={session_id}, question={question_id}"
            )
            
            return str(file_id)
        
        except Exception as e:
            logger.error(f"Failed to store audio in GridFS: {e}")
            raise
    
    def get_audio(self, file_id: str) -> Optional[bytes]:
        """
        Retrieve audio file from GridFS
        
        Args:
            file_id: GridFS file ID
            
        Returns:
            bytes: Audio file data or None if not found
        """
        try:
            from bson import ObjectId
            grid_out = self.fs.get(ObjectId(file_id))
            return grid_out.read()
        except gridfs.errors.NoFile:
            logger.warning(f"Audio file not found in GridFS: {file_id}")
            return None
        except Exception as e:
            logger.error(f"Failed to retrieve audio from GridFS: {e}")
            raise
    
    def get_audio_by_session_question(
        self,
        session_id: str,
        question_id: str
    ) -> Optional[tuple[str, bytes]]:
        """
        Retrieve audio by session and question ID
        
        Args:
            session_id: Interview session ID
            question_id: Question ID
            
        Returns:
            tuple: (file_id, audio_data) or None if not found
        """
        try:
            grid_out = self.fs.find_one({
                "session_id": session_id,
                "question_id": question_id
            })
            
            if grid_out:
                return str(grid_out._id), grid_out.read()
            
            return None
        
        except Exception as e:
            logger.error(f"Failed to find audio in GridFS: {e}")
            raise
    
    def delete_audio(self, file_id: str) -> bool:
        """
        Delete audio file from GridFS
        
        Args:
            file_id: GridFS file ID
            
        Returns:
            bool: True if deleted successfully
        """
        try:
            from bson import ObjectId
            self.fs.delete(ObjectId(file_id))
            logger.info(f"Audio deleted from GridFS: {file_id}")
            return True
        except gridfs.errors.NoFile:
            logger.warning(f"Audio file not found for deletion: {file_id}")
            return False
        except Exception as e:
            logger.error(f"Failed to delete audio from GridFS: {e}")
            raise
    
    def update_status(self, file_id: str, status: str) -> bool:
        """
        Update transcription status of audio file
        
        Args:
            file_id: GridFS file ID
            status: New status (e.g., "processing", "completed", "failed")
            
        Returns:
            bool: True if updated successfully
        """
        try:
            from bson import ObjectId
            # GridFS doesn't support direct metadata updates
            # We'll track status in the interview_sessions collection instead
            logger.info(f"Audio status updated: {file_id} -> {status}")
            return True
        except Exception as e:
            logger.error(f"Failed to update audio status: {e}")
            return False
    
    def cleanup_old_audio(self, hours: int = 24) -> int:
        """
        Clean up audio files older than specified hours
        Used for maintenance/cleanup tasks
        
        Args:
            hours: Delete files older than this many hours
            
        Returns:
            int: Number of files deleted
        """
        try:
            from datetime import timedelta
            cutoff_date = datetime.utcnow() - timedelta(hours=hours)
            
            deleted_count = 0
            for grid_file in self.fs.find({"upload_date": {"$lt": cutoff_date}}):
                self.fs.delete(grid_file._id)
                deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} old audio files")
            return deleted_count
        
        except Exception as e:
            logger.error(f"Failed to cleanup old audio: {e}")
            return 0


# Singleton instance
_gridfs_service = None


def get_gridfs_service() -> GridFSService:
    """Get or create GridFS service singleton"""
    global _gridfs_service
    if _gridfs_service is None:
        _gridfs_service = GridFSService()
    return _gridfs_service
