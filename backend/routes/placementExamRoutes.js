const express = require('express');
const router = express.Router();
const {
  createPlacementExamFormat,
  getFormatsByCompany,
  previewQuestionCount,
  updatePlacementExamFormat,
  clonePlacementExamFormat,
  getPlacementCompanies
} = require('../controllers/placementExamController');
const { protect, authorize } = require('../middleware/auth');

// 🔹 Specific routes FIRST (before :id and :company params)
router.get('/companies', getPlacementCompanies);
router.get('/preview/count', protect, authorize('admin'), previewQuestionCount);

// 🔹 Generic routes LAST (with params)
router.post('/', protect, authorize('admin'), createPlacementExamFormat);
router.get('/:company', protect, getFormatsByCompany); // 🔹 Students need access to view formats
router.put('/:id', protect, authorize('admin'), updatePlacementExamFormat);
router.post('/:id/clone', protect, authorize('admin'), clonePlacementExamFormat);

module.exports = router;
