const mongoose = require('mongoose');

const interviewQuestionSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewCompany',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Technical', 'HR', 'Behavioral', 'Communication', 'Problem Solving', 'Other'],
    default: 'Technical',
    index: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  expectedAnswer: {
    type: String,
    default: ''
  },
  tips: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries by company and category
interviewQuestionSchema.index({ company: 1, category: 1 });
interviewQuestionSchema.index({ company: 1, difficulty: 1 });

// Update the updatedAt timestamp before saving
interviewQuestionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Update the updatedAt timestamp before updating
interviewQuestionSchema.pre('findByIdAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('InterviewQuestion', interviewQuestionSchema);
