const express = require('express');
const router = express.Router();
const { startPlacementExam } = require('../controllers/studentPlacementExamController');
const { protect } = require('../middleware/auth');

router.post('/start', protect, startPlacementExam);

module.exports = router;
