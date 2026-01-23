const Assessment = require('../models/Assessment');
const ParsedQuestion = require('../models/ParsedQuestion');
const Attempt = require('../models/Attempt');


exports.createAssessment = async (req, res) => {
  try {
    const {
      title,
      description,
      companyName,
      folder,
      duration,
      totalMarks,
      scheduledDate,
      endDate,
      isPractice,
      assessmentType,
      allowedStudents,
      questions
    } = req.body;

    console.log(questions);

    // 🔹 VALIDATION: Admin-created assessments MUST have allowedStudents
    if (assessmentType !== 'random' && (!allowedStudents || allowedStudents.length === 0)) {
      return res.status(400).json({
        success: false,
        message: `Admin-created assessments (${assessmentType}) must have allowed students specified`,
        field: 'allowedStudents'
      });
    }

    const assessment = await Assessment.create({
      title,
      description,
      companyName,
      folder,
      questions,
      duration,
      totalMarks,
      scheduledDate,
      endDate,
      isPractice,
      assessmentType,
      allowedStudents: assessmentType !== 'random' ? allowedStudents : [], // 🔹 Only for admin-created
      createdBy: req.user._id
    });

    // 🔹 Log the created assessment with all questions including explanations
    console.log(`Assessment created: ${assessment._id} with ${assessment.questions.length} questions`);
    if (assessment.questions.length > 0) {
      console.log(`First question: text="${assessment.questions[0].text}", has_explanation=${!!assessment.questions[0].explanation}`);
    }

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully',
      assessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAllAssessments = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'student') {
      // 🔹 Students can see:
      // 1. Admin-created assessments they're allowed to take
      // 2. Random assessments assigned to them
      query = {
        $or: [
          // Admin-created (scheduled/practice) that include this student
          {
            assessmentType: { $in: ['scheduled', 'practice'] },
            allowedStudents: req.user._id
          },
          // Random assessments assigned to this student
          {
            assessmentType: 'random',
            assignedStudent: req.user._id
          }
        ]
      };
    }

    const assessments = await Assessment.find(query)
      .populate('folder', 'name companyName')
      .populate('createdBy', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: assessments.length,
      assessments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAssessmentById = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id)
      .populate('folder', 'name')
      .populate('createdBy', 'name email');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // 🔹 ACCESS CONTROL:
    // For RANDOM assessments: only assignedStudent can access
    if (assessment.assessmentType === 'random') {
      if (!assessment.assignedStudent || assessment.assignedStudent.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this random assessment'
        });
      }
    }
    // For ADMIN-CREATED assessments: must be in allowedStudents
    else {
      const isAllowed = assessment.allowedStudents && 
                       assessment.allowedStudents.some(id => id.toString() === req.user._id.toString());
      if (!isAllowed && req.user.role !== 'admin' && req.user.role !== 'mentor') {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this assessment'
        });
      }
    }

    if (!assessment.questions || assessment.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Assessment has no questions'
      });
    }

    res.status(200).json({
      success: true,
      assessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


exports.getQuestionsByFolder = async (req, res) => {
  try {
    const questions = await ParsedQuestion.find({ folderId: req.params.folderId });

    res.status(200).json({
      success: true,
      count: questions.length,
      questions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateAssessment = async (req, res) => {
  try {
    let assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Assessment updated successfully',
      assessment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.deleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    await Assessment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.generateRandomAssessment = async (req, res) => {
  try {
    const {
      mode, // "TOPIC" | "FULL"
      company,
      topic,
      subtopic,
      difficulty,
      numberOfQuestions = 10,
      duration = 30
    } = req.body;

    

    let selectedQuestions = [];

    // ------------------------------------------------
    // ✅ TOPIC-WISE RANDOM (CORRECT VERSION)
    // ------------------------------------------------
    if (mode === 'TOPIC') {
      if (!topic || !subtopic || !difficulty) {
        return res.status(400).json({
          success: false,
          message: 'Topic, subtopic and difficulty are required'
        });
      }

      const parsedDoc = await ParsedQuestion.findOne({
        company,
        topic,
        subfolder: subtopic
      });
      console.log('✅ parsedDoc keys:', Object.keys(parsedDoc._doc || parsedDoc));
console.log('✅ questionsByDifficulty:', parsedDoc.questionsByDifficulty);
console.log('✅ typeof:', typeof parsedDoc.questionsByDifficulty)
      

      if (!parsedDoc || !parsedDoc.questionsByDifficulty) {
        return res.status(400).json({
          success: false,
          message: 'No questions found for this topic & subtopic'
        });
      }

      const questions =
        parsedDoc.questionsByDifficulty[difficulty] || [];

      console.log('Filtered Questions:', questions);

      if (questions.length < numberOfQuestions) {
        return res.status(400).json({
          success: false,
          message: 'Not enough questions for selected difficulty'
        });
      }

      selectedQuestions = questions
        .sort(() => 0.5 - Math.random())
        .slice(0, numberOfQuestions);
    }

    // ------------------------------------------------
    // ✅ FULL RANDOM (COMPANY-WIDE)
    // ------------------------------------------------
    else {
      const parsedDocs = await ParsedQuestion.find({ company });

      let allQuestions = [];

      parsedDocs.forEach(doc => {
        Object.values(doc.questionsByDifficulty || {}).forEach(arr => {
          allQuestions.push(...arr);
        });
      });

      if (allQuestions.length < numberOfQuestions) {
        return res.status(400).json({
          success: false,
          message: 'Not enough questions available'
        });
      }

      selectedQuestions = allQuestions
        .sort(() => 0.5 - Math.random())
        .slice(0, numberOfQuestions);
    }

    // ------------------------------------------------
    // ✅ CREATE ASSESSMENT
    // ------------------------------------------------
    const assessment = await Assessment.create({
      title: `Random Practice - ${topic || company}`,
      description: 'Auto-generated random assessment',
      companyName: company,
      duration,
      totalMarks: selectedQuestions.length,
      questions: selectedQuestions.map(q => ({
        id: q.id || q.questionId,
        text: q.questionText || q.text,
        options: q.options,
        answer: q.correctAnswer || q.answer,
        difficulty,
        topic,
        subtopic
      })),
      isPractice: true,
      assessmentType: 'random',
      // 🔹 IMPORTANT: Assign to current user
      assignedStudent: req.user._id,
      allowedStudents: [], // 🔹 Random assessments don't use allowedStudents
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      assessment
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
