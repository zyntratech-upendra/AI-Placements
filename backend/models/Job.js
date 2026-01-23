const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  description_detailed: {
    type: String
  },
  location: {
    type: String,
    required: true
  },
  salary: {
    type: String
  },
  ctc: {
    type: String
  },
  jobType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Internship', 'Contract'],
    required: true
  },
  jobCategory: {
    type: String,
    enum: ['On-Campus', 'Off-Campus'],
    required: true
  },
  openings: {
    type: Number,
    required: true,
    min: 1
  },
  skills: [{
    type: String
  }],
  eligibilityCriteria: {
    departments: [{
      type: String
    }],
    batches: [{
      type: String
    }],
    minCGPA: {
      type: Number
    }
  },
  requiredFields: [{
    fieldName: String,
    fieldType: {
      type: String,
      enum: ['text', 'email', 'number', 'file', 'textarea']
    },
    required: Boolean
  }],
  deadline: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'draft'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', jobSchema);
