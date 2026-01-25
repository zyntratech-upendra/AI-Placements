import { useState, useEffect, useRef, useCallback } from 'react'
import './InterviewScreen.css'
import FaceDetectionWebSocket from './FaceDetectionWebSocket'

function InterviewScreen({ sessionData, onComplete }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [recording, setRecording] = useState(false)
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0)
  const [totalTimeLeft, setTotalTimeLeft] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [recordingStopped, setRecordingStopped] = useState(false)
  const [isTimerRunning, setIsTimerRunning] = useState(true)
  const [speakingQuestion, setSpeakingQuestion] = useState(false)
  const [faceDetectionStatus, setFaceDetectionStatus] = useState('wait')
  const [faceDetectionMessage, setFaceDetectionMessage] = useState('')
  const [alerts, setAlerts] = useState([])
  const [interviewTerminated, setInterviewTerminated] = useState(false)

  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const questionTimerRef = useRef(null)
  const totalTimerRef = useRef(null)
  const totalInterviewTimeRef = useRef(sessionData.duration_seconds || 300)

  const questions = sessionData.questions || []
  const currentQuestion = questions[currentQuestionIndex]
  const totalQuestions = questions.length
const token = localStorage.getItem('token') // ✅ JWT

  const authHeaders = {
    Authorization: `Bearer ${token}`
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
  }

  /**
   * Handle face detection alerts - debounced to prevent spam
   */
  const lastAlertTimeRef = useRef(0)
  const lastAlertMessageRef = useRef('')
  
  const handleFaceDetectionAlert = useCallback((status, message) => {
    const now = Date.now()
    
    // Debounce: only process if different message or 2+ seconds passed
    if (message === lastAlertMessageRef.current && (now - lastAlertTimeRef.current) < 2000) {
      return
    }
    
    lastAlertTimeRef.current = now
    lastAlertMessageRef.current = message
    
    setFaceDetectionStatus(status)
    setFaceDetectionMessage(message)
    
    const alert = {
      id: now,
      status,
      message,
      timestamp: new Date()
    }
    
    setAlerts(prev => {
      const newAlerts = [...prev, alert]
      // Keep only last 3 alerts to prevent UI clutter
      return newAlerts.slice(-3)
    })
  }, [])

  /**
   * Handle interview termination from face detection
   */
  const terminationHandledRef = useRef(false)
  const handleInterviewTermination = useCallback(async (reason) => {
    // Prevent multiple termination calls
    if (terminationHandledRef.current) {
      return
    }
    terminationHandledRef.current = true
    
    setInterviewTerminated(true)
    setFaceDetectionStatus('terminate')
    setFaceDetectionMessage(reason)
    
    // Stop recording if active
    if (recording) {
      stopRecording()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Wait for any uploads to complete (with timeout)
    let waitCount = 0
    while (uploading && waitCount < 50) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waitCount++
    }
    
    // Analyze and complete interview
    await analyzeInterview()
  }, [recording, uploading])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      })
      streamRef.current = stream
      setCameraReady(true)
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Please allow camera and microphone access to continue')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      setRecordingStopped(true)

      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current)
        questionTimerRef.current = null
      }
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleRecordingStop = async () => {
    if (audioChunksRef.current.length === 0) return

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    await uploadAnswer(audioBlob)
  }

  const uploadAnswer = async (audioBlob) => {
    setUploading(true)
    setIsTimerRunning(false)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'answer.webm')

      const response = await fetch(
        `http://localhost:8000/api/upload-answer/${sessionData.session_id}/${currentQuestion.id}`,
        {
          method: 'POST',
          headers: authHeaders ,
          body: formData,
        }
      )

      if (!response.ok) {
        throw new Error('Failed to upload answer')
      }
    } catch (error) {
      console.error('Error uploading answer:', error)
      alert('Failed to upload answer. Please try again.')
    } finally {
      setUploading(false)
      setIsTimerRunning(true)
    }
  }

  const startRecording = async () => {
    if (!streamRef.current || recording) return

    audioChunksRef.current = []
    setRecordingStopped(false)

    try {
      const audioStream = new MediaStream(streamRef.current.getAudioTracks())

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4"

      const mediaRecorder = new MediaRecorder(audioStream, { mimeType })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = handleRecordingStop

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setRecording(true)

      setQuestionTimeLeft(currentQuestion.estimated_seconds || 90)

      if (questionTimerRef.current) clearInterval(questionTimerRef.current)

      questionTimerRef.current = setInterval(() => {
        setQuestionTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const speakQuestion = () => {
    if (!currentQuestion || speakingQuestion) return

    setSpeakingQuestion(true)

    const utterance = new SpeechSynthesisUtterance(currentQuestion.text)
    utterance.onend = () => {
      setSpeakingQuestion(false)
      startRecording()
    }

    window.speechSynthesis.speak(utterance)
  }

  const analyzeInterview = async () => {
    setAnalyzing(true)
    stopCamera()

    try {
      const response = await fetch(
        `http://localhost:8000/api/analyze/${sessionData.session_id}`,
        { method: 'POST' , headers: authHeaders }
      )

      if (!response.ok) {
        throw new Error('Failed to analyze interview')
      }

      // Delay onComplete to show results
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (error) {
      console.error('Error analyzing interview:', error)
      alert('Failed to analyze interview. Please check results manually.')
      onComplete()
    }
  }

  const handleNextQuestion = () => {
    if (!recordingStopped) return
    if (uploading) return

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setRecordingStopped(false)
      setSpeakingQuestion(false)
    } else {
      analyzeInterview()
    }
  }

  const handleFinishInterview = async () => {
    if (uploading || analyzing) return

    const confirmFinish = window.confirm(
      'Are you sure you want to finish the interview? Any unanswered questions will be skipped.'
    )

    if (!confirmFinish) return

    if (recording) {
      stopRecording()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    while (uploading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    analyzeInterview()
  }

  useEffect(() => {
    startCamera()
    setTotalTimeLeft(totalInterviewTimeRef.current)

    return () => {
      stopCamera()
      if (questionTimerRef.current) clearInterval(questionTimerRef.current)
      if (totalTimerRef.current) clearInterval(totalTimerRef.current)
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    if (cameraReady && currentQuestion && !recordingStopped && !speakingQuestion) {
      speakQuestion()
    }
  }, [currentQuestionIndex, cameraReady])

  useEffect(() => {
    if (!isTimerRunning) return;

    totalTimerRef.current = setInterval(() => {
      setTotalTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(totalTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(totalTimerRef.current)
  }, [isTimerRunning])

  return (
    <div className="interview-screen">
      {/* Show termination message */}
      {interviewTerminated && (
        <div className="termination-modal" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#ef4444', marginBottom: '15px' }}>Interview Terminated</h2>
            <p>{faceDetectionMessage}</p>
            <p style={{ marginTop: '15px', color: '#666' }}>Generating feedback...</p>
          </div>
        </div>
      )}

      <div className="interview-header">
        <div className="progress-info">
          <span className="question-number">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`
              }}
            />
          </div>
        </div>
        <div className="time-info">
          <span className="total-time-label">Interview Time:</span>
          <span className="total-time">{formatTime(totalTimeLeft)}</span>
        </div>
        <button
          className="finish-interview-button"
          onClick={handleFinishInterview}
          disabled={uploading || analyzing}
        >
          Finish Interview
        </button>
      </div>

      <div className="interview-content">
        <div className="video-section">
          <FaceDetectionWebSocket
            sessionId={sessionData.session_id}
            onTerminate={handleInterviewTermination}
            onAlert={handleFaceDetectionAlert}
          />
          {recording && (
            <div className="recording-indicator" style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: '#ef4444',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              zIndex: 100,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              <span style={{
                width: '10px',
                height: '10px',
                backgroundColor: 'white',
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }}></span>
              Recording
            </div>
          )}
          <div className="timer-container">
            <div className="question-timer">
              <span className="timer-label">Question Time</span>
              <span className="timer-value">{formatTime(questionTimeLeft)}</span>
            </div>
          </div>
        </div>

        <div className="question-section">
          <h2 className="question-title">Your Question</h2>
          <p className="question-text">{currentQuestion?.text}</p>

          {/* Face Detection Alerts */}
          {alerts.length > 0 && (
            <div className="warnings-container" style={{
              marginBottom: '20px',
              marginTop: '10px'
            }}>
              {alerts.slice(-3).map(alert => (
                <div
                  key={alert.id}
                  className={`warning warning-${alert.status}`}
                  style={{
                    padding: '12px 16px',
                    marginBottom: '8px',
                    borderRadius: '6px',
                    backgroundColor:
                      alert.status === 'warning'
                        ? '#fef3c7'
                        : alert.status === 'alert'
                        ? '#fee2e2'
                        : '#f3f4f6',
                    color:
                      alert.status === 'warning'
                        ? '#92400e'
                        : alert.status === 'alert'
                        ? '#991b1b'
                        : '#374151',
                    borderLeft: `4px solid ${
                      alert.status === 'warning'
                        ? '#f59e0b'
                        : alert.status === 'alert'
                        ? '#ef4444'
                        : '#6b7280'
                    }`,
                    fontWeight: '500',
                    fontSize: '14px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <span style={{ marginRight: '8px' }}>
                    {alert.status === 'warning' ? '⚠️' : alert.status === 'alert' ? '🚨' : 'ℹ️'}
                  </span>
                  {alert.message}
                </div>
              ))}
            </div>
          )}

          {speakingQuestion && (
            <div className="status-message speaking">
              <span className="upload-spinner"></span>
              Question is being read aloud...
            </div>
          )}

          {uploading && (
            <div className="status-message uploading">
              <span className="upload-spinner"></span>
              Uploading your answer...
            </div>
          )}

          {analyzing && (
            <div className="status-message analyzing">
              <span className="upload-spinner"></span>
              Analyzing your interview... This may take a moment.
            </div>
          )}

          {recordingStopped && !uploading && !analyzing && (
            <div className="action-section">
              <p className="action-message">Recording complete!</p>
              <button
                className="next-button"
                onClick={handleNextQuestion}
                disabled={uploading}
              >
                {currentQuestionIndex < questions.length - 1
                  ? 'Next Question'
                  : 'Finish Interview'}
              </button>
            </div>
          )}

          {recording && (
            <div className="recording-message">
              <button className="stop-button" onClick={stopRecording}>
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="interview-footer">
        <div className="question-grid">
          {questions.map((q, index) => (
            <div
              key={q.id}
              className={`question-indicator ${
                index < currentQuestionIndex
                  ? 'completed'
                  : index === currentQuestionIndex
                  ? 'active'
                  : ''
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default InterviewScreen
