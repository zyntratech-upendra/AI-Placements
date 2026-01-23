const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  topic: String,
  subtopic: String,
  difficulty: String,
  questions: {
    type: Array,
    required: true
  }
}, { _id: false });


const assessmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  companyName: {
    type: String,
    required: true
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder'
  },
   sections: {
    type: [sectionSchema],
    required: true
  },
  questions: [{
    type: Array,
    required: true
  }],
  duration: {
    type: Number,
    required: true
  },
  totalMarks: {
    type: Number,
    required: true
  },
  scheduledDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPractice: {
    type: Boolean,
    default: false
  },
  // 🔹 For ADMIN-CREATED assessments: specify which students are allowed
  allowedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // 🔹 For RANDOM assessments: the specific student this assessment is assigned to
  assignedStudent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Made optional for system-generated assessments
  },
  
  // 🔹 For adaptive learning: system-generated targeted assessments
  isSystemGenerated: {
    type: Boolean,
    default: false
  },

  // 🔹 Assessment Type:
  // - 'scheduled': Admin-created with allowedStudents (requires allowedStudents to be non-empty)
  // - 'practice': Admin-created practice assessment (requires allowedStudents to be non-empty)
  // - 'random': Auto-generated random (uses assignedStudent, no allowedStudents)
  // - 'placement': Placement exam
  // - 'resume': Resume-based assessment
  assessmentType: {
    type: String,
    enum: ['scheduled', 'practice', 'random', 'placement', 'targeted', 'resume'],
    default: 'practice'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Assessment', assessmentSchema);
