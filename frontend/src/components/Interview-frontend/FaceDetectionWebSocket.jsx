/**
 * FaceDetectionWebSocket Component
 * Handles WebSocket-based face detection using MediaPipe backend
 */

import { useEffect, useRef, useState, useCallback } from 'react';

function FaceDetectionWebSocket({ sessionId, onTerminate, onAlert }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const alertCountRef = useRef(0);
  const lastStatusRef = useRef(null);
  const lastAlertTimeRef = useRef(0);
  const [status, setStatus] = useState('wait');
  const [message, setMessage] = useState('Initializing...');
  const [faceCount, setFaceCount] = useState(0);
  
  // Debounce alerts - only show new alerts every 2 seconds
  const ALERT_DEBOUNCE_MS = 2000;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found for WebSocket connection');
      return;
    }

    // Request camera first
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Open WebSocket after camera works
        const wsUrl = `ws://localhost:8000/ws/monitor/${sessionId}?token=${token}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✅ WebSocket connected');
          setStatus('ok');
          setMessage('Camera & WebSocket connected');
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setStatus('error');
          setMessage('WebSocket connection error');
          if (onAlert) {
            onAlert('error', 'Face detection service unavailable');
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const currentStatus = data.status;
            const currentMessage = data.message;
            const currentFaceCount = data.face_count || 0;
            const currentAlertCount = data.alert_count || 0;
            
            // Only update state if status or message changed (reduce re-renders)
            if (currentStatus !== status || currentMessage !== message) {
              setStatus(currentStatus);
              setMessage(currentMessage);
            }
            
            if (currentFaceCount !== faceCount) {
              setFaceCount(currentFaceCount);
            }
            
            alertCountRef.current = currentAlertCount;

            // Handle alerts - trigger for warning and alert statuses only
            // 'wait' status means face not detected but still in cooldown, don't alert
            const now = Date.now();
            
            // Always trigger alert for 'warning' or 'alert' status when status changes
            // This ensures alerts are shown even if backend has its own cooldown
            const statusChanged = currentStatus !== lastStatusRef.current;
            const isAlertStatus = (currentStatus === 'warning' || currentStatus === 'alert');
            
            // Alert immediately on status change, or after debounce period
            if (isAlertStatus && (statusChanged || now - lastAlertTimeRef.current > ALERT_DEBOUNCE_MS)) {
              lastAlertTimeRef.current = now;
              if (onAlert) {
                console.log(`[Face Detection] Alert: ${currentStatus} - ${currentMessage} (Alert count: ${currentAlertCount}, Face count: ${currentFaceCount})`);
                onAlert(currentStatus, currentMessage);
              }
            }
            
            lastStatusRef.current = currentStatus;

            // Handle termination immediately
            if (currentStatus === 'terminate') {
              if (onTerminate) {
                onTerminate(currentMessage);
              }
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        ws.onclose = () => {
          console.log('🔴 WebSocket closed');
          setStatus('error');
          setMessage('Connection closed');
        };

        // Send frames every 300ms
        const frameInterval = setInterval(() => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          if (!videoRef.current || videoRef.current.videoWidth === 0) return;

          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);

          canvas.toBlob(
            (blob) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(
                    JSON.stringify({
                      frame: base64,
                    })
                  );
                }
              };
              reader.readAsDataURL(blob);
            },
            'image/jpeg',
            0.6
          );
        }, 300);

        // Cleanup
        return () => {
          clearInterval(frameInterval);
          if (ws) {
            ws.close();
          }
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
          }
        };
      })
      .catch((error) => {
        console.error('Camera access error:', error);
        setStatus('error');
        setMessage('Camera access denied');
        if (onAlert) {
          onAlert('error', 'Please allow camera access to continue');
        }
      });
  }, [sessionId, onTerminate, onAlert]);

  // Memoize status display to prevent unnecessary re-renders
  const statusDisplay = useRef(null);
  useEffect(() => {
    statusDisplay.current = {
      status,
      message,
      faceCount
    };
  }, [status, message, faceCount]);

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div
        key={`status-${status}`}
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          padding: '8px 12px',
          backgroundColor:
            status === 'ok'
              ? 'rgba(16, 185, 129, 0.9)'
              : status === 'warning'
              ? 'rgba(245, 158, 11, 0.9)'
              : status === 'alert'
              ? 'rgba(239, 68, 68, 0.9)'
              : 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {status === 'ok' && '✓'} {message} | Faces: {faceCount}
      </div>
    </div>
  );
}

export default FaceDetectionWebSocket;
