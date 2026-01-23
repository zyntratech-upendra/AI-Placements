import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import MentorDashboard from './pages/MentorDashboard';
import TakeAssessment from './pages/TakeAssessment';
import AssessmentResults from './components/AssessmentResults';
import Interview from './pages/Interview';
import MyInterviews from './components/Interview-frontend/MyInterview';
import PlacementTakeAssessment from './pages/PlacementTakeAssessment';
import PlacementResult from './pages/PlacementResult';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={`/${user.role}`} />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <Interview />
          </ProtectedRoute>
        }
      />
      <Route
        path="student/interview-results/:sessionId"
        element={
          <ProtectedRoute allowedRoles={['student']}> 

            <MyInterviews />
          </ProtectedRoute>
        }
      />


      <Route
        path="/student/assessment/:assessmentId"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <TakeAssessment />
          </ProtectedRoute>
        }
      />

      <Route
        path="/assessment-results/:attemptId"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <AssessmentResults />
          </ProtectedRoute>
        }
      />
      
      <Route
  path="/placement/assessment/:assessmentId"
  element={<ProtectedRoute
    allowedRoles={['student']}>
    <PlacementTakeAssessment />
  </ProtectedRoute>}
/>
<Route
  path="/placement/result/:attemptId"
  element={<ProtectedRoute
    allowedRoles={['student']}>
    <PlacementResult />
  </ProtectedRoute>}
/>



      <Route
        path="/mentor"
        element={
          <ProtectedRoute allowedRoles={['mentor']}>
            <MentorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          user ? (
            <Navigate to={`/${user.role}`} />
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
