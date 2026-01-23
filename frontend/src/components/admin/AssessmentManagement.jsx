import { useState, useEffect } from 'react';
import api from '../../config/api';

const AssessmentManagement = () => {
  const [assessments, setAssessments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [students, setStudents] = useState([]);
  
  // Hierarchical folder selection states
  const [companies, setCompanies] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [difficultyFolders, setDifficultyFolders] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedSubfolder, setSelectedSubfolder] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [assignToAllStudents, setAssignToAllStudents] = useState(false);
  
  const [newAssessment, setNewAssessment] = useState({
    title: '',
    description: '',
    companyName: '',
    folder: '',
    duration: 30,
    totalMarks: 10,
    assessmentType: 'practice',
    allowedStudents: []
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAssessments();
    fetchCompanies();
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/auth/users?role=student');
      setStudents(data.users || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
    }
  };

  const fetchAssessments = async () => {
    try {
      const { data } = await api.get('/assessments');
      setAssessments(data.assessments || []);
    } catch (error) {
      console.error('Error fetching assessments:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data } = await api.get('/folders');
      // Get only company-level folders (no parent)
      const companyFolders = data.folders?.filter(f => !f.parentFolderId) || [];
      setCompanies(companyFolders);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleCompanySelect = async (companyId) => {
    setSelectedCompany(companyId);
    setSelectedTopic('');
    setSelectedSubfolder('');
    setSelectedDifficulty('');
    setTopics([]);
    setSubfolders([]);
    setDifficultyFolders([]);
    setAvailableQuestions([]);
    setNewAssessment({ ...newAssessment, folder: '', companyName: '' });

    if (!companyId) return;

    try {
      const { data } = await api.get('/folders');
      // Get topics (children of selected company)
      const topicFolders = data.folders?.filter(f => f.parentFolderId === companyId) || [];
      setTopics(topicFolders);
      
      // Set company name in assessment
      const company = companies.find(c => c._id === companyId);
      setNewAssessment(prev => ({ ...prev, companyName: company?.name || '' }));
    } catch (error) {
      console.error('Error fetching topics:', error);
    }
  };

  const handleTopicSelect = async (topicId) => {
    setSelectedTopic(topicId);
    setSelectedSubfolder('');
    setSelectedDifficulty('');
    setSubfolders([]);
    setDifficultyFolders([]);
    setAvailableQuestions([]);
    setNewAssessment({ ...newAssessment, folder: '' });

    if (!topicId) return;

    try {
      const { data } = await api.get('/folders');
      // Get subfolders (children of selected topic)
      const subfolds = data.folders?.filter(f => f.parentFolderId === topicId) || [];
      setSubfolders(subfolds);
    } catch (error) {
      console.error('Error fetching subfolders:', error);
    }
  };

  const handleSubfolderSelect = async (subfolderId) => {
    setSelectedSubfolder(subfolderId);
    setSelectedDifficulty('');
    setDifficultyFolders([]);
    setAvailableQuestions([]);
    setNewAssessment({ ...newAssessment, folder: '' });

    if (!subfolderId) return;

    try {
      const { data } = await api.get('/folders');
      // Get difficulty folders (children of selected subfolder)
      const diffFolds = data.folders?.filter(f => f.parentFolderId === subfolderId) || [];
      setDifficultyFolders(diffFolds);
    } catch (error) {
      console.error('Error fetching difficulty folders:', error);
    }
  };

  const handleDifficultySelect = async (difficultyId) => {
    setSelectedDifficulty(difficultyId);
    setNewAssessment({ ...newAssessment, folder: difficultyId });
    
    if (!difficultyId) return;

    try {
      // Fetch parsed questions for this difficulty folder
      const { data } = await api.get(`/files/parsed-questions/${difficultyId}`);
      if (data.parsedQuestions && data.parsedQuestions.questionsByDifficulty) {
        // Get the difficulty level from the selected folder
        const diffFolder = difficultyFolders.find(f => f._id === difficultyId);
        const difficulty = diffFolder?.name || 'Easy';
        const questions = data.parsedQuestions.questionsByDifficulty[difficulty] || [];
        setAvailableQuestions(questions);
        setNewAssessment(prev => ({
          ...prev,
          totalMarks: Math.max(prev.totalMarks, questions.length)
        }));
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      setAvailableQuestions([]);
    }
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    
    // 🔹 VALIDATION: Admin-created assessments MUST have allowed students
    if (newAssessment.assessmentType !== 'random' && !assignToAllStudents && selectedStudents.length === 0) {
      alert('Please select at least one student or choose "Allow All Students"');
      return;
    }

    setLoading(true);
    try {
      const assessmentData = {
        ...newAssessment,
        folder: selectedDifficulty,
        allowedStudents: assignToAllStudents ? students.map(s => s._id) : selectedStudents,
        isPractice: newAssessment.assessmentType === 'practice',
        questions: availableQuestions.map(q => ({
          id: q.questionId,
          text: q.questionText || q.text,
          options: q.options,
          answer: q.correctAnswer || q.answer,
          difficulty: q.difficulty,
          topic: q.topic,
          explanation: q.explanation || null,
          section: q.section || 'General'
        }))
      };
      
      const { data: responseData } = await api.post('/assessments', assessmentData);
      
      // Update assessments list immediately with new assessment
      if (responseData.assessment) {
        setAssessments(prev => [...prev, responseData.assessment]);
      }
      
      setShowCreateModal(false);
      resetAssessmentForm();
      alert('Assessment created successfully!');
    } catch (error) {
      console.error('Error creating assessment:', error);
      alert(error.response?.data?.message || 'Error creating assessment');
    }
    setLoading(false);
  };

  const resetAssessmentForm = () => {
    setNewAssessment({
      title: '',
      description: '',
      companyName: '',
      folder: '',
      duration: 30,
      totalMarks: 10,
      assessmentType: 'practice',
      allowedStudents: []
    });
    setSelectedCompany('');
    setSelectedTopic('');
    setSelectedSubfolder('');
    setSelectedDifficulty('');
    setSelectedStudents([]);
    setAssignToAllStudents(false);
    setCompanies([]);
    setTopics([]);
    setSubfolders([]);
    setDifficultyFolders([]);
    setAvailableQuestions([]);
  };

  const viewAttempts = async (assessment) => {
    setSelectedAssessment(assessment);
    try {
      const { data } = await api.get(`/attempts/assessment/${assessment._id}`);
      setAttempts(data.attempts || []);
    } catch (error) {
      console.error('Error fetching attempts:', error);
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700';
      case 'practice':
        return 'bg-green-100 text-green-700';
      case 'random':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Assessment Management</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + Create Assessment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assessments.map((assessment) => (
          <div key={assessment._id} className="card">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-lg text-gray-900">{assessment.title}</h3>
              <span className={`px-2 py-1 text-xs rounded-full ${getTypeBadgeColor(assessment.assessmentType)}`}>
                {assessment.assessmentType}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{assessment.companyName}</p>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">{assessment.duration} mins</span>
              </div>
              <div className="flex justify-between">
                <span>Total Marks:</span>
                <span className="font-medium">{assessment.totalMarks}</span>
              </div>
              <div className="flex justify-between">
                <span>Questions:</span>
                <span className="font-medium">{assessment.questions?.length || 0}</span>
              </div>
            </div>
            <button
              onClick={() => viewAttempts(assessment)}
              className="mt-4 w-full btn btn-secondary text-sm"
            >
              View Attempts
            </button>
          </div>
        ))}
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

            {attempts.length > 0 ? (
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
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Time Taken
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attempts.map((attempt) => (
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
                          {attempt.percentage}%
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
                        <td className="px-4 py-3 text-sm">
                          {attempt.timeTaken ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s` : '-'}
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
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Assessment</h3>
            <form onSubmit={handleCreateAssessment} className="space-y-4">
              {/* Assessment Details */}
              <div className="border-b pb-4">
                <h4 className="font-semibold text-gray-700 mb-3">Assessment Details</h4>
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="label">Assessment Type</label>
                    <select
                      value={newAssessment.assessmentType}
                      onChange={(e) => setNewAssessment({ ...newAssessment, assessmentType: e.target.value })}
                      className="input"
                    >
                      <option value="practice">Practice</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="random">Random</option>
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
                  <div className="col-span-2">
                    <label className="label">Description</label>
                    <textarea
                      value={newAssessment.description}
                      onChange={(e) => setNewAssessment({ ...newAssessment, description: e.target.value })}
                      className="input"
                      rows="3"
                    />
                  </div>
                </div>
              </div>

              {/* Hierarchical Folder Selection */}
              <div className="border-b pb-4">
                <h4 className="font-semibold text-gray-700 mb-3">Select Questions From</h4>
                
                {/* Company Selection */}
                <div className="mb-4">
                  <label className="label">1. Company</label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => handleCompanySelect(e.target.value)}
                    className="input"
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topic Selection */}
                {selectedCompany && (
                  <div className="mb-4">
                    <label className="label">2. Topic</label>
                    <select
                      value={selectedTopic}
                      onChange={(e) => handleTopicSelect(e.target.value)}
                      className="input"
                    >
                      <option value="">-- Select Topic --</option>
                      {topics.map((topic) => (
                        <option key={topic._id} value={topic._id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Subfolder Selection */}
                {selectedTopic && (
                  <div className="mb-4">
                    <label className="label">3. Subfolder</label>
                    <select
                      value={selectedSubfolder}
                      onChange={(e) => handleSubfolderSelect(e.target.value)}
                      className="input"
                    >
                      <option value="">-- Select Subfolder --</option>
                      {subfolders.map((subfolder) => (
                        <option key={subfolder._id} value={subfolder._id}>
                          {subfolder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Difficulty Selection */}
                {selectedSubfolder && (
                  <div className="mb-4">
                    <label className="label">4. Difficulty Level</label>
                    <select
                      value={selectedDifficulty}
                      onChange={(e) => handleDifficultySelect(e.target.value)}
                      className="input"
                    >
                      <option value="">-- Select Difficulty --</option>
                      {difficultyFolders.map((difficulty) => (
                        <option key={difficulty._id} value={difficulty._id}>
                          {difficulty.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Questions Summary */}
              {availableQuestions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>{availableQuestions.length}</strong> questions available from selected difficulty level
                  </p>
                </div>
              )}

              {/* 🔹 Allowed Students Selection */}
              <div className="border-b pb-4">
                <h4 className="font-semibold text-gray-700 mb-3">
                  Assign to Students {newAssessment.assessmentType !== 'random' && <span className="text-red-500">*</span>}
                </h4>
                {newAssessment.assessmentType === 'random' ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800">
                      ℹ️ Random assessments are auto-assigned to students who generate them
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Toggle buttons */}
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignToAllStudents(false);
                          setSelectedStudents([]);
                        }}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          !assignToAllStudents
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Select Students
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignToAllStudents(true)}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                          assignToAllStudents
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Allow All Students
                      </button>
                    </div>

                    {/* Display selected mode */}
                    {assignToAllStudents ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-800">
                          ✓ This assessment will be available to all {students.length} student{students.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                          {students.length > 0 ? (
                            students.map((student) => (
                              <label key={student._id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedStudents.includes(student._id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStudents([...selectedStudents, student._id]);
                                    } else {
                                      setSelectedStudents(selectedStudents.filter(id => id !== student._id));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="ml-3 text-sm text-gray-700">
                                  {student.name} <span className="text-gray-500">({student.email})</span>
                                </span>
                              </label>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500">No students found</p>
                          )}
                        </div>
                        {selectedStudents.length > 0 && (
                          <div className="mt-2 text-sm text-blue-600">
                            ✓ {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex space-x-3">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1" 
                  disabled={loading || !selectedDifficulty || !newAssessment.title}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetAssessmentForm();
                  }}
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
  );

};

export default AssessmentManagement;
