import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../config/api';

const MentorDashboard = () => {
  const [assessments, setAssessments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [assessmentAttempts, setAssessmentAttempts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [folders, setFolders] = useState([]);
  const [newAssessment, setNewAssessment] = useState({
    title: '',
    description: '',
    companyName: '',
    folder: '',
    duration: 30,
    totalMarks: 10,
    assessmentType: 'practice'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assessmentsRes, attemptsRes, studentsRes, foldersRes] = await Promise.all([
        api.get('/assessments'),
        api.get('/attempts/all'),
        api.get('/auth/users'),
        api.get('/folders')
      ]);

      setAssessments(assessmentsRes.data.assessments || []);
      setAttempts(attemptsRes.data.attempts || []);
      setFolders(foldersRes.data.folders || []);

      const studentUsers = studentsRes.data.users?.filter(u => u.role === 'student') || [];
      setStudents(studentUsers);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchAssessmentAttempts = async (assessmentId) => {
    try {
      const { data } = await api.get(`/attempts/assessment/${assessmentId}`);
      setAssessmentAttempts(data.attempts || []);
    } catch (error) {
      console.error('Error fetching attempts:', error);
    }
  };

  const handleViewAttempts = (assessment) => {
    setSelectedAssessment(assessment);
    fetchAssessmentAttempts(assessment._id);
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/assessments', {
        ...newAssessment,
        isPractice: newAssessment.assessmentType === 'practice'
      });
      setShowCreateModal(false);
      setNewAssessment({
        title: '',
        description: '',
        companyName: '',
        folder: '',
        duration: 30,
        totalMarks: 10,
        assessmentType: 'practice'
      });
      fetchData();
      alert('Assessment created successfully!');
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert('Error creating assessment');
    }
    setLoading(false);
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-blue-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const stats = {
    totalAssessments: assessments.length,
    totalAttempts: attempts.length,
    totalStudents: students.length,
    avgPerformance: attempts.length > 0
      ? (attempts.reduce((sum, a) => sum + parseFloat(a.percentage || 0), 0) / attempts.length).toFixed(1)
      : 0
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mentor Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor student progress and create assessments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Assessments</p>
                <p className="text-3xl font-bold mt-1">{stats.totalAssessments}</p>
              </div>
              <div className="text-4xl opacity-50">📝</div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Attempts</p>
                <p className="text-3xl font-bold mt-1">{stats.totalAttempts}</p>
              </div>
              <div className="text-4xl opacity-50">✅</div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Students</p>
                <p className="text-3xl font-bold mt-1">{stats.totalStudents}</p>
              </div>
              <div className="text-4xl opacity-50">👥</div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Avg Performance</p>
                <p className="text-3xl font-bold mt-1">{stats.avgPerformance}%</p>
              </div>
              <div className="text-4xl opacity-50">🎯</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Assessments</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              + Create Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessments.map((assessment) => (
              <div key={assessment._id} className="bg-gray-50 p-5 rounded-lg hover:shadow-md transition-all">
                <h3 className="font-semibold text-lg text-gray-900 mb-2">{assessment.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{assessment.companyName}</p>
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">{assessment.duration} mins</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Questions:</span>
                    <span className="font-medium">{assessment.questions?.length || 0}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleViewAttempts(assessment)}
                  className="w-full btn btn-primary text-sm"
                >
                  View Attempts
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent Attempts</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Assessment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attempts.slice(0, 10).map((attempt) => (
                  <tr key={attempt._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {attempt.student?.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {attempt.student?.rollNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attempt.assessment?.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attempt.totalScore}/{attempt.assessment?.totalMarks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-semibold ${getPerformanceColor(attempt.percentage)}`}>
                        {attempt.percentage}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(attempt.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedAssessment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Attempts for {selectedAssessment.title}</h3>
                <button
                  onClick={() => setSelectedAssessment(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {assessmentAttempts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Percentage
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Time Taken
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {assessmentAttempts.map((attempt) => (
                        <tr key={attempt._id}>
                          <td className="px-4 py-3 text-sm">
                            <div>
                              <p className="font-medium">{attempt.student?.name}</p>
                              <p className="text-gray-500 text-xs">{attempt.student?.rollNumber}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {attempt.totalScore}/{selectedAssessment.totalMarks}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-semibold ${getPerformanceColor(attempt.percentage)}`}>
                              {attempt.percentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {attempt.timeTaken ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              attempt.status === 'submitted'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {attempt.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No attempts yet</p>
              )}
            </div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Create Assessment</h3>
              <form onSubmit={handleCreateAssessment} className="space-y-4">
                <div>
                  <label className="label">Title</label>
                  <input
                    type="text"
                    value={newAssessment.title}
                    onChange={(e) => setNewAssessment({ ...newAssessment, title: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Company Name</label>
                  <input
                    type="text"
                    value={newAssessment.companyName}
                    onChange={(e) => setNewAssessment({ ...newAssessment, companyName: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Select Folder</label>
                  <select
                    value={newAssessment.folder}
                    onChange={(e) => setNewAssessment({ ...newAssessment, folder: e.target.value })}
                    className="input"
                  >
                    <option value="">Select a folder</option>
                    {folders.map((folder) => (
                      <option key={folder._id} value={folder._id}>
                        {folder.name} - {folder.companyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Duration (minutes)</label>
                  <input
                    type="number"
                    value={newAssessment.duration}
                    onChange={(e) => setNewAssessment({ ...newAssessment, duration: parseInt(e.target.value) })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Total Marks</label>
                  <input
                    type="number"
                    value={newAssessment.totalMarks}
                    onChange={(e) => setNewAssessment({ ...newAssessment, totalMarks: parseInt(e.target.value) })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Assessment Type</label>
                  <select
                    value={newAssessment.assessmentType}
                    onChange={(e) => setNewAssessment({ ...newAssessment, assessmentType: e.target.value })}
                    className="input"
                  >
                    <option value="practice">Practice</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={newAssessment.description}
                    onChange={(e) => setNewAssessment({ ...newAssessment, description: e.target.value })}
                    className="input"
                    rows="3"
                  />
                </div>
                <div className="flex space-x-3">
                  <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                    {loading ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MentorDashboard;
