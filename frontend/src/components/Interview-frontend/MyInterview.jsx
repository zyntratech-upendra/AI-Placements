import { useEffect, useState } from 'react'
import './MyInterview.css'


function MyInterviews({ onOpenInterview, onStartNew }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('regular') // 'regular' or 'adaptive'
  const [expandedAdaptiveParent, setExpandedAdaptiveParent] = useState(null)

  useEffect(() => {
    // Check if tab is specified in URL
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'adaptive') {
      setActiveTab('adaptive')
      // Remove the query parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    
    fetchMyInterviews()
  }, [])

  const fetchMyInterviews = async () => {
    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        'http://localhost:8000/api/my-sessions',
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load interviews')
      }

      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Separate regular and adaptive interviews
  const regularSessions = sessions.filter(s => !s.is_adaptive)
  const adaptiveSessions = sessions.filter(s => s.is_adaptive)

  // Group adaptive sessions by parent session
  const groupedAdaptiveSessions = {}
  adaptiveSessions.forEach(session => {
    const parentId = session.parent_session_id || 'orphan'
    if (!groupedAdaptiveSessions[parentId]) {
      groupedAdaptiveSessions[parentId] = []
    }
    groupedAdaptiveSessions[parentId].push(session)
  })

  const getStatusColor = (status) => {
    if (status === 'completed') return '#48bb78'
    if (status === 'created') return '#ecc94b'
    return '#f56565'
  }

  const handleStartAdaptiveInterview = async (sessionId, isCompleted = false) => {
    try {
      const token = localStorage.getItem('token')
      
      // If interview is completed, show results instead of reopening interview
      if (isCompleted) {
        window.location.href = `/student/interview-results/${sessionId}`
        return
      }

      // Fetch the session details
      const response = await fetch(
        `http://localhost:8000/api/session/${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load interview')
      }

      const data = await response.json()
      const session = data.session

      // Store the adaptive session data in sessionStorage
      sessionStorage.setItem('adaptiveSessionData', JSON.stringify({
        session_id: session.id,
        questions: session.questions,
        interview_type: session.interview_type,
        duration_seconds: session.duration_seconds,
        is_adaptive: session.is_adaptive,
        parent_session_id: session.parent_session_id
      }))

      // Navigate to the interview page to continue
      window.location.href = '/interview'
    } catch (err) {
      setError(err.message || 'Failed to open interview')
    }
  }

  const handleStartAdaptiveLearning = async (parentSessionId) => {
    try {
      const token = localStorage.getItem('token')
      
      // Call backend to create adaptive learning sessions
      const response = await fetch(
        `http://localhost:8000/api/interview/adaptive/${parentSessionId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to create adaptive learning sessions')
      }

      // Refresh sessions to show new adaptive interviews
      await fetchMyInterviews()
      
      // Switch to adaptive tab and expand this parent's sessions
      setActiveTab('adaptive')
      setExpandedAdaptiveParent(parentSessionId)
    } catch (err) {
      setError(err.message || 'Failed to start adaptive learning')
    }
  }

  if (loading) {
    return (
      <div className="my-interviews-screen">
        <div className="loading">Loading interviews...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="my-interviews-screen">
        <div className="error-box">
          <p>{error}</p>
          <button onClick={onStartNew} className="primary-btn">
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="my-interviews-screen">
      <div className="my-interviews-container">
        <div className="header">
          <h1>My Interview History</h1>
          <p>All interviews you have attended</p>
        </div>

        {sessions.length === 0 ? (
          <div className="empty-state">
            <p>No interviews found</p>
            <button onClick={onStartNew} className="primary-btn">
              Start First Interview
            </button>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="interview-tabs">
              <button
                className={`tab-button ${activeTab === 'regular' ? 'active' : ''}`}
                onClick={() => setActiveTab('regular')}
              >
                📋 Regular Interviews ({regularSessions.length})
              </button>
              <button
                className={`tab-button ${activeTab === 'adaptive' ? 'active' : ''}`}
                onClick={() => setActiveTab('adaptive')}
              >
                🎯 Adaptive Learning ({adaptiveSessions.length})
              </button>
            </div>

            {/* Regular Interviews Tab */}
            {activeTab === 'regular' && (
              <div className="interviews-grid">
                {regularSessions.length === 0 ? (
                  <div className="empty-state-tab">
                    <p>No regular interviews yet</p>
                    <button onClick={onStartNew} className="primary-btn">
                      Start Interview
                    </button>
                  </div>
                ) : (
                  regularSessions.map((session) => (
                    <div key={session.id} className="interview-card">
                      <div className="card-top">
                        <span
                          className="status-badge"
                          style={{ background: getStatusColor(session.status) }}
                        >
                          {session.status}
                        </span>
                      </div>

                      <h3 className="interview-type">
                        {session.interview_type.toUpperCase()} Interview
                      </h3>

                      <p className="job-desc">
                        {session.job_description.slice(0, 120)}...
                      </p>

                      <div className="meta-info">
                        <span>
                          Duration: {Math.round(session.duration_seconds / 60)} min
                        </span>
                        <span>
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="card-footer">
                        <span className="score">
                          Score:{' '}
                          {session.final_score != null
                            ? `${session.final_score}/10`
                            : 'Pending'}
                        </span>

                        <button
                          className="secondary-btn"
                          onClick={() => onOpenInterview(session.id)}
                        >
                          {session.status === 'completed' ? 'View' : 'Continue'}
                        </button>
                      </div>

                      {/* Show adaptive learning button if score < 8 */}
                      {session.final_score != null && session.final_score < 8 && (
                        <div className="adaptive-available">
                          <button 
                            className="adaptive-cta-btn"
                            onClick={() => handleStartAdaptiveLearning(session.id)}
                          >
                            ⚡ Start Adaptive Learning
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Adaptive Learning Tab */}
            {activeTab === 'adaptive' && (
              <div className="adaptive-learning-section">
                {adaptiveSessions.length === 0 ? (
                  <div className="empty-state-tab">
                    <p>No adaptive learning interviews yet</p>
                    <p className="text-muted">Score below 8 to unlock adaptive learning</p>
                  </div>
                ) : (
                  <div className="adaptive-groups">
                    {Object.entries(groupedAdaptiveSessions).map(([parentId, adaptivGroup]) => {
                      // Find the parent session
                      const parentSession = regularSessions.find(s => s.id === parentId)
                      const isExpanded = expandedAdaptiveParent === parentId

                      return (
                        <div key={parentId} className="adaptive-group">
                          {/* Parent Session Reference */}
                          <div 
                            className="adaptive-group-header"
                            onClick={() => setExpandedAdaptiveParent(isExpanded ? null : parentId)}
                          >
                            <div className="group-title">
                              <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                              <span className="group-name">
                                📚 Adaptive Learning Path
                              </span>
                              {parentSession && (
                                <span className="parent-score">
                                  Original Score: {parentSession.final_score}/10
                                </span>
                              )}
                            </div>
                            <span className="interview-count">
                              {adaptivGroup.length} interview{adaptivGroup.length !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Adaptive Interviews */}
                          {isExpanded && (
                            <div className="adaptive-interviews">
                              {adaptivGroup.map((session, index) => {
                                const interviewType = getAdaptiveInterviewType(index)
                                return (
                                  <div key={session.id} className="adaptive-interview-card">
                                    <div className="adaptive-badge">
                                      {interviewType.icon} {interviewType.label}
                                    </div>

                                    <h4 className="adaptive-interview-title">
                                      {interviewType.title}
                                    </h4>

                                    <p className="adaptive-interview-desc">
                                      {interviewType.description}
                                    </p>

                                    <div className="adaptive-meta">
                                      <span>
                                        ⏱️ {Math.round(session.duration_seconds / 60)} min
                                      </span>
                                      <span>
                                        📅 {new Date(session.created_at).toLocaleDateString()}
                                      </span>
                                    </div>

                                    <div className="adaptive-footer">
                                      {session.final_score != null ? (
                                        <>
                                          <span className="adaptive-score">
                                            Score: {session.final_score}/10
                                          </span>
                                          {parentSession && (
                                            <span className="improvement">
                                              {session.final_score > parentSession.final_score ? (
                                                <>✅ +{(session.final_score - parentSession.final_score).toFixed(1)}</>
                                              ) : (
                                                <>⏳ No improvement yet</>
                                              )}
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="status-pending">⏳ Pending</span>
                                      )}

                                      <div className="adaptive-buttons">
                                        <button
                                          className={`adaptive-btn ${session.final_score != null ? 'reviewed' : ''}`}
                                          onClick={() => handleStartAdaptiveInterview(session.id, session.final_score != null)}
                                        >
                                          {session.final_score != null ? 'Review' : 'Continue'}
                                        </button>
                                        {session.final_score != null && (
                                          <button
                                            className="adaptive-btn practice-again"
                                            onClick={() => handleStartAdaptiveInterview(session.id, false)}
                                          >
                                            🔄 Practice Again
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Helper function to get adaptive interview type details
function getAdaptiveInterviewType(index) {
  const types = [
    {
      icon: '🔄',
      label: 'Retry',
      title: 'Same Questions Review',
      description: 'Practice with the same questions to improve your answers'
    },
    {
      icon: '📝',
      label: 'Practice 1',
      title: 'Focused Learning - Set 1',
      description: 'New questions focusing on your weak areas'
    },
    {
      icon: '📖',
      label: 'Practice 2',
      title: 'Focused Learning - Set 2',
      description: 'Additional questions on similar topics'
    }
  ]
  return types[index] || types[0]
}

export default MyInterviews

