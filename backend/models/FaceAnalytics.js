/**
 * FaceAnalytics Model
 * Stores face detection events and analytics for interviews
 */

const mongoose = require('mongoose');

const faceAnalyticsSchema = new mongoose.Schema(
  {
    session_id: {
      type: String,
      required: true,
      index: true,
    },
    candidate_id: {
      type: String,
      required: true,
      index: true,
    },
    interview_id: {
      type: String,
      index: true,
    },

    // Presence Data
    presence: {
      totalTimeDetected: Number,
      totalTimeNotDetected: Number,
      presencePercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      presenceLogs: [
        {
          timestamp: Date,
          detected: Boolean,
          confidence: Number,
          faceCount: Number,
        },
      ],
    },

    // Attention Data
    attention: {
      totalCheckCount: Number,
      lookingAwayCount: Number,
      lookingAwayPercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      averageHeadRotation: Number,
      attentionScore: {
        type: Number,
        min: 0,
        max: 100,
      },
      attentionLogs: [
        {
          timestamp: Date,
          lookingAway: Boolean,
          headRotation: {
            yaw: Number,
            pitch: Number,
            roll: Number,
          },
          eyeAspectRatio: Number,
          eyesOpen: Boolean,
          attentionScore: Number,
        },
      ],
    },

    // Identity Verification Data
    identity: {
      verified: Boolean,
      faceMatchScore: {
        type: Number,
        min: 0,
        max: 1,
      },
      verificationAttempts: Number,
      identityAlerts: [
        {
          timestamp: Date,
          alert: String,
          severity: String,
        },
      ],
    },

    // Emotion Data
    emotion: {
      dominantEmotions: {
        neutral: Number,
        happy: Number,
        sad: Number,
        angry: Number,
        fearful: Number,
        disgusted: Number,
        surprised: Number,
      },
      emotionTimeline: [
        {
          timestamp: Date,
          emotion: String,
          confidence: Number,
          confidenceIndicator: String,
        },
      ],
      overallConfidenceScore: {
        type: Number,
        min: 0,
        max: 100,
      },
    },

    // Anti-Cheat Data
    antiCheat: {
      multipleFacesDetected: Number,
      phonesDetected: Number,
      backgroundPeopleDetected: Number,
      cheatingRiskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'LOW',
      },
      incidents: [
        {
          timestamp: Date,
          type: String,
          severity: String,
          description: String,
        },
      ],
    },

    // Summary Statistics
    summary: {
      totalDuration: Number, // in seconds
      presencePercentage: Number,
      attentionScore: Number,
      emotionalConsistency: Number,
      overallSuspicionScore: Number,
    },

    created_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'face_analytics',
  }
);

// Index for efficient querying
faceAnalyticsSchema.index({ session_id: 1, candidate_id: 1 });
faceAnalyticsSchema.index({ created_at: -1 });

module.exports = mongoose.model('FaceAnalytics', faceAnalyticsSchema);
