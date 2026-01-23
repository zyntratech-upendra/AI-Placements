const WeakAreaAnalysis = require('../models/WeakAreaAnalysis');

exports.getLearningProgress = async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get all weak area analyses for this student
    const learningPaths = await WeakAreaAnalysis.find({ student: studentId })
      .sort({ updatedAt: -1 });

    console.log(`[DEBUG] Fetching progress for User ${studentId}. Found ${learningPaths.length} paths.`);
    
    const progressData = learningPaths.map(path => {
      // Build score history with initial score as first entry
      const history = [
        { score: path.overallPercentage, date: path.analysisDate, difficulty: 'Placement', attemptNumber: 0 },
        ...(path.scoreHistory || [])
      ];
      
      const data = {
        company: path.company,
        initialScore: path.overallPercentage,
        currentScore: path.lastPracticeScore || path.overallPercentage,
        improvement: path.improvementPercentage,
        status: path.qualificationStatus, // qualified, improving, not-qualified
        attempts: path.practiceAttempts,
        difficulty: path.currentDifficulty || 'Easy',
        weakTopics: path.allWeakTopics?.slice(0, 3) || [], // Top 3 weak topics
        scoreHistory: history // Full score history for charting
      };
      console.log(`[DEBUG] Path data for ${path.company}:`, data);
      return data;
    });

    // Calculate aggregated stats
    const totalActive = learningPaths.filter(p => p.qualificationStatus !== 'qualified').length;
    const totalQualified = learningPaths.filter(p => p.qualificationStatus === 'qualified').length;
    const avgImprovement = learningPaths.reduce((acc, curr) => acc + (curr.improvementPercentage || 0), 0) / (learningPaths.length || 1);

    res.status(200).json({
      success: true,
      stats: {
        totalActive,
        totalQualified,
        avgImprovement: avgImprovement.toFixed(1)
      },
      progressData
    });

  } catch (error) {
    console.error('Error fetching learning progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch learning progress',
      error: error.message
    });
  }
};

exports.getRecommendations = async (req, res) => {
    // This endpoint was previously mock or handled differently, 
    // consolidating here if needed, but keeping existing logic in AssessmentGenerationService for now
};
