const express = require('express');
const router = express.Router();
const {protect,authorize} = require('../middleware/auth');
const {
  startPlacementAssessment,
  getPlacementAssessment,
  submitPlacementAssessment
} = require('../controllers/placementAssessmentController');
const { getPlacementResult } = require('../controllers/placementResultController');




router.post('/start', protect,authorize('student','admin'), startPlacementAssessment);
router.get('/:assessmentId', protect,authorize('student','admin'), getPlacementAssessment);
router.post('/:assessmentId/submit', protect,authorize('student','admin'), submitPlacementAssessment);
router.get('/result/:attemptId',protect,authorize('student','admin'),getPlacementResult);

module.exports = router;
