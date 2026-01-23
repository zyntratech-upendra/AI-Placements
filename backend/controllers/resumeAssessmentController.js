const Assessment = require('../models/Assessment');
const ParsedQuestion = require('../models/ParsedQuestion');
const axios = require('axios');

const INTERVIEW_SERVICE_URL = process.env.INTERVIEW_SERVICE_URL || 'http://localhost:8000';

/**
 * Resume Assessment Controller
 * Generates assessments based on resume and job description
 */

/**
 * Get user's previously generated resume-based assessments
 * GET /api/resume-assessments/my-assessments
 */
exports.getMyResumeAssessments = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find all resume-type assessments assigned to this student
    const assessments = await Assessment.find({
      assessmentType: 'resume',
      assignedStudent: userId
    }).select('_id title metaData duration totalMarks createdAt').sort({ createdAt: -1 });

    // For each assessment, find any attempts
    const Attempt = require('../models/Attempt');
    const formattedAssessments = await Promise.all(assessments.map(async (assessment) => {
      const attempt = await Attempt.findOne({
        assessmentId: assessment._id,
        studentId: userId
      }).select('_id status percentage attemptNumber').sort({ createdAt: -1 });

      // Extract topic name from metaData or parse from title
      let topicName = 'Unknown';
      if (assessment.metaData && assessment.metaData.topicName) {
        topicName = assessment.metaData.topicName;
      } else if (assessment.title) {
        // Fallback: parse from title like "Resume Assessment - Python OOP"
        const parts = assessment.title.split(' - ');
        topicName = parts[1] || assessment.title;
      }

      return {
        _id: assessment._id,
        title: assessment.title,
        topic: topicName,
        duration: assessment.duration,
        questionCount: assessment.totalMarks,
        difficulty: (assessment.metaData && assessment.metaData.difficulty) || 'Medium',
        source: (assessment.metaData && assessment.metaData.source) || 'unknown',
        createdAt: assessment.createdAt,
        // Attempt info
        attemptedStatus: attempt?.status || 'not-started',
        score: attempt?.percentage || 0,
        attemptId: attempt?._id,
        attempt: attempt ? {
          attemptNumber: attempt.attemptNumber || 1
        } : null
      };
    }));

    res.status(200).json({
      success: true,
      assessments: formattedAssessments,
      total: formattedAssessments.length
    });
  } catch (error) {
    console.error('Error fetching resume assessments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assessments',
      error: error.message
    });
  }
};

/**
 * Generate assessment from resume topics
 * POST /api/resume-assessments/generate
 */
exports.generateFromResume = async (req, res) => {
  try {
    const { topics, jobTitle, duration, studentId } = req.body;
    
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Topics array is required'
      });
    }

    const actualStudentId = studentId || req.user.id;
    const createdAssessments = [];
    const topicsProcessed = [];

    // Create ONE assessment per topic
    for (const topic of topics) {
      const topicName = topic.name || topic;
      const difficulty = topic.difficulty || 'Medium';
      const topicQuestions = [];
      let source = 'unknown';

      // STEP 1: Try to get 5 questions from question bank for this topic
      const parsedDoc = await ParsedQuestion.findOne({
        $or: [
          { topic: { $regex: new RegExp(topicName, 'i') } },
          { subfolder: { $regex: new RegExp(topicName, 'i') } }
        ]
      });

      if (parsedDoc && parsedDoc.questionsByDifficulty) {
        const dbQuestions = parsedDoc.questionsByDifficulty[difficulty] || 
                           parsedDoc.questionsByDifficulty['Medium'] || 
                           [];
        
        // Take up to 5 questions from database
        const selectedQuestions = dbQuestions.slice(0, 5).map((q, idx) => ({
          questionId: q.questionId || `resume-${topicName.replace(/\s/g, '')}-${idx}`,
          text: q.text || q.questionText,
          options: q.options || [],
          answer: q.answer || q.correctAnswer,
          marks: 1
        }));
        
        topicQuestions.push(...selectedQuestions);
        source = 'question_bank';
      }

      // STEP 2: If less than 5 questions, generate remaining from LLM
      if (topicQuestions.length < 5) {
        try {
          const questionsNeeded = 5 - topicQuestions.length;
          const llmResponse = await axios.post(
            `${INTERVIEW_SERVICE_URL}/api/resume-assessment/generate-questions`,
            new URLSearchParams({
              topics: topicName,
              question_count: questionsNeeded,
              difficulty: difficulty
            }),
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
          );
          
          if (llmResponse.data.success && llmResponse.data.questions) {
            const llmQuestions = llmResponse.data.questions.slice(0, questionsNeeded).map((q, idx) => ({
              questionId: q.questionId || `llm-${topicName.replace(/\s/g, '')}-${idx}`,
              text: q.text,
              options: q.options || [],
              answer: q.answer || q.correctAnswer,
              marks: 1
            }));
            topicQuestions.push(...llmQuestions);
            source = topicQuestions.length === 5 && source === 'question_bank' ? 'mixed' : 'llm_generated';
          }
        } catch (llmError) {
          console.error(`LLM question generation failed for topic ${topicName}:`, llmError.message);
        }
      }

      // STEP 3: Create assessment for this topic only if we have questions
      if (topicQuestions.length > 0) {
        // Format questions as 2D array for TakeAssessment component
        const questionsForDisplay = topicQuestions.map(q => [{
          id: q.questionId,
          text: q.text,
          options: q.options,
          answer: q.answer,
          marks: q.marks || 1
        }]);

        // Create section for this topic
        const section = {
          name: topicName,
          topic: topicName,
          subtopic: 'Based on Resume & JD',
          difficulty: difficulty,
          questions: topicQuestions
        };

        const assessment = await Assessment.create({
          title: `Resume Assessment - ${topicName}`,
          companyName: 'Resume-Based',
          assessmentType: 'resume',
          duration: 10,  // Reduced duration per topic
          totalMarks: topicQuestions.length,
          isSystemGenerated: true,
          assignedStudent: actualStudentId,
          allowedStudents: [actualStudentId],
          questions: questionsForDisplay,
          sections: [section],  // Single section per assessment
          status: 'published',
          metaData: {
            jobTitle: jobTitle,
            topicName: topicName,
            source: source
          }
        });

        createdAssessments.push({
          _id: assessment._id,
          title: assessment.title,
          topic: topicName,
          duration: assessment.duration,
          questionCount: topicQuestions.length,
          difficulty: difficulty,
          source: source
        });

        topicsProcessed.push({ name: topicName, source: source, count: topicQuestions.length });
      }
    }

    if (createdAssessments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Could not create assessments for the requested topics'
      });
    }

    res.status(201).json({
      success: true,
      assessments: createdAssessments,  // Return array of assessments
      totalAssessments: createdAssessments.length,
      topicsProcessed: topicsProcessed
    });

  } catch (error) {
    console.error('Resume assessment generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate assessment',
      error: error.message
    });
  }
};
