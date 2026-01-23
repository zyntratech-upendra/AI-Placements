const mongoose = require('mongoose');

const studentQuestionHistorySchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  company: {
    type: String,
    required: true
  },
  recentQuestionIds: {
    type: [String],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model(
  'StudentQuestionHistory',
  studentQuestionHistorySchema
);
