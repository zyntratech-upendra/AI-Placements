const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  login,
  register,
  getMe,
  getAllUsers
} = require('../controllers/authController');

router.post('/login', login);
router.post('/register', protect, authorize('admin'), register);
router.get('/me', protect, getMe);
router.get('/users', protect, authorize('admin', 'mentor'), getAllUsers);

module.exports = router;
