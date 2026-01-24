const mongoose = require('mongoose');

const interviewCompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  industry: {
    type: String,
    trim: true,
    default: ''
  },
  headquarters: {
    type: String,
    trim: true,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
interviewCompanySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Update the updatedAt timestamp before updating
interviewCompanySchema.pre('findByIdAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('InterviewCompany', interviewCompanySchema);
