/**
 * FaceDetectionService - Comprehensive face detection and analysis service
 * Supports: Presence Detection, Attention Tracking, Emotion Analysis, Identity Verification
 * 
 * NOTE: This service assumes face-api.js is loaded from CDN in the HTML
 * Add this to your index.html before the app:
 * <script async src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js"></script>
 */

export class FaceDetectionService {
  constructor() {
    this.modelsLoaded = false;
    this.detectionRunning = false;
    this.detectionInterval = null;
    this.logs = {
      presence: [],
      attention: [],
      emotion: [],
      antiCheat: []
    };
    this.thresholds = {
      faceConfidence: 0.7,
      lookingAwayAngle: 45, // degrees
      lookingAwayDuration: 10, // seconds
      multipleTracesThreshold: 2,
      attentionCheckInterval: 500, // ms
    };
  }

  /**
   * Initialize and load all required models
   */
  async loadModels() {
    if (this.modelsLoaded) return;

    try {
      // Check if face-api is available globally
      if (typeof window.faceapi === 'undefined') {
        throw new Error('face-api.js not loaded. Add CDN script to index.html');
      }

      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      this.modelsLoaded = true;
      console.log('✅ Face detection models loaded successfully');
    } catch (error) {
      console.error('❌ Error loading face detection models:', error);
      throw error;
    }
  }

  /**
   * PHASE 1: Candidate Presence Detection
   */
  async detectPresence(videoElement) {
    try {
      const detections = await window.faceapi
        .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      const presenceData = {
        timestamp: new Date(),
        detected: detections.length > 0,
        confidence: detections.length > 0 ? detections[0].detection.score : 0,
        faceCount: detections.length,
      };

      this.logs.presence.push(presenceData);
      return presenceData;
    } catch (error) {
      console.error('Error detecting presence:', error);
      return { detected: false, confidence: 0, faceCount: 0, error: true };
    }
  }

  /**
   * PHASE 2: Attention & Focus Tracking
   * Detects: Eye gaze, head rotation, looking away
   */
  async detectAttention(videoElement) {
    try {
      const detections = await window.faceapi
        .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detections.length === 0) {
        return { lookingAway: true, headRotation: null, attentionScore: 0 };
      }

      const detection = detections[0];
      const landmarks = detection.landmarks;

      // Calculate head rotation using landmarks
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const nose = landmarks.getNose();

      // Head pose estimation using landmarks
      const headRotation = this.calculateHeadRotation(leftEye, rightEye, nose);

      // Eye aspect ratio to detect if looking away
      const eyeAspectRatio = this.calculateEyeAspectRatio(leftEye, rightEye);
      
      // Determine if looking away based on rotation angle
      const isLookingAway = Math.abs(headRotation.yaw) > this.thresholds.lookingAwayAngle;

      const attentionData = {
        timestamp: new Date(),
        lookingAway: isLookingAway,
        headRotation: {
          yaw: parseFloat(headRotation.yaw.toFixed(2)),      // Left/Right
          pitch: parseFloat(headRotation.pitch.toFixed(2)),    // Up/Down
          roll: parseFloat(headRotation.roll.toFixed(2)),      // Tilt
        },
        eyeAspectRatio: parseFloat(eyeAspectRatio.toFixed(2)),
        eyesOpen: eyeAspectRatio > 0.2,
        attentionScore: this.calculateAttentionScore(isLookingAway, headRotation),
      };

      this.logs.attention.push(attentionData);
      return attentionData;
    } catch (error) {
      console.error('Error detecting attention:', error);
      return { lookingAway: false, error: true };
    }
  }

  /**
   * PHASE 3: Identity Verification
   * Compares live face with profile photo
   */
  async verifyIdentity(videoElement, profilePhotoElement) {
    try {
      // Get live face descriptor
      const liveDetections = await window.faceapi
        .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (liveDetections.length === 0) {
        return { verified: false, matchScore: 0, reason: 'No face detected' };
      }

      const liveDescriptor = liveDetections[0].descriptor;

      // Get profile photo face descriptor
      const profileDetections = await window.faceapi
        .detectAllFaces(profilePhotoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (profileDetections.length === 0) {
        return { verified: false, matchScore: 0, reason: 'No face in profile photo' };
      }

      const profileDescriptor = profileDetections[0].descriptor;

      // Calculate Euclidean distance (lower = more similar)
      const distance = this.euclideanDistance(liveDescriptor, profileDescriptor);
      const matchScore = Math.max(0, 1 - distance / 0.6); // Normalize to 0-1

      const verificationData = {
        timestamp: new Date(),
        verified: matchScore > 0.6,
        matchScore: parseFloat(matchScore.toFixed(2)),
        distance: parseFloat(distance.toFixed(3)),
        threshold: 0.6,
      };

      return verificationData;
    } catch (error) {
      console.error('Error verifying identity:', error);
      return { verified: false, error: true };
    }
  }

  /**
   * PHASE 4: Emotion & Confidence Analysis
   */
  async detectEmotion(videoElement) {
    try {
      const detections = await window.faceapi
        .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detections.length === 0) {
        return { emotions: null, dominantEmotion: null };
      }

      const expressions = detections[0].expressions;
      
      // Get dominant emotion
      const dominantEmotion = Object.entries(expressions).reduce((prev, current) =>
        prev[1] > current[1] ? prev : current
      );

      const emotionData = {
        timestamp: new Date(),
        emotions: {
          neutral: parseFloat(expressions.neutral.toFixed(2)),
          happy: parseFloat(expressions.happy.toFixed(2)),
          sad: parseFloat(expressions.sad.toFixed(2)),
          angry: parseFloat(expressions.angry.toFixed(2)),
          fearful: parseFloat(expressions.fearful.toFixed(2)),
          disgusted: parseFloat(expressions.disgusted.toFixed(2)),
          surprised: parseFloat(expressions.surprised.toFixed(2)),
        },
        dominantEmotion: dominantEmotion[0],
        dominantEmotionScore: parseFloat(dominantEmotion[1].toFixed(2)),
        confidenceIndicator: this.mapEmotionToConfidence(dominantEmotion[0]),
      };

      this.logs.emotion.push(emotionData);
      return emotionData;
    } catch (error) {
      console.error('Error detecting emotion:', error);
      return { emotions: null, error: true };
    }
  }

  /**
   * PHASE 5: Anti-Cheating Features
   */
  async detectCheatingIndicators(videoElement) {
    try {
      const detections = await window.faceapi
        .detectAllFaces(videoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      const antiCheatData = {
        timestamp: new Date(),
        multipleFaces: detections.length > 1,
        faceCount: detections.length,
        alerts: [],
        riskLevel: 'LOW',
      };

      // Alert for multiple faces
      if (detections.length > 1) {
        antiCheatData.alerts.push({
          type: 'MULTIPLE_FACES',
          severity: 'HIGH',
          message: `${detections.length} faces detected`,
        });
        antiCheatData.riskLevel = 'HIGH';
      }

      // Check if no face (potential cheating)
      if (detections.length === 0) {
        antiCheatData.alerts.push({
          type: 'NO_FACE_DETECTED',
          severity: 'CRITICAL',
          message: 'Candidate not visible',
        });
        antiCheatData.riskLevel = 'CRITICAL';
      }

      this.logs.antiCheat.push(antiCheatData);
      return antiCheatData;
    } catch (error) {
      console.error('Error detecting cheating indicators:', error);
      return { multipleFaces: false, error: true };
    }
  }

  /**
   * Start continuous face detection
   */
  startDetection(videoElement, callback) {
    if (this.detectionRunning) return;
    this.detectionRunning = true;

    const runDetection = async () => {
      if (!this.detectionRunning) return;

      try {
        // Run all detections in parallel
        const [presence, attention, emotion, antiCheat] = await Promise.all([
          this.detectPresence(videoElement),
          this.detectAttention(videoElement),
          this.detectEmotion(videoElement),
          this.detectCheatingIndicators(videoElement),
        ]);

        callback({
          presence,
          attention,
          emotion,
          antiCheat,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('Error in detection loop:', error);
      }

      // Continue detection
      this.detectionInterval = setTimeout(
        runDetection,
        this.thresholds.attentionCheckInterval
      );
    };

    runDetection();
  }

  /**
   * Stop continuous detection
   */
  stopDetection() {
    this.detectionRunning = false;
    if (this.detectionInterval) {
      clearTimeout(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  /**
   * Helper: Calculate head rotation using landmarks
   */
  calculateHeadRotation(leftEye, rightEye, nose) {
    const eyeMidpoint = {
      x: (leftEye[0].x + rightEye[0].x) / 2,
      y: (leftEye[0].y + rightEye[0].y) / 2,
    };

    const noseTip = nose[3]; // nose tip

    // Calculate angles
    const dx = noseTip.x - eyeMidpoint.x;
    const dy = noseTip.y - eyeMidpoint.y;

    const yaw = (Math.atan2(dx, Math.abs(dy)) * 180) / Math.PI; // Left/Right rotation
    const pitch = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI; // Up/Down rotation
    
    return { yaw, pitch, roll: 0 };
  }

  /**
   * Helper: Calculate eye aspect ratio
   */
  calculateEyeAspectRatio(leftEye, rightEye) {
    // Simplified EAR calculation
    const leftEyeDistance = Math.hypot(
      leftEye[3].x - leftEye[1].x,
      leftEye[3].y - leftEye[1].y
    );
    
    const rightEyeDistance = Math.hypot(
      rightEye[3].x - rightEye[1].x,
      rightEye[3].y - rightEye[1].y
    );

    return (leftEyeDistance + rightEyeDistance) / 2;
  }

  /**
   * Helper: Calculate attention score
   */
  calculateAttentionScore(isLookingAway, headRotation) {
    let score = 100;

    if (isLookingAway) score -= 30;
    score -= Math.abs(headRotation.yaw) * 0.5;
    score -= Math.abs(headRotation.pitch) * 0.3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Helper: Map emotion to confidence level
   */
  mapEmotionToConfidence(emotion) {
    const confidenceMap = {
      neutral: 'HIGH',
      happy: 'HIGH',
      sad: 'MEDIUM',
      angry: 'LOW',
      fearful: 'LOW',
      disgusted: 'LOW',
      surprised: 'MEDIUM',
    };
    return confidenceMap[emotion] || 'MEDIUM';
  }

  /**
   * Helper: Calculate Euclidean distance between two descriptors
   */
  euclideanDistance(descriptor1, descriptor2) {
    let sum = 0;
    for (let i = 0; i < descriptor1.length; i++) {
      const diff = descriptor1[i] - descriptor2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Get analytics summary
   */
  getAnalyticsSummary(startTime) {
    const now = new Date();
    const duration = (now - startTime) / 1000; // seconds

    // Presence Analytics
    const presenceDetected = this.logs.presence.filter(p => p.detected).length;
    const presencePercentage = (presenceDetected / Math.max(1, this.logs.presence.length)) * 100;

    // Attention Analytics
    const lookingAwayCount = this.logs.attention.filter(a => a.lookingAway).length;
    const averageAttentionScore =
      this.logs.attention.reduce((sum, a) => sum + (a.attentionScore || 0), 0) /
      Math.max(1, this.logs.attention.length);

    // Emotion Analytics
    const emotionCounts = {};
    this.logs.emotion.forEach(e => {
      emotionCounts[e.dominantEmotion] = (emotionCounts[e.dominantEmotion] || 0) + 1;
    });

    // Anti-Cheat Analytics
    const antiCheatIncidents = this.logs.antiCheat.filter(a => a.alerts.length > 0).length;
    const multiipleFacesIncidents = this.logs.antiCheat.filter(a => a.multipleFaces).length;

    return {
      duration,
      presence: {
        totalDetections: this.logs.presence.length,
        detected: presenceDetected,
        percentage: parseFloat(presencePercentage.toFixed(2)),
      },
      attention: {
        totalChecks: this.logs.attention.length,
        lookingAway: lookingAwayCount,
        lookingAwayPercentage: (lookingAwayCount / Math.max(1, this.logs.attention.length)) * 100,
        averageScore: parseFloat(averageAttentionScore.toFixed(2)),
      },
      emotion: {
        totalDetections: this.logs.emotion.length,
        distribution: emotionCounts,
      },
      antiCheat: {
        totalIncidents: antiCheatIncidents,
        multiipleFacesIncidents,
        riskLevel: multiipleFacesIncidents > 0 ? 'HIGH' : 'LOW',
      },
    };
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = {
      presence: [],
      attention: [],
      emotion: [],
      antiCheat: []
    };
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return {
      logs: this.logs,
      summary: this.getAnalyticsSummary(new Date()),
    };
  }
}

export default FaceDetectionService;
