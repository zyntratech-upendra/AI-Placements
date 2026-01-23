import { useState } from 'react'
import './SetupScreen.css'

function SetupScreen({ onSessionCreated }) {
  const [jobDescription, setJobDescription] = useState('')
  const [resume, setResume] = useState(null)
  const [duration, setDuration] = useState(300)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [interviewType, setInterviewType] = useState('technical')

  const token = localStorage.getItem('token') // ✅ JWT

  const authHeaders = {
    Authorization: `Bearer ${token}`
  }


  const handleResumeChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type === 'application/pdf') {
      setResume(file)
      setError('')
    } else {
      setError('Please upload a PDF file')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!jobDescription.trim()) {
      setError('Please enter a job description')
      return
    }

    if (!resume) {
      setError('Please upload your resume (PDF)')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('job_description', jobDescription)
      formData.append('resume', resume)
      formData.append('duration', duration)
      formData.append('interview_type', interviewType)

      const token = localStorage.getItem('token') // ✅ AUTH TOKEN

      const response = await fetch(
        'http://localhost:8000/api/create-session',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}` // ✅ REQUIRED
          },
          body: formData
        }
      )

      if (!response.ok) {
        throw new Error('Failed to create interview session')
      }

      const data = await response.json()
      onSessionCreated(data)

    } catch (err) {
      setError(err.message || 'Failed to create session. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-screen">
      <div className="setup-container">
        <div className="setup-header">
          <h1>AI Interview Assistant</h1>
          <p>Upload your details to start your personalized interview</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="form-group">
            <label htmlFor="jobDescription">Job Description</label>
            <textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              rows="8"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="resume">Resume (PDF)</label>
            <div className="file-input-wrapper">
              <input
                type="file"
                id="resume"
                accept=".pdf"
                onChange={handleResumeChange}
                disabled={loading}
              />
              {resume && (
                <span className="file-name">{resume.name}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="duration">Interview Duration</label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={loading}
            >
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
              <option value={600}>10 minutes</option>
              <option value={900}>15 minutes</option>
              <option value={1200}>20 minutes</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="interviewType">Interview Type</label>
            <select
              id="interviewType"
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value)}
              disabled={loading}
            >
              <option value="technical">Technical Interview</option>
              <option value="hr">HR Interview</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Creating Session...' : 'Start Interview'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SetupScreen
