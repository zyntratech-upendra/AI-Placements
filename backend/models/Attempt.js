const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  assessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.Mixed, // Accept both String and ObjectId
      required: true
    },
    selectedAnswer: String,
    isCorrect: Boolean,
    marksObtained: Number
  }],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  totalScore: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'submitted'],
    default: 'in_progress'
  },
  timeTaken: {
    type: Number
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Attempt', attemptSchema);
