const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      sparse: true
    },
    resumeName: {
      type: String,
      required: true,
      default: 'Resume 1'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    content: {
      personalInfo: {
        fullName: String,
        email: String,
        phone: String,
        location: String,
        summary: String,
        portfolio: String,
        linkedIn: String
      },
      education: [
        {
          id: Number,
          school: String,
          degree: String,
          field: String,
          startDate: String,
          endDate: String,
          gpa: String,
          description: String
        }
      ],
      experience: [
        {
          id: Number,
          company: String,
          position: String,
          location: String,
          startDate: String,
          endDate: String,
          description: String,
          achievements: String
        }
      ],
      skills: [
        {
          id: Number,
          category: String,
          skills: String
        }
      ],
      projects: [
        {
          id: Number,
          name: String,
          description: String,
          technologies: String,
          link: String,
          startDate: String,
          endDate: String
        }
      ],
      certifications: [
        {
          id: Number,
          name: String,
          issuer: String,
          date: String,
          credentialId: String,
          credentialUrl: String
        }
      ]
    },
    template: {
      type: String,
      default: 'modern',
      enum: ['modern', 'classic', 'creative', 'minimal']
    },
    uploadedFile: {
      filename: String,
      originalName: String,
      uploadDate: Date,
      fileType: String // pdf, docx, doc, txt
    }
  },
  { timestamps: true }
);

// Drop any existing unique index on studentId from old versions
resumeSchema.index({ studentId: 1 }, { sparse: true });

module.exports = mongoose.model('Resume', resumeSchema);
