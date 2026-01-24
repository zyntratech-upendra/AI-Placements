const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  listResumes, 
  getResume, 
  saveResume, 
  createResume, 
  deleteResume, 
  renameResume, 
  setActiveResume,
  uploadResume, 
  downloadResume, 
  upload 
} = require('../controllers/resumeController');

// Routes
router.get('/', protect, getResume);
router.get('/list', protect, listResumes);
router.get('/:id', protect, getResume);
router.post('/', protect, saveResume);
router.post('/create', protect, createResume);
router.post('/upload', protect, upload.single('resume'), uploadResume);
router.post('/download', protect, downloadResume);
router.delete('/:id', protect, deleteResume);
router.put('/:id/rename', protect, renameResume);
router.put('/:id/activate', protect, setActiveResume);

module.exports = router;
