/**
 * FaceDetectionOverlay Component
 * Displays real-time face detection visualization and alerts
 */

import { useEffect, useRef, useState } from 'react';
import './FaceDetectionOverlay.css';

function FaceDetectionOverlay({ faceData, videoElement, isRecording }) {
  const canvasRef = useRef(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!faceData || !canvasRef.current || !videoElement) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoElement;

    // Set canvas dimensions to match video
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw presence indicator
    if (faceData.presence) {
      const presence = faceData.presence;
      if (presence.detected && presence.faceCount > 0) {
        // Green border for face detected
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
        
        // Status text
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('✓ Face Detected', 40, 60);
      } else {
        // Red border for no face
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('✗ No Face Detected', 40, 60);
      }
    }

    // Draw attention indicator
    if (faceData.attention) {
      const attention = faceData.attention;
      const y = canvas.height - 100;

      ctx.fillStyle = attention.lookingAway ? '#ef4444' : '#10b981';
      ctx.font = '14px Arial';
      ctx.fillText(
        `👁️ Attention: ${attention.attentionScore}%`,
        40,
        y
      );
      ctx.fillText(
        `Head: Yaw ${attention.headRotation.yaw.toFixed(1)}°`,
        40,
        y + 25
      );
      
      if (attention.lookingAway) {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('⚠️ Looking Away!', canvas.width - 200, y);
      }
    }

    // Draw emotion indicator
    if (faceData.emotion && faceData.emotion.dominantEmotion) {
      const emotion = faceData.emotion;
      const emotionEmoji = {
        neutral: '😐',
        happy: '😊',
        sad: '😢',
        angry: '😠',
        fearful: '😨',
        disgusted: '🤢',
        surprised: '😲',
      };

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(
        `${emotionEmoji[emotion.dominantEmotion]} ${emotion.dominantEmotion}`,
        40,
        canvas.height - 50
      );
    }

    // Draw anti-cheat alerts
    if (faceData.antiCheat && faceData.antiCheat.alerts.length > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 14px Arial';
      let alertY = 100;
      
      faceData.antiCheat.alerts.forEach(alert => {
        ctx.fillText(`⚠️ ${alert.message}`, 40, alertY);
        alertY += 25;
      });

      // Update alerts state
      setAlerts(faceData.antiCheat.alerts);
    }
  }, [faceData, videoElement]);

  return (
    <div className="face-detection-overlay">
      <canvas
        ref={canvasRef}
        className="detection-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 10,
        }}
      />

      {/* Alert notifications */}
      <div className="alerts-container">
        {alerts.map((alert, idx) => (
          <div key={idx} className={`alert alert-${alert.severity.toLowerCase()}`}>
            <span className="alert-icon">⚠️</span>
            <span className="alert-message">{alert.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FaceDetectionOverlay;
