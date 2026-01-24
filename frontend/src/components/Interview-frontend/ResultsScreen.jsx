import { useState, useEffect } from 'react'
import './ResultsScreen.css'

function ResultsScreen({ sessionId, onStartNew }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [answers, setAnswers] = useState([])
  const [error, setError] = useState('')
  const [expandedQuestion, setExpandedQuestion] = useState(null)
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false)
  const [creatingAdaptive, setCreatingAdaptive] = useState(false)
  const [adaptiveData, setAdaptiveData] = useState(null)

  useEffect(() => {
    fetchResults()
  }, [sessionId])

  const token = localStorage.getItem('token')

const authHeaders = {
  Authorization: `Bearer ${token}`
}


  const fetchResults = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/session/${sessionId}`,{
        headers: authHeaders
      })
      console.log("Fetch Results Response:", response);

      if (!response.ok) {
        throw new Error('Failed to fetch results')
      }

      const data = await response.json()
      setSession(data.session)
      setAnswers(data.answers)
    } catch (err) {
      setError(err.message || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/export-pdf/${sessionId}`,{
        headers: authHeaders
      })

      if (!response.ok) {
        throw new Error('Failed to export PDF')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `interview_results_${sessionId.substring(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      alert('Failed to export PDF. Please try again.')
    }
  }

  const getScoreColor = (score) => {
    if (score >= 8) return '#48bb78'
    if (score >= 6) return '#ecc94b'
    return '#f56565'
  }

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent'
    if (score >= 6) return 'Good'
    if (score >= 4) return 'Fair'
    return 'Needs Improvement'
  }

  const calculateAverageScore = () => {
    const scores = answers.filter(a => a.score != null).map(a => a.score)
    if (scores.length === 0) return 0
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
  }

  const getQuestionText = (questionId) => {
    const question = session?.questions?.find(q => q.id === questionId)
    return question?.text || 'Question not found'
  }

  const handleGoBack = () => {
    window.history.back()
  }

  const handleStartAdaptive = async () => {
    if (averageScore >= 8) {
      alert('Your score is excellent! No adaptive learning needed.')
      return
    }

    setCreatingAdaptive(true)
    try {
      const response = await fetch(
        `http://localhost:8000/api/interview/adaptive/${sessionId}`,
        {
          method: 'POST',
          headers: authHeaders
        }
      )

      if (!response.ok) {
        throw new Error('Failed to create adaptive interview')
      }

      const data = await response.json()
      setAdaptiveData(data)
      setShowAdaptiveModal(true)
    } catch (err) {
      alert('Failed to create adaptive interview: ' + err.message)
    } finally {
      setCreatingAdaptive(false)
    }
  }

  const handleProceedAdaptive = () => {
    // Store adaptive session data and start interview
    sessionStorage.setItem('adaptiveSessionData', JSON.stringify(adaptiveData))
    window.location.href = '/interview'  // Redirect to interview with adaptive data
  }

  if (loading) {
    return (
      <div className="results-screen">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="results-screen">
        <div className="error-container">
          <h2>Error Loading Results</h2>
          <p>{error}</p>
          <button onClick={onStartNew} className="button-primary">
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  const averageScore = calculateAverageScore()

  return (
    <div className="results-screen">
      <button className="back-button" onClick={handleGoBack}>
        <span className="back-arrow">←</span> Back
      </button>
      <div className="results-container">
        <div className="results-header">
          <div className="header-icon">✓</div>
          <h1>Interview Results</h1>
          <p>Here's how you performed in your interview</p>
        </div>

        <div className="results-summary">
          <div className="score-card-large">
            <div className="score-label">Overall Score</div>
            <div className="score-value" style={{ color: getScoreColor(averageScore) }}>
              {averageScore}
              <span className="score-max">/10</span>
            </div>
            <div className="score-description">{getScoreLabel(averageScore)}</div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{answers.length}</div>
              <div className="stat-label">Questions Answered</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {Math.round((session?.duration_seconds || 0) / 60)}m
              </div>
              <div className="stat-label">Interview Duration</div>
            </div>
          </div>
        </div>

        {averageScore < 8 && (
          <div className="adaptive-recommendation">
            <div className="adaptive-header">
              <span className="adaptive-icon">🎯</span>
              <div className="adaptive-text">
                <h3>Adaptive Learning Available</h3>
                <p>Your score is below 8. We can create a personalized interview focusing on your weak areas to help you improve!</p>
              </div>
            </div>
            <button 
              className="button-adaptive" 
              onClick={handleStartAdaptive}
              disabled={creatingAdaptive}
            >
              {creatingAdaptive ? 'Creating Interview...' : 'Start Adaptive Interview'}
            </button>
          </div>
        )}

        <div className="questions-results">
          <h2>Question-by-Question Breakdown</h2>

          {answers.map((answer, index) => (
            <div key={answer.id} className="question-result-card">
              <div
                className="question-result-header"
                onClick={() => {
                  console.log('Clicked answer id:', answer.id, 'Current expanded:', expandedQuestion)
                  setExpandedQuestion(
                    expandedQuestion === answer.id ? null : answer.id
                  )
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="question-result-info">
                  <span className="question-number-badge">Q{index + 1}</span>
                  <span className="question-text-preview">
                    {getQuestionText(answer.question_id)}
                  </span>
                </div>
                <div className="question-result-score">
                  {answer.score != null ? (
                    <>
                      <span
                        className="score-badge"
                        style={{ background: getScoreColor(answer.score) }}
                      >
                        {answer.score}/10
                      </span>
                      <span className="expand-icon" style={{ cursor: 'pointer' }}>
                        {expandedQuestion === answer.id ? '▲' : '▼'}
                      </span>
                    </>
                  ) : (
                    <span className="score-badge pending">Pending</span>
                  )}
                </div>
              </div>

              {expandedQuestion === answer.id && (
                <div className="question-result-details">
                  <div className="detail-section">
                    <h4>Your Answer</h4>
                    <p className="transcript-text">
                      {answer.transcript || 'No transcript available'}
                    </p>
                  </div>

                  {answer.feedback && answer.feedback.length > 0 && (
                    <div className="detail-section">
                      <h4>Feedback</h4>
                      <ul className="feedback-list">
                        {answer.feedback.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {answer.model_answer && (
                    <div className="detail-section">
                      <h4>Model Answer</h4>
                      <p className="model-answer-text">{answer.model_answer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="results-actions">
          <button onClick={handleGoBack} className="button-tertiary">
            ← Back to Dashboard
          </button>
          <button onClick={handleExportPDF} className="button-secondary">
            📄 Export as PDF
          </button>
          {averageScore < 8 && (
            <button 
              onClick={() => window.location.href = '/my-interviews?tab=adaptive'} 
              className="button-adaptive-nav"
            >
              🎯 Go to Adaptive Learning
            </button>
          )}
          <button onClick={onStartNew} className="button-primary">
            → Start New Interview
          </button>
        </div>
      </div>

      {showAdaptiveModal && adaptiveData && (
        <div className="modal-overlay" onClick={() => setShowAdaptiveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAdaptiveModal(false)}>×</button>
            
            <div className="modal-header">
              <h2>🎯 Adaptive Interview Ready</h2>
              <p>Your personalized learning session</p>
            </div>
            
            <div className="modal-body">
              <div className="adaptive-details">
                <div className="weak-areas-title">Your Weak Areas</div>
                <div className="weak-areas-list">
                  {adaptiveData.weak_areas && adaptiveData.weak_areas.map((area, idx) => (
                    <div key={idx} className="weak-area-item">
                      <span className="area-topic">{area.topic}</span>
                      <span className="area-score">Score: {area.score}/10</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                  <div className="adaptive-detail-item">
                    <span className="adaptive-detail-label">📝 Questions</span>
                    <span className="adaptive-detail-value">{adaptiveData.questions.length}</span>
                  </div>
                  <div className="adaptive-detail-item">
                    <span className="adaptive-detail-label">⏱️ Duration</span>
                    <span className="adaptive-detail-value">{Math.round(adaptiveData.duration_seconds / 60)} min</span>
                  </div>
                  <div className="adaptive-detail-item">
                    <span className="adaptive-detail-label">📚 Type</span>
                    <span className="adaptive-detail-value">{adaptiveData.interview_type.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="button-later" onClick={() => setShowAdaptiveModal(false)}>
                Maybe Later
              </button>
              <button className="button-start-adaptive" onClick={handleProceedAdaptive} disabled={creatingAdaptive}>
                {creatingAdaptive ? 'Loading...' : 'Start Now →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsScreen
