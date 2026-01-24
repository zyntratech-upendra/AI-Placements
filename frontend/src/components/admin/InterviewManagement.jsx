import { useState, useEffect } from 'react';
import api from '../../config/api';

const InterviewManagement = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Form states
  const [companyForm, setCompanyForm] = useState({
    name: '',
    description: ''
  });

  const [questionForm, setQuestionForm] = useState({
    title: '',
    category: 'Technical',
    difficulty: 'Medium'
  });

  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // Fetch all companies on mount
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/interview/companies');
      setCompanies(response.data.data || []);
    } catch (err) {
      setError('Failed to fetch companies: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyQuestions = async (companyId) => {
    try {
      setLoading(true);
      setError('');
      let url = `/interview/companies/${companyId}/questions`;
      if (filterCategory) url += `?category=${filterCategory}`;
      if (filterDifficulty) url += `${filterCategory ? '&' : '?'}difficulty=${filterDifficulty}`;

      const response = await api.get(url);
      setQuestions(response.data.data || []);
    } catch (err) {
      setError('Failed to fetch questions: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle company selection
  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setEditingQuestion(null);
    fetchCompanyQuestions(company._id);
  };

  // Handle add company
  const handleAddCompany = () => {
    setEditingCompany(null);
    setCompanyForm({
      name: '',
      description: ''
    });
    setShowCompanyModal(true);
  };

  // Handle edit company
  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      description: company.description
    });
    setShowCompanyModal(true);
  };

  // Handle save company
  const handleSaveCompany = async () => {
    try {
      if (!companyForm.name.trim()) {
        setError('Company name is required');
        return;
      }

      setLoading(true);
      setError('');

      if (editingCompany) {
        // Update existing company
        const response = await api.put(`/interview/companies/${editingCompany._id}`, companyForm);
        setCompanies(companies.map(c => c._id === editingCompany._id ? response.data.data : c));
        setSuccess('Company updated successfully');
      } else {
        // Create new company
        const response = await api.post('/interview/companies', companyForm);
        setCompanies([response.data.data, ...companies]);
        setSuccess('Company created successfully');
      }

      setShowCompanyModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save company: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete company
  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company and all its questions?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.delete(`/interview/companies/${companyId}`);
      setCompanies(companies.filter(c => c._id !== companyId));
      if (selectedCompany?._id === companyId) {
        setSelectedCompany(null);
        setQuestions([]);
      }
      setSuccess('Company deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete company: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle add question
  const handleAddQuestion = () => {
    if (!selectedCompany) {
      setError('Please select a company first');
      return;
    }
    setEditingQuestion(null);
    setQuestionForm({
      title: '',
      category: 'Technical',
      difficulty: 'Medium'
    });
    setShowQuestionModal(true);
  };

  // Handle edit question
  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionForm({
      title: question.title,
      category: question.category,
      difficulty: question.difficulty
    });
    setShowQuestionModal(true);
  };

  // Handle save question
  const handleSaveQuestion = async (closeModal = true) => {
    try {
      if (!questionForm.title.trim()) {
        setError('Question title is required');
        return;
      }

      if (!selectedCompany) {
        setError('Please select a company');
        return;
      }

      setLoading(true);
      setError('');

      const questionData = {
        title: questionForm.title,
        description: questionForm.title,
        category: questionForm.category,
        difficulty: questionForm.difficulty,
        expectedAnswer: '',
        tips: '',
        tags: []
      };

      if (editingQuestion) {
        // Update existing question
        const response = await api.put(`/interview/questions/${editingQuestion._id}`, questionData);
        setQuestions(questions.map(q => q._id === editingQuestion._id ? response.data.data : q));
        setSuccess('Question updated successfully');
        setShowQuestionModal(false);
      } else {
        // Create new question
        const response = await api.post(
          `/interview/companies/${selectedCompany._id}/questions`,
          questionData
        );
        setQuestions([response.data.data, ...questions]);
        setSuccess('Question added successfully');
        
        // Reset form for adding another question if not closing modal
        if (!closeModal) {
          setQuestionForm({
            title: '',
            category: 'Technical',
            difficulty: 'Medium'
          });
        } else {
          setShowQuestionModal(false);
        }
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save question: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete question
  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      await api.delete(`/interview/questions/${questionId}`);
      setQuestions(questions.filter(q => q._id !== questionId));
      setSuccess('Question deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to delete question: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Companies</h3>
              <button
                onClick={handleAddCompany}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
              >
                + Add
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading && !selectedCompany ? (
                <p className="text-gray-500 text-center py-4">Loading...</p>
              ) : companies.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No companies yet</p>
              ) : (
                companies.map(company => (
                  <div
                    key={company._id}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      selectedCompany?._id === company._id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    <div onClick={() => handleSelectCompany(company)}>
                      <p className="font-medium text-gray-900">{company.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {company.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCompany(company);
                        }}
                        className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCompany(company._id);
                        }}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Questions Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            {selectedCompany ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Questions for {selectedCompany.name}
                  </h3>
                  <button
                    onClick={handleAddQuestion}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                  >
                    + Add Question
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <select
                    value={filterCategory}
                    onChange={(e) => {
                      setFilterCategory(e.target.value);
                      if (selectedCompany) fetchCompanyQuestions(selectedCompany._id);
                    }}
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">All Categories</option>
                    <option value="Technical">Technical</option>
                    <option value="HR">HR</option>
                    <option value="Behavioral">Behavioral</option>
                    <option value="Communication">Communication</option>
                    <option value="Problem Solving">Problem Solving</option>
                    <option value="Other">Other</option>
                  </select>

                  <select
                    value={filterDifficulty}
                    onChange={(e) => {
                      setFilterDifficulty(e.target.value);
                      if (selectedCompany) fetchCompanyQuestions(selectedCompany._id);
                    }}
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">All Difficulties</option>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                {/* Questions List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loading ? (
                    <p className="text-gray-500 text-center py-4">Loading questions...</p>
                  ) : questions.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No questions for this company</p>
                  ) : (
                    questions.map(question => (
                      <div key={question._id} className="border border-gray-200 rounded p-4 hover:border-blue-400">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{question.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{question.description}</p>
                          </div>
                          <div className="flex gap-2 ml-3">
                            <button
                              onClick={() => handleEditQuestion(question)}
                              className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(question._id)}
                              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {question.category}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            {question.difficulty}
                          </span>
                          {question.tags.map(tag => (
                            <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>

                        {question.expectedAnswer && (
                          <div className="mt-2 text-xs text-gray-600">
                            <strong>Expected Answer:</strong> {question.expectedAnswer}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Select a company to view its questions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCompany ? 'Edit Company' : 'Add New Company'}
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  placeholder="e.g., Google, Microsoft, Amazon"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={companyForm.description}
                  onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                  placeholder="Company description..."
                  rows="3"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>


            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCompanyModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCompany}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Question Title *
                </label>
                <input
                  type="text"
                  value={questionForm.title}
                  onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                  placeholder="e.g., What is React?"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="Technical">Technical</option>
                    <option value="HR">HR</option>
                    <option value="Behavioral">Behavioral</option>
                    <option value="Communication">Communication</option>
                    <option value="Problem Solving">Problem Solving</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={questionForm.difficulty}
                    onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>


            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowQuestionModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded font-medium"
              >
                Close
              </button>
              {!editingQuestion && (
                <button
                  onClick={() => handleSaveQuestion(false)}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Add & Continue'}
                </button>
              )}
              <button
                onClick={() => handleSaveQuestion(true)}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingQuestion ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewManagement;
