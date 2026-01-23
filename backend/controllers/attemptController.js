const Attempt = require('../models/Attempt');
const Assessment = require('../models/Assessment');
const ParsedQuestion = require('../models/ParsedQuestion');


exports.startAttempt = async (req, res) => {
  try {
    const { assessmentId } = req.body;
    console.log(assessmentId);

    const assessment = await Assessment.findById(assessmentId);


    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Check for questions - could be in assessment.questions OR in sections[].questions
    let hasQuestions = assessment.questions && assessment.questions.length > 0;
    
    // If no direct questions, check sections
    if (!hasQuestions && assessment.sections && assessment.sections.length > 0) {
      // Flatten questions from sections into the questions array format
      const flattenedQuestions = [];
      for (const section of assessment.sections) {
        if (section.questions && section.questions.length > 0) {
          for (const q of section.questions) {
            flattenedQuestions.push([{
              id: q.questionId,
              text: q.questionText,
              options: q.options,
              answer: q.answer,
              marks: q.marks || 1
            }]);
          }
        }
      }
      if (flattenedQuestions.length > 0) {
        assessment.questions = flattenedQuestions;
        hasQuestions = true;
      }
    }

    if (!hasQuestions) {
      return res.status(400).json({
        success: false,
        message: 'Assessment has no questions'
      });
    }

    const existingAttempt = await Attempt.findOne({
      assessment: assessmentId,
      student: req.user._id,
      status: 'in_progress'
    }).populate('assessment');

    if (existingAttempt) {
      if (!existingAttempt.assessment.questions) {
        existingAttempt.assessment = await Assessment.findById(assessmentId).populate('questions');
      }
      return res.status(200).json({
        success: true,
        message: 'Resume existing attempt',
        attempt: existingAttempt,
        assessment
      });
    }

    const attempt = await Attempt.create({
      assessment: assessmentId,
      student: req.user._id,
      startTime: Date.now()
    });

    res.status(201).json({
      success: true,
      message: 'Attempt started successfully',
      attempt,
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

exports.submitAnswer = async (req, res) => {
  try {
    const { attemptId, questionId, selectedAnswer } = req.body;
    

    const attempt = await Attempt.findById(attemptId).populate('assessment');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    if (attempt.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const question = attempt.assessment.questions.find(qArr => qArr[0]?.id === questionId)?.[0];

    // If question not found in flattened questions array, check sections
    let correctAnswer = null;
    if (question) {
      correctAnswer = question.answer;
    } else {
      // Search in sections
      for (const section of (attempt.assessment.sections || [])) {
        const found = (section.questions || []).find(q => 
          q.questionId === questionId || q.id === questionId
        );
        if (found) {
          correctAnswer = found.answer;
          break;
        }
      }
    }
   
    const isCorrect = correctAnswer === selectedAnswer;
    const marksObtained = isCorrect ? 1 : 0;

 

    const answerIndex = attempt.answers.findIndex(
      a => a.questionId.toString() === questionId
    );

    if (answerIndex > -1) {
      attempt.answers[answerIndex] = {
        questionId,
        selectedAnswer,
        isCorrect,
        marksObtained
      };
    } else {
      attempt.answers.push({
        questionId,
        selectedAnswer,
        isCorrect,
        marksObtained
      });
    }

    await attempt.save();

    res.status(200).json({
      success: true,
      message: 'Answer submitted successfully',
      attempt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.submitAttempt = async (req, res) => {
  try {
    const { attemptId } = req.body;

    const attempt = await Attempt.findById(attemptId).populate('assessment');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    if (attempt.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const totalScore = attempt.answers.reduce((sum, ans) => sum + ans.marksObtained, 0);
    const percentage = (totalScore / attempt.assessment.totalMarks) * 100;

    attempt.endTime = Date.now();
    attempt.totalScore = totalScore;
    attempt.percentage = percentage.toFixed(2);
    attempt.status = 'submitted';
    attempt.timeTaken = Math.floor((attempt.endTime - attempt.startTime) / 1000);

    await attempt.save();

    // ========== CONTINUOUS LEARNING LOOP ==========
    // Check if this was a targeted practice assessment
    console.log(`[DEBUG] Attempt ${attempt._id} submitted. Type: ${attempt.assessment.assessmentType}, IsSystemGenerated: ${attempt.assessment.isSystemGenerated}`);
    
    if (attempt.assessment.isSystemGenerated && attempt.assessment.assessmentType === 'practice') {
      const WeakAreaAnalysis = require('../models/WeakAreaAnalysis');
      const companyName = attempt.assessment.companyName;
      
      console.log(`[DEBUG] Looking for WeakAreaAnalysis for user ${req.user._id} and company ${companyName}`);

      // Find the corresponding weak area analysis
      const weakAreaAnalysis = await WeakAreaAnalysis.findOne({
        student: req.user._id,
        company: companyName,
        assessmentsGenerated: true
      }).sort({ createdAt: -1 });

      if (weakAreaAnalysis) {
        console.log(`[DEBUG] Found WeakAreaAnalysis: ${weakAreaAnalysis._id}`);
        // Update the weak area analysis with practice result
        weakAreaAnalysis.practiceAttempts = (weakAreaAnalysis.practiceAttempts || 0) + 1;
        weakAreaAnalysis.lastPracticeScore = percentage;
        weakAreaAnalysis.lastPracticeDate = new Date();
        
        // Push to score history for charting (global tracking)
        if (!weakAreaAnalysis.scoreHistory) weakAreaAnalysis.scoreHistory = [];
        weakAreaAnalysis.scoreHistory.push({
          score: percentage,
          date: new Date(),
          difficulty: weakAreaAnalysis.currentDifficulty || 'Easy',
          attemptNumber: weakAreaAnalysis.practiceAttempts
        });
        
        // ===== PER-TOPIC FEEDBACK LOOP =====
        // Identify the topic of this practice assessment
        const practicedTopic = attempt.assessment.sections && attempt.assessment.sections[0] ? attempt.assessment.sections[0].topic : null;
        
        if (practicedTopic) {
           console.log(`[DEBUG] Updating feedback loop for topic: ${practicedTopic}`);
           const sectionToUpdate = weakAreaAnalysis.sections.find(s => s.topic === practicedTopic);
           
           if (sectionToUpdate) {
             // Update section stats
             sectionToUpdate.lastPracticeScore = percentage;
             sectionToUpdate.improvementPercentage = Math.max(
               sectionToUpdate.improvementPercentage || 0,
               percentage - sectionToUpdate.percentage // improvement over baseline
             );
             
             // Difficulty Progression (Per Topic)
             const MASTER_THRESHOLD = 80;
             const HARD_THRESHOLD = 90;
             
             if (percentage >= MASTER_THRESHOLD) {
                // If easy/medium, bump up difficulty
                if (sectionToUpdate.difficulty === 'Easy') {
                    sectionToUpdate.difficulty = 'Medium';
                    console.log(`[FEEDBACK] Promoted ${practicedTopic} to Medium`);
                } else if (sectionToUpdate.difficulty === 'Medium' && percentage >= HARD_THRESHOLD) {
                    sectionToUpdate.difficulty = 'Hard';
                    console.log(`[FEEDBACK] Promoted ${practicedTopic} to Hard`);
                }
             }
             
             // Update status based on recent performance
             if (percentage > 70) sectionToUpdate.status = 'strong';
             else if (percentage > 50) sectionToUpdate.status = 'average';
             else sectionToUpdate.status = 'weak';
           }
        }
        
        // Update global improvement
        weakAreaAnalysis.improvementPercentage = Math.max(
          weakAreaAnalysis.improvementPercentage || 0,
          percentage - weakAreaAnalysis.overallPercentage
        );
        
        // Difficulty Progression (Global fallback if no sections or mixed)
        // Keep global difficulty for broader assessments
        const MASTER_THRESHOLD = 80;
        if (percentage >= MASTER_THRESHOLD) {
          if (weakAreaAnalysis.currentDifficulty === 'Easy') {
            weakAreaAnalysis.currentDifficulty = 'Medium';
          } else if (weakAreaAnalysis.currentDifficulty === 'Medium' && percentage >= 90) {
            weakAreaAnalysis.currentDifficulty = 'Hard';
          }
        }
        
        // Alternative qualification: 3+ attempts with 80%+ average
        if (weakAreaAnalysis.qualificationStatus !== 'qualified' && 
            weakAreaAnalysis.practiceAttempts >= 3 && 
            percentage >= MASTER_THRESHOLD) {
          weakAreaAnalysis.qualificationStatus = 'qualified';
          console.log(`[PROGRESSION] QUALIFIED! Consistent 80%+ performance.`);
        }
        
        // Reset assessmentsGenerated to allow new assessment generation
        // (Only if they still need practice)
        if (weakAreaAnalysis.qualificationStatus !== 'qualified') {
          weakAreaAnalysis.assessmentsGenerated = false;
        }
        
        console.log(`[CONTINUOUS LEARNING] Company: ${companyName}`);
        console.log(`  - Score: ${percentage}% | Attempts: ${weakAreaAnalysis.practiceAttempts}`);
        console.log(`  - Difficulty: ${weakAreaAnalysis.currentDifficulty} | Status: ${weakAreaAnalysis.qualificationStatus}`);
        console.log(`  - Attempted Questions: ${weakAreaAnalysis.attemptedQuestionIds?.length || 0}`);
        
        await weakAreaAnalysis.save();
      } else {
        console.log(`[DEBUG] No matching WeakAreaAnalysis found for continuous update.`);
      }
    }
    // ========== END CONTINUOUS LEARNING ==========

    // ========== RESUME ASSESSMENT WEAK AREA ANALYSIS ==========
    // Trigger weak area analysis for resume assessments (similar to placement exams)
    if (attempt.assessment.assessmentType === 'resume') {
      try {
        const WeakAreaAnalysisService = require('../services/WeakAreaAnalysisService');
        const WeakAreaAnalysis = require('../models/WeakAreaAnalysis');
        
        // Check if analysis already exists for this attempt
        const existingAnalysis = await WeakAreaAnalysis.findOne({ attemptId: attempt._id });
        
        if (!existingAnalysis) {
          console.log(`[RESUME ASSESSMENT] Creating weak area analysis for attempt ${attempt._id}`);
          const analysis = await WeakAreaAnalysisService.analyzeAttempt(attempt._id);
          console.log(`[RESUME ASSESSMENT] Weak area analysis completed:`, {
            weakSections: analysis?.weakSections?.length || 0,
            qualificationStatus: analysis?.qualificationStatus
          });
        } else {
          console.log(`[RESUME ASSESSMENT] Analysis already exists for attempt ${attempt._id}`);
        }
      } catch (analysisError) {
        console.error('[RESUME ASSESSMENT] Weak area analysis failed (non-blocking):', analysisError.message);
        // Continue without blocking - analysis is nice-to-have
      }
    }
    // ========== END RESUME ASSESSMENT ANALYSIS ==========

    res.status(200).json({
      success: true,
      message: 'Attempt submitted successfully',
      attempt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAttemptById = async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id)
      .populate('assessment')
      .populate('student', 'name email rollNumber')
      .populate('answers.questionId');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      });
    }

    res.status(200).json({
      success: true,
      attempt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getMyAttempts = async (req, res) => {
  try {
    const attempts = await Attempt.find({ student: req.user._id })
      .populate('assessment', 'title companyName duration totalMarks')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: attempts.length,
      attempts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAllAttempts = async (req, res) => {
  try {
    const attempts = await Attempt.find()
      .populate('student', 'name email rollNumber department')
      .populate('assessment', 'title companyName duration totalMarks')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: attempts.length,
      attempts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAttemptsByAssessment = async (req, res) => {
  try {
    const attempts = await Attempt.find({ assessment: req.params.assessmentId })
      .populate('student', 'name email rollNumber department')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: attempts.length,
      attempts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
