const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  startAttempt,
  submitAnswer,
  submitAttempt,
  getAttemptById,
  getMyAttempts,
  getAllAttempts,
  getAttemptsByAssessment
} = require('../controllers/attemptController');

router.post('/start', protect, authorize('student'), startAttempt);
router.post('/answer', protect, authorize('student'), submitAnswer);
router.post('/submit', protect, authorize('student'), submitAttempt);
router.get('/my-attempts', protect, authorize('student'), getMyAttempts);
router.get('/all', protect, authorize('admin', 'mentor'), getAllAttempts);
router.get('/assessment/:assessmentId', protect, authorize('admin', 'mentor'), getAttemptsByAssessment);
router.get('/:id', protect, getAttemptById);

module.exports = router;
