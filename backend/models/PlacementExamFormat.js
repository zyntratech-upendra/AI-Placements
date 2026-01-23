const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true
  },
  subtopic: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Difficult'],
    required: true
  },
  questionCount: {
    type: Number,
    required: true
  }
}, { _id: false });

const placementExamFormatSchema = new mongoose.Schema({
  company: {
    type: String,
    required: true
  },
  examName: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  sections: {
    type: [sectionSchema],
    required: true
  },
    version: {
    type: Number,
    default: 1
  },
  parentFormatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlacementExamFormat',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model( 'PlacementExamFormat', placementExamFormatSchema);
