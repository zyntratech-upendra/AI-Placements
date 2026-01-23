const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const resumeAssessmentController = require('../controllers/resumeAssessmentController');

/**
 * Resume Assessment Routes
 * Generate assessments based on resume and job description
 */

// Get user's previously generated resume assessments
router.get('/my-assessments', protect, resumeAssessmentController.getMyResumeAssessments);

// Generate assessment from extracted topics
router.post('/generate', protect, resumeAssessmentController.generateFromResume);

module.exports = router;
