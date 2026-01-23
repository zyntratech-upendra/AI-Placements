const WeakAreaAnalysis = require('../models/WeakAreaAnalysis');
const StudentLearningPath = require('../models/StudentLearningPath');
const Assessment = require('../models/Assessment');
const Attempt = require('../models/Attempt');

/**
 * WeakAreaAnalysisService
 * Analyzes placement exam results and identifies weak areas
 * Calculates section-wise performance and determines qualification status
 */
class WeakAreaAnalysisService {
  
  // Configuration thresholds
  static CONFIG = {
    qualificationThreshold: 60,  // % needed to qualify
    weakThreshold: 50,           // Below this = weak
    averageThreshold: 70,        // 50-70% = average, above = strong
    minImprovementForRetake: 15  // % improvement needed to allow retake
  };

  /**
   * Analyze a placement exam attempt and identify weak areas
   * @param {Object} attempt - The completed attempt with answers
   * @param {Object} assessment - The assessment with sections
   * @returns {Object} WeakAreaAnalysis document
   */
  static async analyzeAttempt(attemptId) {
    const attempt = await Attempt.findById(attemptId)
      .populate('assessment')
      .populate('student', 'name email');
    
    if (!attempt) {
      throw new Error('Attempt not found');
    }

    const assessment = attempt.assessment;
    
    // Allow placement and resume assessments for weak area analysis
    const allowedTypes = ['placement', 'resume'];
    if (!assessment || !allowedTypes.includes(assessment.assessmentType)) {
      throw new Error(`Not a valid assessment type for weak area analysis. Got: ${assessment?.assessmentType}`);
    }

    // Calculate section-wise performance
    const sectionAnalysis = this.analyzeSections(assessment.sections, attempt.answers);
    
    // Calculate overall performance
    const overallStats = this.calculateOverallStats(sectionAnalysis);
    
    // Determine qualification status
    const qualificationStatus = overallStats.percentage >= this.CONFIG.qualificationThreshold
      ? 'qualified' 
      : 'active';

    // Identify weak sections and topics
    const weakSections = sectionAnalysis
      .filter(s => s.status === 'weak')
      .map(s => `${s.topic} - ${s.subtopic}`);
    
    const allWeakTopics = sectionAnalysis
      .filter(s => s.status === 'weak' || s.status === 'average')
      .map(s => s.topic);

    // Get or update learning path
    const learningPath = await this.getOrCreateLearningPath(
      attempt.student._id,
      assessment.companyName
    );

    // Determine cycle number
    const cycleNumber = learningPath.currentCycle;

    // Create weak area analysis record
    const analysis = await WeakAreaAnalysis.create({
      student: attempt.student._id,
      company: assessment.companyName,
      attemptId: attempt._id,
      assessmentId: assessment._id,
      overallScore: overallStats.score,
      overallPercentage: overallStats.percentage,
      totalQuestions: overallStats.totalQuestions,
      qualificationStatus,
      sections: sectionAnalysis,
      weakSections,
      allWeakTopics: [...new Set(allWeakTopics)], // Deduplicate
      cycleNumber
    });

    // Update learning path
    await this.updateLearningPath(
      learningPath,
      attempt,
      overallStats,
      qualificationStatus
    );

    return analysis;
  }

  /**
   * Analyze each section's performance
   */
  static analyzeSections(sections, answers) {
    return sections.map(section => {
      const sectionQuestions = section.questions || [];
      let correctCount = 0;
      const weakTopics = [];
      
      sectionQuestions.forEach(question => {
        const userAnswer = answers.find(
          a => String(a.questionId) === String(question.questionId)
        );
        
        if (userAnswer && userAnswer.selectedAnswer === question.answer) {
          correctCount++;
        }
      });

      const totalQuestions = sectionQuestions.length;
      const percentage = totalQuestions > 0 
        ? Math.round((correctCount / totalQuestions) * 100) 
        : 0;

      // Determine status
      let status;
      if (percentage < this.CONFIG.weakThreshold) {
        status = 'weak';
      } else if (percentage < this.CONFIG.averageThreshold) {
        status = 'average';
      } else {
        status = 'strong';
      }

      return {
        sectionName: `${section.topic} - ${section.subtopic}`,
        topic: section.topic,
        subtopic: section.subtopic,
        difficulty: section.difficulty,
        score: correctCount,
        totalQuestions,
        percentage,
        status,
        weakTopics: status === 'weak' ? [section.topic] : []
      };
    });
  }

  /**
   * Calculate overall statistics from section analysis
   */
  static calculateOverallStats(sectionAnalysis) {
    const totalScore = sectionAnalysis.reduce((sum, s) => sum + s.score, 0);
    const totalQuestions = sectionAnalysis.reduce((sum, s) => sum + s.totalQuestions, 0);
    const percentage = totalQuestions > 0 
      ? Math.round((totalScore / totalQuestions) * 100) 
      : 0;

    return { score: totalScore, totalQuestions, percentage };
  }

  /**
   * Get or create learning path for student
   */
  static async getOrCreateLearningPath(studentId, company) {
    let learningPath = await StudentLearningPath.findOne({
      student: studentId,
      company
    });

    if (!learningPath) {
      learningPath = await StudentLearningPath.create({
        student: studentId,
        company,
        currentCycle: 1,
        learningProgressHistory: []
      });
    }

    return learningPath;
  }

  /**
   * Update learning path after analysis
   */
  static async updateLearningPath(learningPath, attempt, overallStats, qualificationStatus) {
    const isFirstAttempt = !learningPath.baseline.attemptId;
    
    if (isFirstAttempt) {
      // Set baseline
      learningPath.baseline = {
        attemptId: attempt._id,
        score: overallStats.score,
        percentage: overallStats.percentage,
        date: new Date()
      };
    }

    // Update current best if this is better
    if (!learningPath.currentBest.percentage || 
        overallStats.percentage > learningPath.currentBest.percentage) {
      learningPath.currentBest = {
        attemptId: attempt._id,
        score: overallStats.score,
        percentage: overallStats.percentage,
        date: new Date()
      };
    }

    // Calculate improvement from baseline
    const improvement = learningPath.baseline.percentage 
      ? overallStats.percentage - learningPath.baseline.percentage 
      : 0;

    // Add to progress history
    learningPath.learningProgressHistory.push({
      cycleNumber: learningPath.currentCycle,
      attemptId: attempt._id,
      score: overallStats.score,
      percentage: overallStats.percentage,
      improvement,
      timestamp: new Date()
    });

    // Update total improvement
    learningPath.totalImprovement = improvement;

    // Check qualification
    if (qualificationStatus === 'qualified' && !learningPath.qualificationAchieved) {
      learningPath.qualificationAchieved = true;
      learningPath.qualificationDate = new Date();
      learningPath.qualificationAttemptId = attempt._id;
      learningPath.status = 'qualified';
    }

    // Check if eligible for retake
    if (improvement >= this.CONFIG.minImprovementForRetake) {
      learningPath.retakeEligible = true;
    }

    await learningPath.save();
    return learningPath;
  }

  /**
   * Get weak area analysis for a student
   */
  static async getStudentWeakAreas(studentId, company) {
    return WeakAreaAnalysis.find({
      student: studentId,
      company
    })
    .sort({ createdAt: -1 })
    .limit(5);
  }

  /**
   * Get latest weak area analysis for a student
   */
  static async getLatestAnalysis(studentId, company) {
    return WeakAreaAnalysis.findOne({
      student: studentId,
      company
    })
    .sort({ createdAt: -1 });
  }

  /**
   * Get learning path for a student
   */
  static async getLearningPath(studentId, company) {
    return StudentLearningPath.findOne({
      student: studentId,
      company
    });
  }

  /**
   * Get all students who need targeted assessments
   */
  static async getStudentsNeedingAssessments() {
    return WeakAreaAnalysis.find({
      qualificationStatus: 'active',
      assessmentsGenerated: false
    })
    .populate('student', 'name email')
    .sort({ createdAt: -1 });
  }
}

module.exports = WeakAreaAnalysisService;
