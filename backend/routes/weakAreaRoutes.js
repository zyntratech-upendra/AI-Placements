const express = require('express');
const router = express.Router();
const WeakAreaAnalysisService = require('../services/WeakAreaAnalysisService');
const WeakAreaAnalysis = require('../models/WeakAreaAnalysis');
const StudentLearningPath = require('../models/StudentLearningPath');
const weakAreaController = require('../controllers/weakAreaController'); // New controller
const { protect } = require('../middleware/auth');

/**
 * @route   POST /api/weak-areas/analyze/:attemptId
 * @desc    Analyze a placement exam attempt and identify weak areas
 * @access  Private
 */
router.post('/analyze/:attemptId', protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    
    const analysis = await WeakAreaAnalysisService.analyzeAttempt(attemptId);
    
    res.status(201).json({
      success: true,
      message: 'Weak area analysis completed',
      analysis
    });
  } catch (error) {
    console.error('Error analyzing attempt:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/weak-areas/:company
 * @desc    Get weak area analysis for current user and company
 * @access  Private
 */
router.get('/:company', protect, async (req, res) => {
  try {
    const { company } = req.params;
    const studentId = req.user._id;
    
    const analyses = await WeakAreaAnalysisService.getStudentWeakAreas(
      studentId, 
      company
    );
    
    res.json({
      success: true,
      analyses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/weak-areas/:company/latest
 * @desc    Get latest weak area analysis for current user and company
 * @access  Private
 */
router.get('/:company/latest', protect, async (req, res) => {
  try {
    const { company } = req.params;
    const studentId = req.user._id;
    
    const analysis = await WeakAreaAnalysisService.getLatestAnalysis(
      studentId, 
      company
    );
    
    if (!analysis) {
      return res.status(404).json({
        success: false,
        message: 'No analysis found for this company'
      });
    }
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/weak-areas/:company/learning-path
 * @desc    Get learning path for current user and company
 * @access  Private
 */
router.get('/:company/learning-path', protect, async (req, res) => {
  try {
    const { company } = req.params;
    const studentId = req.user._id;
    
    const learningPath = await WeakAreaAnalysisService.getLearningPath(
      studentId, 
      company
    );
    
    if (!learningPath) {
      return res.status(404).json({
        success: false,
        message: 'No learning path found for this company'
      });
    }
    
    res.json({
      success: true,
      learningPath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/weak-areas/progress/summary
 * @desc    Get overall progress summary across all companies
 * @access  Private
 */
router.get('/progress/summary', protect, async (req, res) => {
  try {
    const studentId = req.user._id;
    
    const learningPaths = await StudentLearningPath.find({
      student: studentId
    });
    
    const summary = learningPaths.map(path => ({
      company: path.company,
      status: path.status,
      qualificationAchieved: path.qualificationAchieved,
      currentCycle: path.currentCycle,
      totalImprovement: path.totalImprovement,
      baseline: path.baseline.percentage,
      currentBest: path.currentBest.percentage
    }));
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/weak-areas/analysis/progress
 * @desc    Get detailed learning progress for charts
 * @access  Private
 */
router.get('/analysis/progress', protect, weakAreaController.getLearningProgress);

module.exports = router;
