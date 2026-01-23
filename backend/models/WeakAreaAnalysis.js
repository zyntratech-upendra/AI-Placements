const mongoose = require('mongoose');

/**
 * WeakAreaAnalysis Schema
 * Stores analysis of weak areas identified after placement exams
 * Used to generate targeted assessments for improvement
 */
const weakSectionSchema = new mongoose.Schema({
  sectionName: {
    type: String,
    required: true
  },
  topic: String,
  subtopic: String,
  difficulty: String,
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  // 'weak' < 50%, 'average' 50-70%, 'strong' > 70%
  status: {
    type: String,
    enum: ['weak', 'average', 'strong'],
    required: true
  },
  // Specific topics within this section that need work
  weakTopics: [String],
  
  // Per-section progress tracking
  lastPracticeScore: {
    type: Number,
    default: 0
  },
  improvementPercentage: {
    type: Number,
    default: 0
  }
}, { _id: false });

const weakAreaAnalysisSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: String,
    required: true
  },
  // Reference to the placement exam attempt that triggered this analysis
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attempt',
    required: true
  },
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  analysisDate: {
    type: Date,
    default: Date.now
  },
  // Overall exam performance
  overallScore: {
    type: Number,
    required: true
  },
  overallPercentage: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  // Qualification threshold (default 60%)
  qualificationThreshold: {
    type: Number,
    default: 60
  },
  // Simplified: 'active' = needs practice, 'qualified' = mastered
  qualificationStatus: {
    type: String,
    enum: ['active', 'qualified'],
    default: 'active'
  },
  // Section-wise breakdown
  sections: [weakSectionSchema],
  // Sections that need improvement (score < 60%)
  weakSections: [{
    type: String
  }],
  // All weak topics across all sections
  allWeakTopics: [{
    type: String
  }],
  // Whether targeted assessments have been generated
  assessmentsGenerated: {
    type: Boolean,
    default: false
  },
  // References to generated targeted assessments
  generatedAssessmentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment'
  }],
  // Cycle number in learning path (1 = first attempt)
  cycleNumber: {
    type: Number,
    default: 1
  },
  // ========== PROGRESS TRACKING FIELDS ==========
  // Number of practice attempts after initial exam
  practiceAttempts: {
    type: Number,
    default: 0
  },
  // Score from last practice attempt
  lastPracticeScore: {
    type: Number,
    default: 0
  },
  // Date of last practice
  lastPracticeDate: {
    type: Date
  },
  // Improvement percentage from initial exam
  improvementPercentage: {
    type: Number,
    default: 0
  },
  // Best score achieved in practice
  bestPracticeScore: {
    type: Number,
    default: 0
  },
  // Difficulty level progression (easy, medium, hard)
  currentDifficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy'
  },
  // ========== SCORE HISTORY ==========
  // Array of all practice scores for charting
  scoreHistory: [{
    score: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    difficulty: { type: String },
    attemptNumber: { type: Number }
  }],
  // ========== QUESTION TRACKING ==========
  // IDs of questions already used in targeted assessments (to avoid repetition)
  attemptedQuestionIds: [{
    type: String
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
weakAreaAnalysisSchema.index({ student: 1, company: 1 });
weakAreaAnalysisSchema.index({ student: 1, attemptId: 1 });
weakAreaAnalysisSchema.index({ qualificationStatus: 1 });

module.exports = mongoose.model('WeakAreaAnalysis', weakAreaAnalysisSchema);
