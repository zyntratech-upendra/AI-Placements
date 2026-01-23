const mongoose = require('mongoose');

/**
 * StudentLearningPath Schema
 * Tracks the complete learning journey for each student per company
 * Records improvement over time and qualification progress
 */
const learningProgressSchema = new mongoose.Schema({
  cycleNumber: {
    type: Number,
    required: true
  },
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt'
  },
  score: Number,
  percentage: Number,
  improvement: Number, // Improvement from baseline
  assessmentsCompleted: Number,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const studentLearningPathSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: String,
    required: true
  },
  // Current cycle in learning journey
  currentCycle: {
    type: Number,
    default: 1
  },
  // Baseline performance from first attempt
  baseline: {
    attemptId: mongoose.Schema.Types.ObjectId,
    score: Number,
    percentage: Number,
    date: Date
  },
  // Current best performance
  currentBest: {
    attemptId: mongoose.Schema.Types.ObjectId,
    score: Number,
    percentage: Number,
    date: Date
  },
  // Qualification status
  qualificationAchieved: {
    type: Boolean,
    default: false
  },
  qualificationDate: Date,
  qualificationAttemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt'
  },
  // Total improvement from baseline
  totalImprovement: {
    type: Number,
    default: 0
  },
  // History of learning progress
  learningProgressHistory: [learningProgressSchema],
  // Active targeted assessments
  activeAssessments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment'
  }],
  // Completed targeted assessments
  completedAssessments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment'
  }],
  // Current weak areas being worked on
  currentWeakAreas: [{
    section: String,
    topics: [String],
    lastScore: Number
  }],
  // Can retake main exam?
  retakeEligible: {
    type: Boolean,
    default: false
  },
  // Status of learning path
  status: {
    type: String,
    enum: ['active', 'qualified', 'paused', 'needs-guidance'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Compound index for efficient lookups
studentLearningPathSchema.index({ student: 1, company: 1 }, { unique: true });
studentLearningPathSchema.index({ status: 1 });
studentLearningPathSchema.index({ qualificationAchieved: 1 });

module.exports = mongoose.model('StudentLearningPath', studentLearningPathSchema);
