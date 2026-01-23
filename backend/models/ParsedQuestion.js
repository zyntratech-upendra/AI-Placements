const mongoose = require('mongoose');

const parsedQuestionSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    required: true
  },

  // 🔹 Parsed-file level fields
  company: {
    type: String
  },
  topic: {
    type: String
  },
  subfolder: {
    type: String
  },

  // 🔹 ADD THIS (IMPORTANT)
  questionsByDifficulty: {
    Easy: { type: Array, default: [] },
    Medium: { type: Array, default: [] },
    Difficult: { type: Array, default: [] }
  },

  totalByDifficulty: {
    type: Object,
    default: {}
  },
  totalExtracted: Number,
  totalValid: Number,

  // 🔹 Keep these for backward compatibility
  questionText: String,
  options: [String],
  correctAnswer: String,
  difficulty: String,
  questionType: {
    type: String,
    enum: ['mcq', 'coding', 'descriptive'],
    default: 'mcq'
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('ParsedQuestion', parsedQuestionSchema);
