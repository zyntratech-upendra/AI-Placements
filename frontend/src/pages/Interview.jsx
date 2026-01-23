// InterviewComponent.jsx
import { useState } from 'react'
import SetupScreen from '../components/Interview-frontend/SetupScreen'
import InterviewScreen from '../components/Interview-frontend/InterviewScreen'
import ResultsScreen from '../components/Interview-frontend/ResultsScreen'
import '../App.css'

function InterviewComponent() {
  const [screen, setScreen] = useState('setup')
  const [sessionData, setSessionData] = useState(null)

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
