const Assessment = require('../models/Assessment');
const Attempt = require('../models/Attempt');

exports.startPlacementAssessment = async (req, res) => {
  try {
    // this is called AFTER exam format logic
    // assessment already created in studentPlacementExamController
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getPlacementAssessment = async (req, res) => {
  try {
    const assessmentId = req.params.assessmentId;
    console.log('Looking for placement assessment:', assessmentId);
    
    const assessment = await Assessment.findById(assessmentId);
    
    console.log('Found assessment:', assessment ? {
      _id: assessment._id,
      title: assessment.title,
      assessmentType: assessment.assessmentType
    } : 'NULL');

    if (!assessment || assessment.assessmentType !== 'placement') {
      console.log('Assessment not found or wrong type:', assessment?.assessmentType);
      return res.status(404).json({
        success: false,
        message: 'Placement assessment not found'
      });
    }

    res.json({ success: true, assessment });
  } catch (error) {
    console.error('Error in getPlacementAssessment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.submitPlacementAssessment = async (req, res) => {
  try {
    const { answers } = req.body;
    const assessmentId = req.params.assessmentId;

    // Validate that answers is an array
    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Answers must be a non-empty array'
      });
    }

    console.log('Received answers:', answers);

    // Validate and transform answers to ensure all have questionId
    const validatedAnswers = answers.map((answer, index) => {
      if (!answer.questionId) {
        throw new Error(`Answer at index ${index} is missing questionId`);
      }
      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer || '',
        isCorrect: answer.isCorrect,
        marksObtained: answer.marksObtained || 0
      };
    });

    // Calculate total score and percentage
    const totalScore = validatedAnswers.reduce((sum, a) => sum + (a.marksObtained || 0), 0);
    const totalQuestions = validatedAnswers.length;
    const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    console.log(`Score calculated: ${totalScore}/${totalQuestions} = ${percentage}%`);

    const attempt = await Attempt.create({
      assessment: assessmentId,
      student: req.user._id,
      answers: validatedAnswers,
      totalScore: totalScore,
      percentage: percentage,
      status: 'submitted',
      attemptType: 'placement',
      endTime: new Date()
    });

    res.json({ success: true, attempt });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

