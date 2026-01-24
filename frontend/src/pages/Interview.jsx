// InterviewComponent.jsx
import { useState, useEffect } from 'react'
import SetupScreen from '../components/Interview-frontend/SetupScreen'
import InterviewScreen from '../components/Interview-frontend/InterviewScreen'
import ResultsScreen from '../components/Interview-frontend/ResultsScreen'
import '../App.css'

function InterviewComponent() {
  const [screen, setScreen] = useState('setup')
  const [sessionData, setSessionData] = useState(null)

  useEffect(() => {
    // Check if there's adaptive session data from the results screen
    const adaptiveSessionData = sessionStorage.getItem('adaptiveSessionData')
    if (adaptiveSessionData) {
      try {
        const adaptiveData = JSON.parse(adaptiveSessionData)
        // Set up adaptive session
        setSessionData({
          session_id: adaptiveData.session_id,
          questions: adaptiveData.questions,
          interview_type: adaptiveData.interview_type,
          isAdaptive: true,
          parentSessionId: adaptiveData.parent_session_id
        })
        setScreen('interview')
        // Clear the adaptive data from storage after use
        sessionStorage.removeItem('adaptiveSessionData')
      } catch (err) {
        console.error('Error parsing adaptive session data:', err)
      }
    }
  }, [])

  const handleSessionCreated = (data) => {
    setSessionData(data)
    setScreen('interview')
  }

  const handleInterviewComplete = () => {
    setScreen('results')
  }

  const handleStartNew = () => {
    setSessionData(null)
    setScreen('setup')
  }

  return (
    <div className="app">
      {screen === 'setup' && (
        <SetupScreen onSessionCreated={handleSessionCreated} />
      )}

      {screen === 'interview' && sessionData && (
        <InterviewScreen
          sessionData={sessionData}
          onComplete={handleInterviewComplete}
        />
      )}

      {screen === 'results' && sessionData && (
        <ResultsScreen
          sessionId={sessionData.session_id}
          onStartNew={handleStartNew}
        />
      )}
    </div>
  )
}

export default InterviewComponent
