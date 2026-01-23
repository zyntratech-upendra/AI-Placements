const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, authorize } = require('../middleware/auth');
const {
  uploadFile,
  getAllFiles,
  getFilesByFolder,
  deleteFile,
  processOCR,
  getParsedQuestionsByFolder
} = require('../controllers/fileController');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Only images, PDFs, and documents are allowed!');
    }
  }
});

router.post('/upload', protect, authorize('admin'), upload.single('file'), uploadFile);
router.get('/', protect, getAllFiles);
router.get('/folder/:folderId', protect, getFilesByFolder);
router.get('/parsed-questions/:folderId', protect, getParsedQuestionsByFolder);
router.delete('/:id', protect, authorize('admin'), deleteFile);
router.post('/:id/ocr', protect, authorize('admin'), processOCR);

module.exports = router;
