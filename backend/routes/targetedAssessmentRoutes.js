const express = require('express');
const router = express.Router();
const AssessmentGenerationService = require('../services/AssessmentGenerationService');
const { protect } = require('../middleware/auth');

/**
 * Targeted Assessment Routes
 * API endpoints for adaptive learning targeted assessments
 */

/**
 * @route   POST /api/targeted-assessments/generate/:company
 * @desc    Generate a targeted assessment based on weak areas
 * @access  Private (Student)
 */
router.post('/generate/:company', protect, async (req, res) => {
  try {
    const { company } = req.params;
    const { topic } = req.body; // Optional topic
    const studentId = req.user._id;

    const assessment = await AssessmentGenerationService.generateTargetedAssessment(
      studentId,
      company,
      topic
    );

    res.json({
      success: true,
      message: 'Targeted assessment generated successfully',
      assessment: {
        _id: assessment._id,
        title: assessment.title,
        duration: assessment.duration,
        totalMarks: assessment.totalMarks,
        questionCount: assessment.sections.reduce((sum, s) => sum + s.questions.length, 0)
      }
    });

  } catch (error) {
    console.error('Error generating targeted assessment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate targeted assessment'
    });
  }
});

/**
 * @route   GET /api/targeted-assessments/recommendations
 * @desc    Get recommended assessments based on weak areas
 * @access  Private (Student)
 */
router.get('/recommendations', protect, async (req, res) => {
  try {
    const studentId = req.user._id;

    const recommendations = await AssessmentGenerationService.getRecommendedAssessments(studentId);

    res.json({
      success: true,
      recommendations
    });

  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations'
    });
  }
});

/**
 * @route   GET /api/targeted-assessments/active
 * @desc    Get active targeted assessments for the student
 * @access  Private (Student)
 */
router.get('/active', protect, async (req, res) => {
  try {
    const studentId = req.user._id;

    const assessments = await AssessmentGenerationService.getActiveAssessments(studentId);

    res.json({
      success: true,
      assessments: assessments.map(a => ({
        _id: a._id,
        title: a.title,
        companyName: a.companyName,
        duration: a.duration,
        totalMarks: a.totalMarks,
        questionCount: a.sections.reduce((sum, s) => sum + s.questions.length, 0),
        createdAt: a.createdAt
      }))
    });

  } catch (error) {
    console.error('Error getting active assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active assessments'
    });
  }
});

/**
 * @route   GET /api/targeted-assessments/grouped-by-exam
 * @desc    Get targeted assessments grouped by source placement exam
 * @access  Private (Student)
 */
router.get('/grouped-by-exam', protect, async (req, res) => {
  try {
    const studentId = req.user._id;

    const groupedAssessments = await AssessmentGenerationService.getTargetedAssessmentsGroupedByExam(studentId);

    res.json({
      success: true,
      data: groupedAssessments
    });

  } catch (error) {
    console.error('Error getting grouped assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get grouped assessments'
    });
  }
});

module.exports = router;
