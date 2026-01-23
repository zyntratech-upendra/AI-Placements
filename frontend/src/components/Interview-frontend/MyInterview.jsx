import { useEffect, useState } from 'react'
import './MyInterview.css'


function MyInterviews({ onOpenInterview, onStartNew }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
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

  const getStatusColor = (status) => {
    if (status === 'completed') return '#48bb78'
    if (status === 'created') return '#ecc94b'
    return '#f56565'
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
          <div className="interviews-grid">
            {sessions.map((session) => (
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
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyInterviews
