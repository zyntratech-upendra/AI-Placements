const Resume = require('../models/Resume');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const docx = require('docx');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// @desc    List all student's resumes
// @route   GET /api/resume/list
// @access  Private
exports.listResumes = async (req, res) => {
  try {
    const resumes = await Resume.find({ studentId: req.user.id }).select('_id resumeName template isActive createdAt');

    res.status(200).json({
      success: true,
      data: resumes || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get student's active resume or specific resume by ID
// @route   GET /api/resume or GET /api/resume/:id
// @access  Private
exports.getResume = async (req, res) => {
  try {
    const { id } = req.params;
    let resume;

    if (id) {
      // Get specific resume by ID
      resume = await Resume.findOne({ _id: id, studentId: req.user.id });
    } else {
      // Get active resume
      resume = await Resume.findOne({ studentId: req.user.id, isActive: true });
    }

    if (!resume) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No resume found'
      });
    }

    res.status(200).json({
      success: true,
      data: resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create new resume
// @route   POST /api/resume/create
// @access  Private
exports.createResume = async (req, res) => {
  try {
    const { resumeName } = req.body;

    if (!resumeName) {
      return res.status(400).json({
        success: false,
        message: 'Resume name is required'
      });
    }

    // Set all existing resumes to inactive when creating new one
    await Resume.updateMany(
      { studentId: req.user.id },
      { isActive: false }
    );

    const defaultResume = {
      personalInfo: {
        fullName: '',
        email: '',
        phone: '',
        location: '',
        summary: '',
        portfolio: '',
        linkedIn: ''
      },
      education: [{ id: 1, school: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', description: '' }],
      experience: [{ id: 1, company: '', position: '', location: '', startDate: '', endDate: '', description: '', achievements: '' }],
      skills: [{ id: 1, category: 'Technical', skills: '' }],
      projects: [{ id: 1, name: '', description: '', technologies: '', link: '', startDate: '', endDate: '' }],
      certifications: [{ id: 1, name: '', issuer: '', date: '', credentialId: '', credentialUrl: '' }]
    };

    const newResume = new Resume({
      studentId: req.user.id,
      resumeName,
      content: defaultResume,
      template: 'modern',
      isActive: true
    });

    await newResume.save();

    res.status(201).json({
      success: true,
      message: 'Resume created successfully',
      data: newResume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Save or update resume
// @route   POST /api/resume
// @access  Private
exports.saveResume = async (req, res) => {
  try {
    const { content, template, resumeId } = req.body;

    if (!content || !content.personalInfo) {
      return res.status(400).json({
        success: false,
        message: 'Resume content is required'
      });
    }

    let resume;

    if (resumeId) {
      // Update specific resume
      resume = await Resume.findOne({ _id: resumeId, studentId: req.user.id });
      if (!resume) {
        return res.status(404).json({
          success: false,
          message: 'Resume not found'
        });
      }
    } else {
      // Update active resume
      resume = await Resume.findOne({ studentId: req.user.id, isActive: true });
    }

    if (resume) {
      // Update existing resume
      resume.content = content;
      resume.template = template || 'modern';
      await resume.save();
    } else {
      // Create new resume if none exists
      resume = new Resume({
        studentId: req.user.id,
        content,
        template: template || 'modern',
        resumeName: 'Resume 1',
        isActive: true
      });
      await resume.save();
    }

    res.status(201).json({
      success: true,
      message: 'Resume saved successfully',
      data: resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete resume
// @route   DELETE /api/resume/:id
// @access  Private
exports.deleteResume = async (req, res) => {
  try {
    const { id } = req.params;

    const resume = await Resume.findOne({ _id: id, studentId: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    const wasActive = resume.isActive;
    await Resume.deleteOne({ _id: id });

    // If deleted resume was active, set another as active
    if (wasActive) {
      const remainingResume = await Resume.findOne({ studentId: req.user.id });
      if (remainingResume) {
        remainingResume.isActive = true;
        await remainingResume.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Rename resume
// @route   PUT /api/resume/:id/rename
// @access  Private
exports.renameResume = async (req, res) => {
  try {
    const { id } = req.params;
    const { resumeName } = req.body;

    if (!resumeName) {
      return res.status(400).json({
        success: false,
        message: 'Resume name is required'
      });
    }

    const resume = await Resume.findOne({ _id: id, studentId: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    resume.resumeName = resumeName;
    await resume.save();

    res.status(200).json({
      success: true,
      message: 'Resume renamed successfully',
      data: resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Set resume as active
// @route   PUT /api/resume/:id/activate
// @access  Private
exports.setActiveResume = async (req, res) => {
  try {
    const { id } = req.params;

    // Set all resumes as inactive
    await Resume.updateMany(
      { studentId: req.user.id },
      { isActive: false }
    );

    // Set selected resume as active
    const resume = await Resume.findOne({ _id: id, studentId: req.user.id });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    resume.isActive = true;
    await resume.save();

    res.status(200).json({
      success: true,
      message: 'Resume activated successfully',
      data: resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Upload and parse resume file
// @route   POST /api/resume/upload
// @access  Private
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const fileType = req.file.mimetype.split('/')[1];
    let extractedText = '';

    // Parse file based on type
    if (fileType === 'pdf') {
      const pdfData = await pdf.default(req.file.buffer);
      extractedText = pdfData.text;
    } else if (fileType === 'plain' || fileType === 'text') {
      extractedText = req.file.buffer.toString('utf-8');
    } else {
      // For DOCX files, we'd need a library like docx-parser
      extractedText = req.file.buffer.toString('utf-8');
    }

    // Parse extracted text into resume structure
    const parsedResume = parseResumeText(extractedText);

    // Get active resume or create new one
    let resume = await Resume.findOne({ studentId: req.user.id, isActive: true });

    if (resume) {
      resume.content = parsedResume;
      resume.uploadedFile = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        uploadDate: new Date(),
        fileType
      };
      await resume.save();
    } else {
      resume = new Resume({
        studentId: req.user.id,
        content: parsedResume,
        resumeName: 'Resume 1',
        isActive: true,
        uploadedFile: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          uploadDate: new Date(),
          fileType
        }
      });
      await resume.save();
    }

    res.status(200).json({
      success: true,
      message: 'Resume uploaded and parsed successfully',
      data: resume
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Download resume as PDF or DOCX
// @route   POST /api/resume/download
// @access  Private
exports.downloadResume = async (req, res) => {
  try {
    const { format, template, resumeId } = req.body;

    let resume;
    if (resumeId) {
      resume = await Resume.findOne({ _id: resumeId, studentId: req.user.id });
    } else {
      resume = await Resume.findOne({ studentId: req.user.id, isActive: true });
    }

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    if (format === 'pdf') {
      generatePDF(resume.content, template || 'modern', res);
    } else if (format === 'docx') {
      generateDOCX(resume.content, template || 'modern', res);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Use pdf or docx'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to parse resume text
function parseResumeText(text) {
  // Basic parsing logic - can be enhanced with NLP
  const lines = text.split('\n').filter(line => line.trim());

  return {
    personalInfo: {
      fullName: extractName(lines) || '',
      email: extractEmail(lines) || '',
      phone: extractPhone(lines) || '',
      location: '',
      summary: lines.slice(0, 3).join(' '),
      portfolio: '',
      linkedIn: ''
    },
    education: [{ id: 1, school: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', description: '' }],
    experience: [{ id: 1, company: '', position: '', location: '', startDate: '', endDate: '', description: '', achievements: '' }],
    skills: [{ id: 1, category: 'Technical', skills: '' }],
    projects: [{ id: 1, name: '', description: '', technologies: '', link: '', startDate: '', endDate: '' }],
    certifications: [{ id: 1, name: '', issuer: '', date: '', credentialId: '', credentialUrl: '' }]
  };
}

function extractName(lines) {
  return lines[0] || '';
}

function extractEmail(lines) {
  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  for (const line of lines) {
    const match = line.match(emailRegex);
    if (match) return match[0];
  }
  return '';
}

function extractPhone(lines) {
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  for (const line of lines) {
    const match = line.match(phoneRegex);
    if (match) return match[0];
  }
  return '';
}

// Helper function to generate PDF
function generatePDF(content, template, res) {
  const doc = new PDFDocument();
  const filename = `resume-${Date.now()}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

  doc.pipe(res);

  // Apply template styling
  const colors = getTemplateColors(template);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').fillColor(colors.primary);
  doc.text(content.personalInfo.fullName || 'Your Name', { align: 'center' });
  
  doc.fontSize(10).font('Helvetica').fillColor('#666666');
  const contactInfo = [
    content.personalInfo.location,
    content.personalInfo.email,
    content.personalInfo.phone
  ].filter(Boolean).join(' | ');
  
  if (contactInfo) {
    doc.text(contactInfo, { align: 'center' });
  }

  doc.moveDown();

  // Professional Summary
  if (content.personalInfo.summary) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text('PROFESSIONAL SUMMARY');
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text(content.personalInfo.summary, { align: 'left', width: 500 });
    doc.moveDown();
  }

  // Education
  if (content.education && content.education.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text('EDUCATION');
    
    content.education.forEach(edu => {
      if (edu.school) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`${edu.school}${edu.degree ? ' - ' + edu.degree : ''}`, { underline: false });
        
        if (edu.field || edu.startDate) {
          doc.fontSize(9).font('Helvetica').fillColor('#666666');
          doc.text(`${edu.field}${edu.startDate ? ' | ' + edu.startDate : ''}`);
        }
        
        if (edu.description) {
          doc.fontSize(9).font('Helvetica').fillColor('#000000');
          doc.text(edu.description);
        }
        doc.moveDown(0.3);
      }
    });
    doc.moveDown();
  }

  // Experience
  if (content.experience && content.experience.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text('WORK EXPERIENCE');
    
    content.experience.forEach(exp => {
      if (exp.company) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`${exp.position}${exp.company ? ' at ' + exp.company : ''}`);
        
        if (exp.startDate || exp.location) {
          doc.fontSize(9).font('Helvetica').fillColor('#666666');
          doc.text(`${exp.startDate}${exp.location ? ' | ' + exp.location : ''}`);
        }
        
        if (exp.description) {
          doc.fontSize(9).font('Helvetica').fillColor('#000000');
          doc.text('• ' + exp.description);
        }
        
        if (exp.achievements) {
          doc.fontSize(9).font('Helvetica').fillColor('#000000');
          doc.text('• ' + exp.achievements);
        }
        doc.moveDown(0.3);
      }
    });
    doc.moveDown();
  }

  // Skills
  if (content.skills && content.skills.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text('SKILLS');
    
    content.skills.forEach(skill => {
      if (skill.skills) {
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`${skill.category}: `, { continued: true });
        doc.font('Helvetica').text(skill.skills);
      }
    });
    doc.moveDown();
  }

  // Projects
  if (content.projects && content.projects.length > 0 && content.projects[0].name) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text('PROJECTS');
    
    content.projects.forEach(project => {
      if (project.name) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text(project.name);
        
        if (project.description) {
          doc.fontSize(9).font('Helvetica').fillColor('#000000');
          doc.text(project.description);
        }
        
        if (project.technologies) {
          doc.fontSize(9).font('Helvetica').fillColor('#666666');
          doc.text('Technologies: ' + project.technologies);
        }
        doc.moveDown(0.3);
      }
    });
    doc.moveDown();
  }

  // Certifications
  if (content.certifications && content.certifications.length > 0 && content.certifications[0].name) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary);
    doc.text('CERTIFICATIONS');
    
    content.certifications.forEach(cert => {
      if (cert.name) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
        doc.text(`${cert.name}${cert.issuer ? ' - ' + cert.issuer : ''}`);
        
        if (cert.date) {
          doc.fontSize(9).font('Helvetica').fillColor('#666666');
          doc.text(cert.date);
        }
        doc.moveDown(0.3);
      }
    });
  }

  doc.end();
}

// Helper function to generate DOCX
function generateDOCX(content, template, res) {
  const colors = getTemplateColors(template);

  const sections = [];

  // Header with name and contact
  sections.push(
    new docx.Paragraph({
      text: content.personalInfo.fullName || 'Your Name',
      bold: true,
      size: 40,
      alignment: docx.AlignmentType.CENTER
    })
  );

  const contactInfo = [
    content.personalInfo.location,
    content.personalInfo.email,
    content.personalInfo.phone
  ].filter(Boolean).join(' | ');

  if (contactInfo) {
    sections.push(
      new docx.Paragraph({
        text: contactInfo,
        alignment: docx.AlignmentType.CENTER,
        size: 20
      })
    );
  }

  sections.push(new docx.Paragraph({ text: '' })); // Spacing

  // Professional Summary
  if (content.personalInfo.summary) {
    sections.push(
      new docx.Paragraph({
        text: 'PROFESSIONAL SUMMARY',
        bold: true,
        size: 24,
        color: colors.primary.replace('#', '')
      })
    );
    sections.push(
      new docx.Paragraph({
        text: content.personalInfo.summary,
        size: 20
      })
    );
    sections.push(new docx.Paragraph({ text: '' }));
  }

  // Education
  if (content.education && content.education.length > 0 && content.education[0].school) {
    sections.push(
      new docx.Paragraph({
        text: 'EDUCATION',
        bold: true,
        size: 24,
        color: colors.primary.replace('#', '')
      })
    );

    content.education.forEach(edu => {
      if (edu.school) {
        sections.push(
          new docx.Paragraph({
            text: `${edu.school}${edu.degree ? ' - ' + edu.degree : ''}`,
            bold: true,
            size: 20
          })
        );

        if (edu.field || edu.startDate) {
          sections.push(
            new docx.Paragraph({
              text: `${edu.field}${edu.startDate ? ' | ' + edu.startDate : ''}`,
              size: 18,
              italics: true
            })
          );
        }

        if (edu.description) {
          sections.push(
            new docx.Paragraph({
              text: edu.description,
              size: 20
            })
          );
        }
      }
    });
    sections.push(new docx.Paragraph({ text: '' }));
  }

  // Experience
  if (content.experience && content.experience.length > 0 && content.experience[0].company) {
    sections.push(
      new docx.Paragraph({
        text: 'WORK EXPERIENCE',
        bold: true,
        size: 24,
        color: colors.primary.replace('#', '')
      })
    );

    content.experience.forEach(exp => {
      if (exp.company) {
        sections.push(
          new docx.Paragraph({
            text: `${exp.position}${exp.company ? ' at ' + exp.company : ''}`,
            bold: true,
            size: 20
          })
        );

        if (exp.startDate || exp.location) {
          sections.push(
            new docx.Paragraph({
              text: `${exp.startDate}${exp.location ? ' | ' + exp.location : ''}`,
              size: 18,
              italics: true
            })
          );
        }

        if (exp.description) {
          sections.push(
            new docx.Paragraph({
              text: '• ' + exp.description,
              size: 20,
              bullet: { level: 0 }
            })
          );
        }

        if (exp.achievements) {
          sections.push(
            new docx.Paragraph({
              text: '• ' + exp.achievements,
              size: 20,
              bullet: { level: 0 }
            })
          );
        }
      }
    });
    sections.push(new docx.Paragraph({ text: '' }));
  }

  // Skills
  if (content.skills && content.skills.length > 0 && content.skills[0].skills) {
    sections.push(
      new docx.Paragraph({
        text: 'SKILLS',
        bold: true,
        size: 24,
        color: colors.primary.replace('#', '')
      })
    );

    content.skills.forEach(skill => {
      if (skill.skills) {
        sections.push(
          new docx.Paragraph({
            text: `${skill.category}: ${skill.skills}`,
            size: 20
          })
        );
      }
    });
    sections.push(new docx.Paragraph({ text: '' }));
  }

  // Projects
  if (content.projects && content.projects.length > 0 && content.projects[0].name) {
    sections.push(
      new docx.Paragraph({
        text: 'PROJECTS',
        bold: true,
        size: 24,
        color: colors.primary.replace('#', '')
      })
    );

    content.projects.forEach(project => {
      if (project.name) {
        sections.push(
          new docx.Paragraph({
            text: project.name,
            bold: true,
            size: 20
          })
        );

        if (project.description) {
          sections.push(
            new docx.Paragraph({
              text: project.description,
              size: 20
            })
          );
        }

        if (project.technologies) {
          sections.push(
            new docx.Paragraph({
              text: 'Technologies: ' + project.technologies,
              size: 18,
              italics: true
            })
          );
        }
      }
    });
    sections.push(new docx.Paragraph({ text: '' }));
  }

  // Certifications
  if (content.certifications && content.certifications.length > 0 && content.certifications[0].name) {
    sections.push(
      new docx.Paragraph({
        text: 'CERTIFICATIONS',
        bold: true,
        size: 24,
        color: colors.primary.replace('#', '')
      })
    );

    content.certifications.forEach(cert => {
      if (cert.name) {
        sections.push(
          new docx.Paragraph({
            text: `${cert.name}${cert.issuer ? ' - ' + cert.issuer : ''}`,
            bold: true,
            size: 20
          })
        );

        if (cert.date) {
          sections.push(
            new docx.Paragraph({
              text: cert.date,
              size: 18,
              italics: true
            })
          );
        }
      }
    });
  }

  const doc = new docx.Document({
    sections: [
      {
        properties: {},
        children: sections
      }
    ]
  });

  // Generate and send the document
  docx.Packer.toBuffer(doc).then(buffer => {
    const filename = `resume-${Date.now()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  });
}

// Helper function to get template colors
function getTemplateColors(template) {
  const colors = {
    modern: { primary: '#2563eb', secondary: '#1e40af' }, // Blue
    classic: { primary: '#1f2937', secondary: '#374151' }, // Gray
    creative: { primary: '#dc2626', secondary: '#991b1b' }, // Red
    minimal: { primary: '#64748b', secondary: '#475569' } // Slate
  };

  return colors[template] || colors.modern;
}

module.exports = {
  listResumes: exports.listResumes,
  getResume: exports.getResume,
  saveResume: exports.saveResume,
  createResume: exports.createResume,
  deleteResume: exports.deleteResume,
  renameResume: exports.renameResume,
  setActiveResume: exports.setActiveResume,
  uploadResume: exports.uploadResume,
  downloadResume: exports.downloadResume,
  upload
};
