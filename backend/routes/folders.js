const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createFolder,
  getAllFolders,
  getFolderById,
  updateFolder,
  deleteFolder,
  getChildFolders
} = require('../controllers/folderController');

router.route('/')
  .get(protect, getAllFolders)
  .post(protect, authorize('admin'), createFolder);

router.route('/:id')
  .get(protect, getFolderById)
  .put(protect, authorize('admin'), updateFolder)
  .delete(protect, authorize('admin'), deleteFolder);

// Get child folders of a specific parent folder
router.route('/:parentId/children')
  .get(protect, getChildFolders);

module.exports = router;
