const Assessment = require('../models/Assessment');
const Attempt = require('../models/Attempt');
const WeakAreaAnalysis = require('../models/WeakAreaAnalysis');
const WeakAreaAnalysisService = require('../services/WeakAreaAnalysisService');

/**
 * GET Placement Exam Result
 * Route: GET /placement-attempts/:attemptId
 * Also triggers weak area analysis if not already done
 */
exports.getPlacementResult = async (req, res) => {
  try {
    const { attemptId } = req.params;
   
    const attempt = await Attempt.findById(attemptId)
      .populate('assessment')
      .populate('student', 'name email');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }
    

    const assessment = attempt.assessment;

    if (assessment.assessmentType !== 'placement') {
      return res.status(400).json({
        success: false,
        message: 'Not a placement exam'
      });
    }

    /* ============================
       BUILD SECTION-WISE RESULTS
    ============================ */
    const sectionResults = [];
    let totalScore = 0;
    let totalMarks = 0;

    assessment.sections.forEach(section => {
      let sectionScore = 0;
      const sectionTotal = section.questions.length;

      console.log(`\n=== Section: ${section.topic} - ${section.subtopic} ===`);
      
      section.questions.forEach(question => {
        const userAnswer = attempt.answers.find(
          a => String(a.questionId) === String(question.questionId)
        );
      
        // Debug logging
        console.log('Question ID:', question.questionId);
        console.log('Correct Answer (from question):', question.answer);
        console.log('User Selected Answer:', userAnswer?.selectedAnswer);
        console.log('Match:', userAnswer?.selectedAnswer === question.answer);

        if (
          userAnswer &&
          userAnswer.selectedAnswer === question.answer
        ) {
          sectionScore += 1;
          totalScore += 1;
          console.log('✓ CORRECT');
        } else {
          console.log('✗ INCORRECT');
        }
      });

      console.log(`Section Score: ${sectionScore}/${sectionTotal}`);

      totalMarks += sectionTotal;

      sectionResults.push({
        topic: section.topic,
        subtopic: section.subtopic,
        difficulty: section.difficulty,
        score: sectionScore,
        total: sectionTotal
      });
    });

    const percentage = Math.round((totalScore / totalMarks) * 100);

    /* ============================
       TRIGGER WEAK AREA ANALYSIS
    ============================ */
    let weakAreaAnalysis = null;
    try {
      // Check if analysis already exists
      const existingAnalysis = await WeakAreaAnalysis.findOne({ attemptId });
      
      if (!existingAnalysis) {
        // Auto-trigger analysis in background
        weakAreaAnalysis = await WeakAreaAnalysisService.analyzeAttempt(attemptId);
        console.log('Weak area analysis completed for attempt:', attemptId);
      } else {
        weakAreaAnalysis = existingAnalysis;
      }
    } catch (analysisError) {
      console.error('Weak area analysis failed (non-blocking):', analysisError.message);
      // Continue without blocking the result response
    }

    /* ============================
       FINAL RESPONSE
    ============================ */
    res.status(200).json({
      success: true,
      result: {
        attemptId: attempt._id,
        student: attempt.student,
        companyName: assessment.companyName,
        examTitle: assessment.title,
        totalScore,
        totalMarks,
        percentage,
        sectionResults,
        submittedAt: attempt.updatedAt,
        // Include weak area info if available
        weakAreaAnalysis: weakAreaAnalysis ? {
          qualificationStatus: weakAreaAnalysis.qualificationStatus,
          weakSections: weakAreaAnalysis.weakSections,
          cycleNumber: weakAreaAnalysis.cycleNumber
        } : null
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

