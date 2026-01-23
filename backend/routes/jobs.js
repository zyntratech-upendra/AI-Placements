const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyForJob,
  checkApplicationStatus,
  getJobApplicants,
  updateApplicationStatus,
  getStudentApplications
} = require('../controllers/jobController');

// Public routes
router.get('/', getAllJobs);
router.get('/:id', getJobById);

// Protected routes
router.post('/', protect, authorize('admin'), createJob);
router.put('/:id', protect, authorize('admin'), updateJob);
router.delete('/:id', protect, authorize('admin'), deleteJob);

// Job applications
router.post('/:id/apply', protect, authorize('student'), applyForJob);
router.get('/:id/check-application', protect, checkApplicationStatus);
router.get('/:id/applicants', protect, getJobApplicants);

// Student applications
router.get('/student/applications/all', protect, authorize('student'), getStudentApplications);

// Admin application management
router.put('/applications/:applicationId/status', protect, authorize('admin'), updateApplicationStatus);

module.exports = router;
