/**
 * Face Events API Routes
 * Handles face detection events and analytics storage
 */

const express = require('express');
const FaceAnalytics = require('../models/FaceAnalytics');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/face-events/:session_id
 * Store face detection events for a session
 */
router.post('/face-events/:session_id', protect, async (req, res) => {
  try {
    const { session_id } = req.params;
    const { question_id, presence, attention, emotion, anti_cheat } = req.body;
    const userId = req.user._id;

    // Find or create analytics record
    let analytics = await FaceAnalytics.findOne({
      session_id,
      candidate_id: userId,
    });

    if (!analytics) {
      analytics = new FaceAnalytics({
        session_id,
        candidate_id: userId,
      });
    }

    // Update presence logs
    if (presence) {
      if (!analytics.presence) {
        analytics.presence = {};
      }
      if (!analytics.presence.presenceLogs) {
        analytics.presence.presenceLogs = [];
      }
      analytics.presence.presenceLogs.push({
        timestamp: new Date(),
        detected: presence.detected,
        confidence: presence.confidence,
        faceCount: presence.faceCount,
      });
    }

    // Update attention logs
    if (attention) {
      if (!analytics.attention) {
        analytics.attention = {};
      }
      if (!analytics.attention.attentionLogs) {
        analytics.attention.attentionLogs = [];
      }
      analytics.attention.attentionLogs.push({
        timestamp: new Date(),
        lookingAway: attention.lookingAway,
        headRotation: attention.headRotation,
        eyeAspectRatio: attention.eyeAspectRatio,
        eyesOpen: attention.eyesOpen,
        attentionScore: attention.attentionScore,
      });
    }

    // Update emotion logs
    if (emotion && emotion.dominantEmotion) {
      if (!analytics.emotion) {
        analytics.emotion = {};
      }
      if (!analytics.emotion.emotionTimeline) {
        analytics.emotion.emotionTimeline = [];
      }
      analytics.emotion.emotionTimeline.push({
        timestamp: new Date(),
        emotion: emotion.dominantEmotion,
        confidence: emotion.dominantEmotionScore,
        confidenceIndicator: emotion.confidenceIndicator,
      });
    }

    // Update anti-cheat alerts
    if (anti_cheat && anti_cheat.alerts && anti_cheat.alerts.length > 0) {
      if (!analytics.antiCheat) {
        analytics.antiCheat = {};
      }
      if (!analytics.antiCheat.incidents) {
        analytics.antiCheat.incidents = [];
      }
      
      anti_cheat.alerts.forEach(alert => {
        analytics.antiCheat.incidents.push({
          timestamp: new Date(),
          type: alert.type,
          severity: alert.severity,
          description: alert.message,
        });
      });

      // Update risk level
      analytics.antiCheat.cheatingRiskLevel = anti_cheat.riskLevel;
      analytics.antiCheat.multipleFacesDetected = anti_cheat.faceCount > 1 ? 
        (analytics.antiCheat.multipleFacesDetected || 0) + 1 : 
        (analytics.antiCheat.multipleFacesDetected || 0);
    }

    analytics.updated_at = new Date();
    await analytics.save();

    res.json({
      success: true,
      message: 'Face events recorded',
      data: analytics,
    });
  } catch (error) {
    console.error('Error storing face events:', error);
    res.status(500).json({
      success: false,
      message: 'Error storing face events',
      error: error.message,
    });
  }
});

/**
 * GET /api/face-analytics/:session_id
 * Retrieve face analytics for a session
 */
router.get('/face-analytics/:session_id', protect, async (req, res) => {
  try {
    const { session_id } = req.params;
    const userId = req.user._id;

    const analytics = await FaceAnalytics.findOne({
      session_id,
      candidate_id: userId,
    });

    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: 'Analytics not found',
      });
    }

    // Calculate summary statistics
    const summary = calculateSummary(analytics);

    res.json({
      success: true,
      data: {
        ...analytics.toObject(),
        summary,
      },
    });
  } catch (error) {
    console.error('Error retrieving face analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving analytics',
      error: error.message,
    });
  }
});

/**
 * POST /api/face-analytics/:session_id/finalize
 * Finalize and calculate final analytics for a session
 */
router.post('/face-analytics/:session_id/finalize', protect, async (req, res) => {
  try {
    const { session_id } = req.params;
    const userId = req.user._id;

    const analytics = await FaceAnalytics.findOne({
      session_id,
      candidate_id: userId,
    });

    if (!analytics) {
      return res.status(404).json({
        success: false,
        message: 'Analytics not found',
      });
    }

    // Calculate final statistics
    const summary = calculateSummary(analytics);
    analytics.summary = summary;
    await analytics.save();

    res.json({
      success: true,
      message: 'Analytics finalized',
      data: {
        ...analytics.toObject(),
        summary,
      },
    });
  } catch (error) {
    console.error('Error finalizing analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error finalizing analytics',
      error: error.message,
    });
  }
});

/**
 * Helper function to calculate summary statistics
 */
function calculateSummary(analytics) {
  const summary = {};

  // Presence percentage
  if (analytics.presence && analytics.presence.presenceLogs) {
    const detected = analytics.presence.presenceLogs.filter(p => p.detected).length;
    summary.presencePercentage = (detected / Math.max(1, analytics.presence.presenceLogs.length)) * 100;
  }

  // Attention score
  if (analytics.attention && analytics.attention.attentionLogs) {
    const scores = analytics.attention.attentionLogs.map(a => a.attentionScore);
    summary.attentionScore = scores.length > 0 ? 
      (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;
  }

  // Emotional consistency
  if (analytics.emotion && analytics.emotion.emotionTimeline) {
    const emotions = analytics.emotion.emotionTimeline;
    const emotionCounts = {};
    emotions.forEach(e => {
      emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + 1;
    });
    
    // Higher consistency if one emotion dominates
    const max = Math.max(...Object.values(emotionCounts));
    summary.emotionalConsistency = (max / Math.max(1, emotions.length)) * 100;
  }

  // Overall suspicion score based on anti-cheat incidents
  summary.overallSuspicionScore = 0;
  if (analytics.antiCheat) {
    if (analytics.antiCheat.incidents && analytics.antiCheat.incidents.length > 0) {
      const criticalIncidents = analytics.antiCheat.incidents.filter(i => i.severity === 'CRITICAL').length;
      const highIncidents = analytics.antiCheat.incidents.filter(i => i.severity === 'HIGH').length;
      summary.overallSuspicionScore = (criticalIncidents * 30) + (highIncidents * 15);
      summary.overallSuspicionScore = Math.min(100, summary.overallSuspicionScore);
    }
  }

  return summary;
}

module.exports = router;
