const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const User = require('../models/User');

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getAllJobs = async (req, res) => {
  try {
    const { jobType, status } = req.query;
    const filter = { status: 'active' };

    if (jobType) filter.jobType = jobType;
    if (status) filter.status = status;

    const jobs = await Job.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private/Admin
exports.createJob = async (req, res) => {
  try {
    const {
      title,
      companyName,
      description,
      location,
      salary,
      jobType,
      jobCategory,
      openings,
      eligibilityCriteria,
      requiredFields,
      deadline,
      skills,
      ctc,
      description_detailed
    } = req.body;

    // Validate required fields
    if (!title || !companyName || !description || !location || !jobType || !jobCategory || !openings || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const job = new Job({
      title,
      companyName,
      description,
      location,
      salary,
      jobType,
      jobCategory,
      openings,
      eligibilityCriteria: eligibilityCriteria || {},
      requiredFields: requiredFields || [],
      deadline,
      skills: skills || [],
      ctc,
      description_detailed: description_detailed || description,
      status: 'active',
      createdBy: req.user.id
    });

    await job.save();

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update a job
// @route   PUT /api/jobs/:id
// @access  Private/Admin
exports.updateJob = async (req, res) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user is admin or creator
    if (job.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this job'
      });
    }

    job = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete a job
// @route   DELETE /api/jobs/:id
// @access  Private/Admin
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if user is admin or creator
    if (job.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job'
      });
    }

    await Job.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Apply for a job
// @route   POST /api/jobs/:id/apply
// @access  Private/Student
exports.applyForJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { applicationData } = req.body;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check if deadline passed
    if (new Date() > new Date(job.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Application deadline has passed'
      });
    }

    // Check if already applied
    let application = await JobApplication.findOne({
      jobId,
      studentId: req.user.id
    });

    if (application) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this job'
      });
    }

    // Create application
    application = new JobApplication({
      jobId,
      studentId: req.user.id,
      applicationData: applicationData || {},
      status: 'applied'
    });

    await application.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Check if student applied for job
// @route   GET /api/jobs/:id/check-application
// @access  Private/Student
exports.checkApplicationStatus = async (req, res) => {
  try {
    const { id: jobId } = req.params;

    const application = await JobApplication.findOne({
      jobId,
      studentId: req.user.id
    });

    res.status(200).json({
      success: true,
      applied: !!application,
      data: application || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get job applicants
// @route   GET /api/jobs/:id/applicants
// @access  Private/Admin
exports.getJobApplicants = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { status } = req.query;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Check authorization
    if (job.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view applicants'
      });
    }

    const filter = { jobId };
    if (status) filter.status = status;

    const applications = await JobApplication.find(filter)
      .populate('studentId', 'name email rollNumber department batch')
      .sort({ appliedAt: -1 });

    const appliedCount = await JobApplication.countDocuments({ jobId });
    const allUsers = await User.find({ role: 'student' });
    const notAppliedCount = allUsers.length - appliedCount;

    res.status(200).json({
      success: true,
      data: applications,
      stats: {
        total: allUsers.length,
        applied: appliedCount,
        notApplied: notAppliedCount,
        byStatus: {
          applied: await JobApplication.countDocuments({ jobId, status: 'applied' }),
          shortlisted: await JobApplication.countDocuments({ jobId, status: 'shortlisted' }),
          rejected: await JobApplication.countDocuments({ jobId, status: 'rejected' }),
          selected: await JobApplication.countDocuments({ jobId, status: 'selected' })
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update application status
// @route   PUT /api/jobs/applications/:applicationId/status
// @access  Private/Admin
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    if (!['applied', 'shortlisted', 'rejected', 'selected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const application = await JobApplication.findById(applicationId)
      .populate('jobId');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Check authorization
    if (application.jobId.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application'
      });
    }

    application.status = status;
    application.lastUpdated = Date.now();
    await application.save();

    res.status(200).json({
      success: true,
      message: 'Application status updated',
      data: application
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get student's applications
// @route   GET /api/jobs/student/applications
// @access  Private/Student
exports.getStudentApplications = async (req, res) => {
  try {
    const applications = await JobApplication.find({ studentId: req.user.id })
      .populate('jobId')
      .sort({ appliedAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
