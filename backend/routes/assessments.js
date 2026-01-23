const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createAssessment,
  getAllAssessments,
  getAssessmentById,
  getQuestionsByFolder,
  updateAssessment,
  deleteAssessment,
  generateRandomAssessment
} = require('../controllers/assessmentController');

router.route('/')
  .get(protect, getAllAssessments)
  .post(protect, authorize('admin', 'mentor'), createAssessment);

router.post('/random', protect, generateRandomAssessment);
router.get('/questions/folder/:folderId', protect, getQuestionsByFolder);

router.route('/:id')
  .get(protect, getAssessmentById)
  .put(protect, authorize('admin', 'mentor'), updateAssessment)
  .delete(protect, authorize('admin', 'mentor'), deleteAssessment);

module.exports = router;
