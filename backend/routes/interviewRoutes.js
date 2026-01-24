const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and admin authorization
router.use(protect);
router.use(authorize('admin'));

// Company routes
router.get('/companies', interviewController.getAllCompanies);
router.get('/companies/:id', interviewController.getCompanyById);
router.post('/companies', interviewController.createCompany);
router.put('/companies/:id', interviewController.updateCompany);
router.delete('/companies/:id', interviewController.deleteCompany);

// Question routes
router.get('/companies/:companyId/questions', interviewController.getCompanyQuestions);
router.get('/questions/:id', interviewController.getQuestionById);
router.post('/companies/:companyId/questions', interviewController.createQuestion);
router.put('/questions/:id', interviewController.updateQuestion);
router.delete('/questions/:id', interviewController.deleteQuestion);

// Bulk operations
router.post('/companies/:companyId/questions/bulk', interviewController.bulkAddQuestions);

// Statistics
router.get('/companies/:companyId/stats', interviewController.getCompanyStats);

module.exports = router;
