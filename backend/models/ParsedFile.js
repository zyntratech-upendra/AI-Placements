const mongoose = require('mongoose');

const parsedFileSchema = new mongoose.Schema({
  fileId: mongoose.Schema.Types.ObjectId,
  company: String,
  topic: String,
  subfolder: String,
  questionsByDifficulty: {
    Easy: { type: Array, default: [] },
    Medium: { type: Array, default: [] },
    Difficult: { type: Array, default: [] }
  },
  totalByDifficulty: Object,
  totalExtracted: Number,
  totalValid: Number
}, { timestamps: true });

module.exports = mongoose.model('ParsedFile', parsedFileSchema);
