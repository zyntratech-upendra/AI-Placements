const WeakAreaAnalysis = require('../models/WeakAreaAnalysis');
const Assessment = require('../models/Assessment');
const ParsedQuestion = require('../models/ParsedQuestion');
const StudentLearningPath = require('../models/StudentLearningPath');
const axios = require('axios');

/**
 * AssessmentGenerationService
 * Generates targeted practice assessments based on weak areas
 * Uses RAG to find similar questions for better practice recommendations
 */
class AssessmentGenerationService {
  
  // Configuration
  static CONFIG = {
    questionsPerWeakArea: 5,
    minQuestionsPerAssessment: 5,
    maxQuestionsPerAssessment: 20,
    ragServiceUrl: process.env.RAG_SERVICE_URL || 'http://localhost:8000/api'
  };

  /**
   * Generate a targeted assessment based on student's weak areas
   * Creates per-topic assessments and avoids repeating questions
   * @param {string} studentId - Student's user ID
   * @param {string} company - Company name
   * @param {string} topic - Optional specific topic to target
   * @returns {Object} Generated assessment
   */
  static async generateTargetedAssessment(studentId, company, topic = null) {
    try {
      // Get latest weak area analysis (including 'improving' status)
      const weakAreaAnalysis = await WeakAreaAnalysis.findOne({
        student: studentId,
        company: company,
        qualificationStatus: 'active'
      }).sort({ createdAt: -1 });

      if (!weakAreaAnalysis) {
        throw new Error('No weak area analysis found for student');
      }

      // Get weak sections
      let weakSections = weakAreaAnalysis.sections.filter(
        s => s.status === 'weak' || s.status === 'average'
      );

      if (weakSections.length === 0) {
        throw new Error('No weak areas to target');
      }

      // Group sections by topic
      const topicGroups = {};
      for (const section of weakSections) {
        const topicKey = section.topic || 'General';
        if (!topicGroups[topicKey]) {
          topicGroups[topicKey] = [];
        }
        topicGroups[topicKey].push(section);
      }

      // If specific topic requested, use it; otherwise pick the weakest topic
      let targetTopic = topic;
      if (!targetTopic) {
        // Pick topic with lowest average score
        let lowestAvg = 100;
        for (const [topicName, sections] of Object.entries(topicGroups)) {
          const avg = sections.reduce((sum, s) => sum + s.percentage, 0) / sections.length;
          if (avg < lowestAvg) {
            lowestAvg = avg;
            targetTopic = topicName;
          }
        }
      }

      const targetSections = topicGroups[targetTopic] || weakSections;
      
      // Get already attempted question IDs
      const attemptedIds = new Set(weakAreaAnalysis.attemptedQuestionIds || []);
      console.log(`[DEBUG] Excluding ${attemptedIds.size} already-attempted questions`);

      // Collect questions for target topic, excluding attempted ones
      const allQuestions = [];
      
      for (const section of targetSections) {
        let dbQuestions = [];
        
        // Handle Resume-Based assessments differently
        if (company === 'Resume-Based') {
          // DIRECTLY USE LLM for Resume-Based (User Request)
          console.log(`[INFO] Generating questions via LLM for topic: ${section.topic}`);
          try {
            const llmQuestions = await this.generateQuestionsViaLLM(
              section.topic, 
              this.CONFIG.questionsPerWeakArea, 
              weakAreaAnalysis.currentDifficulty || section.difficulty
            );
            if (llmQuestions.length > 0) {
                dbQuestions = llmQuestions;
            } else {
                console.warn(`[WARN] LLM returned 0 questions for ${section.topic}`);
            }
          } catch (llmError) {
            console.error(`[ERROR] LLM generation failed for ${section.topic}:`, llmError.message);
          }

        } else {
          // Standard company-based lookup
          dbQuestions = await this.getQuestionsFromDB(
            company,
            section.topic,
            section.subtopic,
            weakAreaAnalysis.currentDifficulty || section.difficulty
          );
        }
        
        // Filter out already attempted questions
        const newQuestions = dbQuestions.filter(q => {
          const qId = q.questionId || q.id || q._id?.toString();
          return !attemptedIds.has(qId);
        });
        
        allQuestions.push(...newQuestions.slice(0, this.CONFIG.questionsPerWeakArea));
      }

      if (allQuestions.length < this.CONFIG.minQuestionsPerAssessment) {
        // If not enough new questions, allow some repeats
        console.warn(`[WARN] Only ${allQuestions.length} new questions. Falling back to reusing questions.`);
        
        // If completely empty, try harder to find/generate questions
        if (allQuestions.length === 0) {
           for (const section of targetSections) {
            let dbQuestions = [];
            
            if (company === 'Resume-Based') {
               // Try generating again via LLM (maybe it failed momentarily)
               console.log(`[RETRY] Generating questions via LLM for topic: ${section.topic}`);
               try {
                 const llmQuestions = await this.generateQuestionsViaLLM(
                   section.topic, 
                   this.CONFIG.questionsPerWeakArea, 
                   weakAreaAnalysis.currentDifficulty || section.difficulty
                 );
                 if (llmQuestions.length > 0) {
                    dbQuestions = llmQuestions;
                 }
               } catch (e) {
                 console.error('[RETRY FAILED] LLM generation failed:', e.message);
               }
            } else {
              // Standard DB fallback for other companies
              dbQuestions = await this.getQuestionsFromDB(company, section.topic, section.subtopic, 'Medium');
            }
            
            // Add ALL questions
            allQuestions.push(...dbQuestions.slice(0, this.CONFIG.questionsPerWeakArea));
          }
        }
        
        if (allQuestions.length === 0) {
          throw new Error('No questions could be generated/found for these topics.');
        }
      }

      // Limit total questions
      const selectedQuestions = allQuestions.slice(0, this.CONFIG.maxQuestionsPerAssessment);

      console.log(`[DEBUG] Creating assessment for topic: ${targetTopic} with ${selectedQuestions.length} questions`);

      // Get subtopic from first section if available
      const targetSubtopic = targetSections[0]?.subtopic || 'Practice';
      
      // Calculate attempt number for this topic
      const attemptNumber = (weakAreaAnalysis.generatedAssessmentIds?.length || 0) + 1;

      // Create the assessment with detailed naming: Topic-Subtopic-#N
      const assessment = await Assessment.create({
        title: `${targetTopic} - ${targetSubtopic} #${attemptNumber}`,
        companyName: company,
        assessmentType: 'practice',
        duration: selectedQuestions.length * 2,
        totalMarks: selectedQuestions.length,
        isSystemGenerated: true,
        assignedStudent: studentId,
        allowedStudents: [studentId],
        sections: [{
          topic: targetTopic,
          subtopic: 'Targeted Practice',
          difficulty: weakAreaAnalysis.currentDifficulty || 'Mixed',
          questions: selectedQuestions.map(q => ({
            questionId: q.questionId || q.id,
            questionText: q.text || q.questionText,
            options: q.options || [],
            answer: q.answer || q.correctAnswer,
            marks: 1
          }))
        }]
      });

      // Track attempted question IDs
      const newQuestionIds = selectedQuestions.map(q => q.questionId || q.id || q._id?.toString());
      weakAreaAnalysis.attemptedQuestionIds = [
        ...(weakAreaAnalysis.attemptedQuestionIds || []),
        ...newQuestionIds
      ];
      
      // Update weak area analysis
      weakAreaAnalysis.assessmentsGenerated = true;
      weakAreaAnalysis.generatedAssessmentIds.push(assessment._id);
      await weakAreaAnalysis.save();

      // Update learning path
      await StudentLearningPath.findOneAndUpdate(
        { student: studentId, company: company },
        { 
          $push: { activeAssessments: assessment._id },
          $set: { retakeEligible: false }
        }
      );

      return assessment;

    } catch (error) {
      console.error('Error generating targeted assessment:', error);
      throw error;
    }
  }

  /**
   * Find similar questions using RAG service
   */
  static async findSimilarQuestionsRAG(topic, subtopic, company) {
    try {
      const query = `${topic} ${subtopic} problems questions`;
      
      const response = await axios.post(
        `${this.CONFIG.ragServiceUrl}/rag/find-similar`,
        {
          query: query,
          n_results: 10,
          topic_filter: topic,
          company_filter: company
        },
        { timeout: 10000 }
      );

      if (response.data.success && response.data.similar_questions) {
        return response.data.similar_questions.map(sq => ({
          questionId: sq.id,
          text: sq.metadata.question_text || sq.document.split('\n')[0].replace('Question: ', ''),
          options: [], // Will need to fetch from DB
          answer: sq.metadata.answer,
          topic: sq.metadata.topic,
          subtopic: sq.metadata.subtopic,
          difficulty: sq.metadata.difficulty
        }));
      }
      
      return [];
    } catch (error) {
      console.error('RAG service error, falling back to DB:', error.message);
      return [];
    }
  }

  /**
   * Generate questions via LLM (Interview Service)
   */
  static async generateQuestionsViaLLM(topic, count, difficulty) {
    try {
      // Use interview service which has the LLM logic
      const INTERVIEW_SERVICE_URL = process.env.INTERVIEW_SERVICE_URL || 'http://localhost:8000';
      const response = await axios.post(
        `${INTERVIEW_SERVICE_URL}/api/resume-assessment/generate-questions`,
        new URLSearchParams({
          topics: topic,
          question_count: count,
          difficulty: difficulty
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (response.data.success && response.data.questions) {
        return response.data.questions.map((q, idx) => ({
          questionId: q.questionId || `llm-${Date.now()}-${idx}`,
          text: q.text,
          options: q.options,
          answer: q.answer,
          topic: topic,
          difficulty: difficulty,
          source: 'llm_generated'
        }));
      }
      return [];
    } catch (error) {
      console.error('LLM question generation error details:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get questions directly from database (fallback)
   */
  static async getQuestionsFromDB(company, topic, subtopic, difficulty) {
    try {
      const parsedDoc = await ParsedQuestion.findOne({
        company: company,
        topic: topic,
        subfolder: subtopic
      });

      if (!parsedDoc || !parsedDoc.questionsByDifficulty) {
        return [];
      }

      // Get questions from the difficulty level
      const rawQuestions = parsedDoc.questionsByDifficulty[difficulty] || 
                       parsedDoc.questionsByDifficulty['Medium'] || 
                       [];

      // Format questions with STABLE ID based on text hash (for dedup)
      const formattedQuestions = rawQuestions.slice(0, 10).map((q, idx) => {
        // Create stable ID from question text (simple hash)
        const text = q.text || q.questionText || '';
        const stableId = q.questionId || `q-${Buffer.from(text.substring(0, 50)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;
        
        return {
          questionId: stableId,
          text: text,
          options: q.options || [],
          answer: q.answer || q.correctAnswer,
          topic: topic,
          subtopic: subtopic,
          difficulty: difficulty
        };
      });

      console.log(`[DEBUG] Fetched ${formattedQuestions.length} questions, sample ID: ${formattedQuestions[0]?.questionId}`);

      return formattedQuestions;
    } catch (error) {
      console.error('DB query error:', error);
      return [];
    }
  }

  /**
   * Get recommended assessments for a student
   * Returns both: areas needing assessment AND active targeted assessments
   */
  static async getRecommendedAssessments(studentId) {
    try {
      // Get all weak area analyses where student is not qualified
      const analyses = await WeakAreaAnalysis.find({
        student: studentId,
        qualificationStatus: 'active'  // Only show active (not qualified) items
      }).sort({ createdAt: -1 });

      const recommendations = [];
      const seenCompanies = new Set();

      for (const analysis of analyses) {
        // Check if there's an active targeted assessment
        let hasActiveAssessment = false;
        let activeAssessmentId = null;
        if (analysis.assessmentsGenerated && analysis.generatedAssessmentIds?.length > 0) {
          const Attempt = require('../models/Attempt');
          const lastAssessmentId = analysis.generatedAssessmentIds[analysis.generatedAssessmentIds.length - 1];
          const completedAttempt = await Attempt.findOne({
            assessment: lastAssessmentId,
            student: studentId,
            status: 'submitted'
          });
          hasActiveAssessment = !completedAttempt;
          activeAssessmentId = hasActiveAssessment ? lastAssessmentId : null;
        }

        // Create one recommendation per weak TOPIC (not per company)
        const weakSections = analysis.sections.filter(s => s.status === 'weak' || s.status === 'average');
        
        // Group by topic
        const topicMap = {};
        for (const section of weakSections) {
          const topicName = section.topic || 'General';
          if (!topicMap[topicName]) {
            topicMap[topicName] = {
              sections: [],
              totalScore: 0,
              count: 0
            };
          }
          topicMap[topicName].sections.push(section);
          topicMap[topicName].totalScore += section.percentage;
          topicMap[topicName].count += 1;
        }

        // Create a recommendation for each topic
        for (const [topicName, topicData] of Object.entries(topicMap)) {
          const avgScore = Math.round(topicData.totalScore / topicData.count);
          
          // Get aggregated stats from sections
          // If multiple sections have same topic (rare), average them or take max
          const sectionLastPracticeScore = Math.max(...topicData.sections.map(s => s.lastPracticeScore || 0));
          const sectionImprovement = Math.max(...topicData.sections.map(s => s.improvementPercentage || 0));
          const currentDifficulty = topicData.sections[0]?.difficulty || 'Easy';

          recommendations.push({
            company: analysis.company,
            topic: topicName,  // <-- NEW: Topic name for this recommendation
            subtopics: topicData.sections.map(s => s.subtopic).filter(Boolean),
            displayName: `${topicName} - ${analysis.company}`,  // <-- For display
            weakAreasCount: topicData.count,
            overallPercentage: avgScore,
            lastPracticeScore: sectionLastPracticeScore,
            improvementPercentage: sectionImprovement,
            difficulty: currentDifficulty, // Use per-topic difficulty
            
            // Check if assessment can be generated (if weak/avg)
            canGenerateAssessment: true,
            
            // Check active assessment specifically for this topic
            hasActiveAssessment: hasActiveAssessment && (!activeAssessmentId || true), // Simplified logic
            activeAssessmentId: activeAssessmentId // This might need refinement if we want per-topic active IDs
          });
        }
      }

      return recommendations;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return [];
    }
  }

  /**
   * Get active targeted assessments for a student
   */
  static async getActiveAssessments(studentId) {
    try {
      const assessments = await Assessment.find({
        assignedStudent: studentId,
        isSystemGenerated: true,
        assessmentType: 'practice'
      }).sort({ createdAt: -1 });

      return assessments;
    } catch (error) {
      console.error('Error getting active assessments:', error);
      return [];
    }
  }

  /**
   * Get targeted assessments grouped by source placement exam
   * Returns: [{sourceExam: {...}, generatedAssessments: [...]}, ...]
   */
  static async getTargetedAssessmentsGroupedByExam(studentId) {
    try {
      const Attempt = require('../models/Attempt');
      
      // Get all weak area analyses for this student
      const weakAreas = await WeakAreaAnalysis.find({
        student: studentId
      }).sort({ analysisDate: -1 });

      const grouped = [];

      for (const weakArea of weakAreas) {
        if (!weakArea.generatedAssessmentIds || weakArea.generatedAssessmentIds.length === 0) {
          continue; // Skip if no targeted assessments generated
        }

        // Get the source placement exam
        const sourceExam = await Assessment.findById(weakArea.assessmentId).select(
          '_id title companyName duration totalMarks'
        );

        if (!sourceExam) {
          continue;
        }

        // Get all targeted assessments for this weak area
        const targetedAssessments = await Assessment.find({
          _id: { $in: weakArea.generatedAssessmentIds }
        }).select('_id title duration totalMarks createdAt');

        // Get attempt status for each targeted assessment
        const assessmentsWithStatus = await Promise.all(
          targetedAssessments.map(async (ta) => {
            const attempt = await Attempt.findOne({
              assessment: ta._id,
              student: studentId
            }).select('status percentage');

            return {
              _id: ta._id,
              title: ta.title,
              duration: ta.duration,
              totalMarks: ta.totalMarks,
              createdAt: ta.createdAt,
              status: attempt?.status || 'pending', // pending, in-progress, submitted
              percentage: attempt?.percentage || 0
            };
          })
        );

        grouped.push({
          sourceExam: {
            _id: sourceExam._id,
            title: sourceExam.title,
            companyName: sourceExam.companyName,
            duration: sourceExam.duration,
            totalMarks: sourceExam.totalMarks,
            analysisDate: weakArea.analysisDate,
            company: weakArea.company
          },
          generatedAssessments: assessmentsWithStatus,
          totalGenerated: assessmentsWithStatus.length,
          totalCompleted: assessmentsWithStatus.filter(a => a.status === 'submitted').length,
          avgScore: assessmentsWithStatus.filter(a => a.status === 'submitted').length > 0
            ? Math.round(
                assessmentsWithStatus
                  .filter(a => a.status === 'submitted')
                  .reduce((sum, a) => sum + a.percentage, 0) /
                  assessmentsWithStatus.filter(a => a.status === 'submitted').length
              )
            : 0
        });
      }

      return grouped;
    } catch (error) {
      console.error('Error getting grouped targeted assessments:', error);
      return [];
    }
  }
}

module.exports = AssessmentGenerationService;
