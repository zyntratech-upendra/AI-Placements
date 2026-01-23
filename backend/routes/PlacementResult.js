const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
  getPlacementResult
} = require('../controllers/placementResultController');

// Get placement exam result
router.get(
  '/:attemptId',
  protect,
  authorize('student', 'admin'),
  getPlacementResult
);

module.exports = router;
