import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../config/api';
import aiApi from '../config/aiapi';
import JobPortal from '../components/JobPortal';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const StudentDashboard = () => {
  // Core state
  const [assessments, setAssessments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [folders, setFolders] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Random practice state
  const [randomMode, setRandomMode] = useState('FULL');
  const [companies, setCompanies] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedSubtopic, setSelectedSubtopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedCompanyName, setSelectedCompanyName] = useState('');
  const [selectedTopicName, setSelectedTopicName] = useState('');
  const [selectedSubtopicName, setSelectedSubtopicName] = useState('');
  const [selectedDifficultyName, setSelectedDifficultyName] = useState('');

  // Placement exam state
  const [placementCompanies, setPlacementCompanies] = useState([]);
  const [placementFormats, setPlacementFormats] = useState([]);
  const [selectedPlacementCompany, setSelectedPlacementCompany] = useState('');
  const [startingExam, setStartingExam] = useState(false);

  // Adaptive Learning state
  const [recommendations, setRecommendations] = useState([]);
  const [generatingAssessment, setGeneratingAssessment] = useState(null); // Stores ID of item being generated

  // Targeted Assessments Grouped by Exam
  const [targetedAssessmentsGrouped, setTargetedAssessmentsGrouped] = useState([]);
  const [expandedExam, setExpandedExam] = useState(null); // Track which exam is expanded

  // LLM Recommendations state
  const [llmRecommendations, setLlmRecommendations] = useState(null);
  const [loadingLlmRecs, setLoadingLlmRecs] = useState(false);

  // Progress Visualization State (Phase 7)
  const [progressData, setProgressData] = useState([]);
  const [progressStats, setProgressStats] = useState(null);

  // Resume Assessment State
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [extractedTopics, setExtractedTopics] = useState([]);
  const [generatedAssessments, setGeneratedAssessments] = useState([]);  // NEW: Store generated assessments
  const [generatingResumeAssessment, setGeneratingResumeAssessment] = useState(false);
  const [resumeProcessing, setResumeProcessing] = useState(false);

  // Stats
  const [stats, setStats] = useState({ totalAttempts: 0, avgScore: 0, completedAssessments: 0 });
  const [interviewStats, setInterviewStats] = useState({ total: 0, completed: 0, avgScore: 0 });

  // Active tab for sections
  const [activeTab, setActiveTab] = useState('overview');

  const navigate = useNavigate();

  useEffect(() => {
    fetchAllData();
    fetchLearningProgress(); // Phase 7
    fetchGeneratedResumeAssessments();  // NEW: Load previously generated assessments
  }, []);

  const fetchLearningProgress = async () => {
    try {
      const { data } = await api.get('/weak-areas/analysis/progress');
      if (data.success) {
        setProgressData(data.progressData);
        setProgressStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch learning progress:', error);
    }
  };

  const fetchTargetedAssessmentsGrouped = async () => {
    try {
      const { data } = await api.get('/targeted-assessments/grouped-by-exam');
      if (data.success) {
        setTargetedAssessmentsGrouped(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch grouped targeted assessments:', error);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchData(), fetchPlacementCompanies(), fetchRecommendations(), fetchTargetedAssessmentsGrouped()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [assessmentsRes, attemptsRes, foldersRes, interviewsRes] = await Promise.all([
        api.get('/assessments'),
        api.get('/attempts/my-attempts'),
        api.get('/folders'),
        aiApi.get('/my-sessions')
      ]);

      setAssessments(assessmentsRes.data.assessments || []);
      setAttempts(attemptsRes.data.attempts || []);
      setFolders(foldersRes.data.folders || []);
      setCompanies(foldersRes.data.folders?.filter(f => !f.parentFolderId) || []);
      
      const myAttempts = attemptsRes.data.attempts || [];
      const completed = myAttempts.filter(a => a.status === 'submitted');
      const avgScore = completed.length > 0 
        ? completed.reduce((sum, a) => sum + parseFloat(a.percentage || 0), 0) / completed.length 
        : 0;

      setStats({
        totalAttempts: myAttempts.length,
        avgScore: avgScore.toFixed(1),
        completedAssessments: completed.length
      });

      const myInterviews = interviewsRes.data.sessions || [];
      setInterviews(myInterviews);
      
      const completedInterviews = myInterviews.filter(i => i.status === 'completed');
      const avgInterviewScore = completedInterviews.length > 0 
        ? completedInterviews.reduce((s, i) => s + (i.final_score || 0), 0) / completedInterviews.length 
        : 0;

      setInterviewStats({
        total: myInterviews.length,
        completed: completedInterviews.length,
        avgScore: avgInterviewScore.toFixed(1)
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const { data } = await api.get('/targeted-assessments/recommendations');
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  // NEW: Fetch previously generated resume-based assessments
  const fetchGeneratedResumeAssessments = async () => {
    try {
      const { data } = await api.get('/resume-assessments/my-assessments');
      if (data.success) {
        setGeneratedAssessments(data.assessments || []);
      }
    } catch (error) {
      console.error('Error fetching generated assessments:', error);
    }
  };

  const generateTargetedAssessment = async (company, topic = null) => {
    try {
      const loadingId = topic ? `${company}-${topic}` : company;
      setGeneratingAssessment(loadingId);
      const { data } = await api.post(`/targeted-assessments/generate/${company}`, { topic });
      if (data.success) {
        // Targeted assessments are 'practice' type, not 'placement'
        // So use /student/assessment/ route, not /placement/assessment/
        navigate(`/student/assessment/${data.assessment._id}`);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to generate assessment');
    } finally {
      setGeneratingAssessment(null);
    }
  };

  const fetchPlacementCompanies = async () => {
    try {
      const { data } = await api.get('/placement-exams/companies');
      setPlacementCompanies(data.companies || []);
    } catch (error) {
      console.error('Error fetching placement companies:', error);
    }
  };

  const handleCompanySelect = async (company) => {
    setSelectedPlacementCompany(company);
    try {
      // Correct endpoint: /api/placement-exams/:company
      const { data } = await api.get(`/placement-exams/${company}`);
      setPlacementFormats(data.formats || []);
    } catch (error) {
      console.error('Error fetching formats:', error);
    }
  };

  const startPlacementExam = async (formatId) => {
    try {
      setStartingExam(true);
      // formatId should be in body, not URL
      const { data } = await api.post('/student/placement-exam/start', { formatId });
      // Response is { success: true, assessment: {...} }
      navigate(`/placement/assessment/${data.assessment._id}`);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to start exam');
    } finally {
      setStartingExam(false);
    }
  };

  // Fetch LLM recommendations based on interview history
  const fetchLlmRecommendations = async () => {
    if (interviews.length === 0) {
      alert('Complete at least one AI interview to get recommendations!');
      return;
    }
    
    try {
      setLoadingLlmRecs(true);
      // Get the latest completed interview for feedback
      const latestInterview = interviews[0];
      
      const { data } = await aiApi.post('/recommendations/interview', {
        interview_feedback: {
          final_score: latestInterview.final_score || 5,
          feedback_summary: latestInterview.feedback || 'Interview completed',
          weak_areas: latestInterview.weak_areas || ['General improvement needed'],
          strong_areas: latestInterview.strong_areas || []
        },
        interview_type: latestInterview.interview_type || 'technical'
      });
      
      if (data.success) {
        setLlmRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching LLM recommendations:', error);
      alert('Failed to get recommendations. Try again later.');
    } finally {
      setLoadingLlmRecs(false);
    }
  };

  // Dropdown cascade handlers
  const handleCompanyChange = async (e) => {
    const folderId = e.target.value;
    const folder = companies.find(f => f._id === folderId);
    setSelectedCompany(folderId);
    setSelectedCompanyName(folder?.name || '');
    setSelectedTopic(''); setSelectedSubtopic(''); setSelectedDifficulty('');
    
    try {
      const { data } = await api.get(`/folders?parentFolderId=${folderId}`);
      setTopics(data.folders || []);
      setSubtopics([]); setDifficulties([]);
    } catch {}
  };

  const handleTopicChange = async (e) => {
    const folderId = e.target.value;
    const folder = topics.find(f => f._id === folderId);
    setSelectedTopic(folderId);
    setSelectedTopicName(folder?.name || '');
    setSelectedSubtopic(''); setSelectedDifficulty('');
    
    try {
      const { data } = await api.get(`/folders?parentFolderId=${folderId}`);
      setSubtopics(data.folders || []);
      setDifficulties([]);
    } catch {}
  };

  const handleSubtopicChange = async (e) => {
    const folderId = e.target.value;
    const folder = subtopics.find(f => f._id === folderId);
    setSelectedSubtopic(folderId);
    setSelectedSubtopicName(folder?.name || '');
    setSelectedDifficulty('');
    
    try {
      const { data } = await api.get(`/folders?parentFolderId=${folderId}`);
      setDifficulties(data.folders || []);
    } catch {}
  };

  const handleDifficultyChange = (e) => {
    const folderId = e.target.value;
    const folder = difficulties.find(f => f._id === folderId);
    setSelectedDifficulty(folderId);
    setSelectedDifficultyName(folder?.name || '');
  };

  const startRandomPractice = async () => {
    try {
      const payload = randomMode === 'FULL' 
        ? { mode: 'FULL', company: selectedCompanyName, numberOfQuestions: 10, duration: 30 }
        : { mode: 'TOPIC', company: selectedCompanyName, topic: selectedTopicName, subtopic: selectedSubtopicName, difficulty: selectedDifficultyName, numberOfQuestions: 10, duration: 30 };
      
      const { data } = await api.post('/assessments/random', payload);
      // Random assessments are 'random' type, use /student/assessment/
      navigate(`/student/assessment/${data.assessment._id}`);
    } catch {
      alert('Not enough questions available');
    }
  };

  // Regular assessments (scheduled, practice) use /student/assessment/
  const startAssessment = (assessmentId) => navigate(`/student/assessment/${assessmentId}`);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex h-full gap-0">
          
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0 h-full overflow-y-auto bg-white shadow-lg">
            <div className="p-6 sticky top-0">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Menu</h3>
              <nav className="space-y-1">
                {[
                  { id: 'overview', label: '📊 Overview', icon: '📊' },
                  { id: 'practice', label: '🎯 Practice', icon: '🎯' },
                  { id: 'resume', label: '📄 Resume Based Exam', icon: '📄' },
                  { id: 'exams', label: '📝 Exams', icon: '📝' },
                  { id: 'targeted', label: '🎪 Targeted', icon: '🎪' },
                  { id: 'interviews', label: '🤖 AI Interviews', icon: '🤖' },
                  { id: 'jobs', label: '💼 Jobs', icon: '💼' },
                  { id: 'progress', label: '📊 My Progress', icon: '📊' },
                  { id: 'history', label: '📈 History', icon: '📈' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full px-3 py-2 rounded-lg font-medium transition-all text-left flex items-center gap-2 text-sm ${
                      activeTab === tab.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">{tab.icon}</span>
                    <span>{tab.label.split(' ').slice(1).join(' ')}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50">
            <div className="max-w-6xl mx-auto px-8 py-6 h-full">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-lg p-6 text-white shadow-xl mb-6">
              <h1 className="text-2xl font-bold">Welcome back! 👋</h1>
              <p className="text-blue-100 mt-1">Ready to level up your skills today?</p>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <p className="text-blue-200 text-xs">Total Attempts</p>
                  <p className="text-2xl font-bold">{stats.totalAttempts}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <p className="text-blue-200 text-xs">Avg Score</p>
                  <p className="text-2xl font-bold">{stats.avgScore}%</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <p className="text-blue-200 text-xs">AI Interviews</p>
                  <p className="text-2xl font-bold">{interviewStats.total}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                  <p className="text-blue-200 text-xs">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedAssessments}</p>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="space-y-6">
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Recommendations Alert */}
                {recommendations.length > 0 && (
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">⚠️</span>
                      <div>
                        <h3 className="text-xl font-bold">Areas That Need Improvement</h3>
                        <p className="text-orange-100">Based on your recent placement exams</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      {recommendations.slice(0, 2).map((rec, idx) => (
                        <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{rec.topic || rec.company}</h4>
                              <p className="text-xs text-orange-200">{rec.company}</p>
                            </div>
                            <span className="bg-white/20 px-2 py-1 rounded text-xs">
                              {rec.difficulty || 'Easy'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-3 text-sm">
                            {rec.improvementPercentage > 0 ? (
                              <>
                                <span className="bg-green-500/20 text-green-100 px-2 py-0.5 rounded font-medium">
                                  Current: {rec.lastPracticeScore}%
                                </span>
                                <span className="text-green-300 text-xs">+{rec.improvementPercentage}%</span>
                              </>
                            ) : (
                               <span className="text-orange-100">Score: {rec.overallPercentage}%</span>
                            )}
                          </div>
                          {rec.hasActiveAssessment ? (
                            <button
                              onClick={() => navigate(`/student/assessment/${rec.activeAssessmentId}`)}
                              className="w-full bg-white text-green-600 font-semibold py-2 rounded-lg hover:bg-green-50 transition"
                            >
                              ▶ Continue Practice
                            </button>
                          ) : rec.canGenerateAssessment ? (
                            <button
                              onClick={() => generateTargetedAssessment(rec.company)}
                              disabled={generatingAssessment}
                              className="w-full bg-white text-orange-600 font-semibold py-2 rounded-lg hover:bg-orange-50 transition disabled:opacity-50"
                            >
                              {generatingAssessment ? '...' : '📝 Start Targeted Practice'}
                            </button>
                          ) : (
                            <span className="text-xs text-orange-200">Assessment completed</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="grid md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('practice')}
                    className="bg-white rounded-2xl p-6 text-left hover:shadow-lg transition group"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">
                      🎯
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">Random Practice</h3>
                    <p className="text-gray-500 text-sm">Practice with random questions</p>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('exams')}
                    className="bg-white rounded-2xl p-6 text-left hover:shadow-lg transition group"
                  >
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">
                      📝
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">Placement Exams</h3>
                    <p className="text-gray-500 text-sm">Take company-specific exams</p>
                  </button>
                  
                  <button
                    onClick={() => navigate('/interview')}
                    className="bg-white rounded-2xl p-6 text-left hover:shadow-lg transition group"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition">
                      🤖
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">AI Interview</h3>
                    <p className="text-gray-500 text-sm">Practice with AI interviewer</p>
                  </button>
                </div>

                {/* Available Assessments */}
                {assessments.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">📚 Available Assessments</h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {assessments.slice(0, 6).map(assessment => (
                        <div key={assessment._id} className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-md transition">
                          <h4 className="font-semibold text-gray-900">{assessment.title}</h4>
                          <p className="text-sm text-gray-500 mb-3">{assessment.companyName}</p>
                          <button
                            onClick={() => startAssessment(assessment._id)}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                          >
                            Start
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Practice Tab */}
            {activeTab === 'practice' && (
              <div className="space-y-6">
                {/* Targeted Practice - Needs Improvement */}
                {recommendations.length > 0 && (
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">🎯</span>
                      <div>
                        <h3 className="text-xl font-bold">Needs Improvement</h3>
                        <p className="text-orange-100">Practice these weak areas to improve your score</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {recommendations.map((rec, idx) => (
                        <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{rec.topic || rec.company}</h4>
                              <p className="text-xs text-orange-200">{rec.company}</p>
                            </div>
                            <span className="bg-white/20 px-2 py-1 rounded text-xs">
                              {rec.difficulty}
                            </span>
                          </div>
                          <div className="mb-2">
                             {rec.improvementPercentage > 0 ? (
                               <div className="flex items-center gap-2">
                                 <span className="text-sm font-bold text-white">{rec.lastPracticeScore}%</span>
                                 <span className="text-xs bg-green-500/30 text-green-100 px-1.5 py-0.5 rounded">+{rec.improvementPercentage}%</span>
                               </div>
                             ) : (
                               <p className="text-sm text-orange-100">Score: {rec.overallPercentage}%</p>
                             )}
                          </div>
                          {/* Subtopics */}
                          {rec.subtopics?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {rec.subtopics.slice(0, 3).map((st, i) => (
                                <span key={i} className="text-xs bg-white/20 px-2 py-0.5 rounded">
                                  {st}
                                </span>
                              ))}
                            </div>
                          )}
                          {rec.attemptedQuestionCount > 0 && (
                            <p className="text-xs text-orange-200 mb-2">
                              {rec.attemptedQuestionCount} questions attempted
                            </p>
                          )}
                          {rec.hasActiveAssessment ? (
                            <button
                              onClick={() => navigate(`/student/assessment/${rec.activeAssessmentId}`)}
                              className="w-full bg-white text-green-600 font-semibold py-2 rounded-lg hover:bg-green-50 transition"
                            >
                              ▶ Continue Practice
                            </button>
                          ) : rec.canGenerateAssessment ? (
                            <button
                              onClick={() => generateTargetedAssessment(rec.company, rec.topic)}
                              disabled={generatingAssessment === (rec.topic ? `${rec.company}-${rec.topic}` : rec.company)}
                              className="w-full bg-white text-orange-600 font-semibold py-2 rounded-lg hover:bg-orange-50 transition disabled:opacity-50"
                            >
                              {generatingAssessment === (rec.topic ? `${rec.company}-${rec.topic}` : rec.company) ? 'Creating...' : '📝 Practice Now'}
                            </button>
                          ) : (
                            <span className="block text-center text-xs text-orange-200 py-2">✓ Completed</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Random Practice */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">🎲 Random Practice</h3>
                
                {/* Mode Toggle */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => setRandomMode('FULL')}
                    className={`flex-1 py-3 rounded-xl font-medium transition ${
                      randomMode === 'FULL' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Full Company Practice
                  </button>
                  <button
                    onClick={() => setRandomMode('TOPIC')}
                    className={`flex-1 py-3 rounded-xl font-medium transition ${
                      randomMode === 'TOPIC' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Topic-wise Practice
                  </button>
                </div>

                {/* Dropdowns */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                    <select
                      value={selectedCompany}
                      onChange={handleCompanyChange}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Company</option>
                      {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  
                  {randomMode === 'TOPIC' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                        <select
                          value={selectedTopic}
                          onChange={handleTopicChange}
                          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                          disabled={!selectedCompany}
                        >
                          <option value="">Select Topic</option>
                          {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subtopic</label>
                        <select
                          value={selectedSubtopic}
                          onChange={handleSubtopicChange}
                          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                          disabled={!selectedTopic}
                        >
                          <option value="">Select Subtopic</option>
                          {subtopics.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                        <select
                          value={selectedDifficulty}
                          onChange={handleDifficultyChange}
                          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                          disabled={!selectedSubtopic}
                        >
                          <option value="">Select Difficulty</option>
                          {difficulties.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={startRandomPractice}
                  disabled={!selectedCompany || (randomMode === 'TOPIC' && !selectedDifficulty)}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🚀 Start Practice
                </button>
              </div>
              </div>
            )}

            {/* Resume Builder Tab */}
            {activeTab === 'resume' && (
              <div className="space-y-6">
                {/* Upload Section */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">📄</span>
                    <div>
                      <h3 className="text-xl font-bold">Resume-Based Assessment</h3>
                      <p className="text-emerald-200 text-sm">Upload your resume and paste a job description to generate a personalized test</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Resume Upload */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                      <label className="block text-sm font-medium text-emerald-100 mb-2">Resume (PDF)</label>
                      <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setResumeFile(e.target.files[0])}
                          className="hidden"
                          id="resume-upload"
                        />
                        <label htmlFor="resume-upload" className="cursor-pointer">
                          {resumeFile ? (
                            <div className="text-emerald-100">
                              <span className="text-2xl">✅</span>
                              <p className="mt-1 font-medium">{resumeFile.name}</p>
                            </div>
                          ) : (
                            <div className="text-emerald-200">
                              <span className="text-2xl">📤</span>
                              <p className="mt-1">Click to upload PDF</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Job Description */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                      <label className="block text-sm font-medium text-emerald-100 mb-2">Job Description</label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the job description here..."
                        rows={4}
                        className="w-full p-3 rounded-lg bg-white/20 border border-white/20 text-white placeholder-emerald-200 focus:ring-2 focus:ring-white/50"
                      />
                    </div>
                  </div>

                  {/* Extract Topics Button */}
                  <button
                    onClick={async () => {
                      if (!resumeFile || !jobDescription.trim()) {
                        alert('Please upload resume and enter job description');
                        return;
                      }
                      setResumeProcessing(true);
                      try {
                        const formData = new FormData();
                        formData.append('resume', resumeFile);
                        formData.append('job_description', jobDescription);
                        
                        const response = await aiApi.post('/resume-assessment/extract-topics', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        
                        if (response.data.success) {
                          setExtractedTopics(response.data.topics);
                        } else {
                          alert('Failed to extract topics');
                        }
                      } catch (err) {
                        console.error('Error:', err);
                        alert(err.response?.data?.detail || 'Failed to analyze resume');
                      } finally {
                        setResumeProcessing(false);
                      }
                    }}
                    disabled={!resumeFile || !jobDescription.trim() || resumeProcessing}
                    className="w-full mt-4 bg-white text-emerald-600 font-semibold py-3 rounded-xl hover:bg-emerald-50 transition disabled:opacity-50"
                  >
                    {resumeProcessing ? '🔍 Analyzing Resume...' : '🎯 Analyze & Find Topics'}
                  </button>
                </div>

                {/* Extracted Topics */}
                {extractedTopics.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Topics to Test</h3>
                    <div className="grid md:grid-cols-2 gap-3 mb-6">
                      {extractedTopics.map((topic, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                          <div>
                            <p className="font-medium text-emerald-800">{topic.name}</p>
                            {topic.subtopic && <p className="text-xs text-emerald-600">{topic.subtopic}</p>}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            topic.difficulty === 'Hard' ? 'bg-red-100 text-red-700' :
                            topic.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {topic.difficulty}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Generate Assessment Button */}
                    <button
                      onClick={async () => {
                        setGeneratingResumeAssessment(true);
                        try {
                          const response = await api.post('/resume-assessments/generate', {
                            topics: extractedTopics,
                            jobTitle: extractedTopics[0]?.name || 'Custom',
                            duration: 10
                          });
                          
                          if (response.data.success) {
                            setGeneratedAssessments(response.data.assessments);  // Store multiple assessments
                          }
                        } catch (err) {
                          console.error('Error:', err);
                          alert(err.response?.data?.message || 'Failed to generate assessment');
                        } finally {
                          setGeneratingResumeAssessment(false);
                        }
                      }}
                      disabled={generatingResumeAssessment}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-4 rounded-xl hover:shadow-lg transition disabled:opacity-50"
                    >
                      {generatingResumeAssessment ? '⏳ Creating Assessments...' : '🚀 Generate Topic-wise Assessments'}
                    </button>
                  </div>
                )}

                {/* Generated Assessments List */}
                {generatedAssessments.length > 0 && (
                  <div className="space-y-6">
                    {/* Exams to be Written */}
                    {(() => {
                      const toBeWritten = generatedAssessments.filter(a => !a.attemptedStatus || a.attemptedStatus === 'not-started' || a.attemptedStatus === 'in-progress');
                      return toBeWritten.length > 0 ? (
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                          <h3 className="text-lg font-bold text-gray-900 mb-4">📝 Exams to be Written</h3>
                          <div className="space-y-3">
                            {toBeWritten.map((assessment, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                    {assessment.topic.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900">{assessment.topic}</h4>
                                    <div className="flex items-center gap-3 mt-1 text-sm">
                                      <span className="text-gray-600">⏱ {assessment.duration} mins</span>
                                      <span className="text-gray-600">·</span>
                                      <span className="text-gray-600">📝 {assessment.questionCount} questions</span>
                                      <span className="text-gray-600">·</span>
                                      <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                                        assessment.difficulty === 'Hard' ? 'bg-red-100 text-red-700' :
                                        assessment.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-green-100 text-green-700'
                                      }`}>
                                        {assessment.difficulty}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <button
                                  onClick={() => startAssessment(assessment._id)}
                                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-semibold"
                                >
                                  Start Exam →
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Completed Exams */}
                    {(() => {
                      const completed = generatedAssessments.filter(a => a.attemptedStatus === 'submitted' || a.attemptedStatus === 'completed');
                      return completed.length > 0 ? (
                        <div className="bg-white rounded-2xl p-6 shadow-sm">
                          <h3 className="text-lg font-bold text-gray-900 mb-4">✅ Completed Exams</h3>
                          <div className="space-y-3">
                            {completed.map((assessment, idx) => (
                              <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg ${
                                    parseFloat(assessment.score) >= 70 
                                      ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                                      : 'bg-gradient-to-br from-orange-500 to-red-600'
                                  }`}>
                                    {assessment.score}%
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900">{assessment.topic}</h4>
                                    <div className="flex items-center gap-3 mt-1 text-sm">
                                      <span className="text-gray-600">⏱ {assessment.duration} mins</span>
                                      <span className="text-gray-600">·</span>
                                      <span className="text-gray-600">📝 {assessment.questionCount} questions</span>
                                      <span className="text-gray-600">·</span>
                                      <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                                        parseFloat(assessment.score) >= 70 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-orange-100 text-orange-700'
                                      }`}>
                                        {parseFloat(assessment.score) >= 70 ? '✓ Passed' : '✗ Failed'}
                                      </span>
                                      {assessment.attempt && (
                                        <>
                                          <span className="text-gray-600">·</span>
                                          <span className="text-xs text-gray-500">Attempt: {assessment.attempt.attemptNumber || 1}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => navigate(`/assessment-results/${assessment.attemptId}`)}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-semibold text-sm"
                                  >
                                    View Results →
                                  </button>
                                  <button
                                    onClick={() => startAssessment(assessment._id)}
                                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition font-semibold text-sm"
                                  >
                                    Retake
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Summary */}
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-sm text-blue-900">
                        <strong>📊 Total:</strong> {generatedAssessments.length} topic assessments · 
                        <strong> To Write:</strong> {generatedAssessments.filter(a => !a.attemptedStatus || a.attemptedStatus === 'not-started' || a.attemptedStatus === 'in-progress').length} · 
                        <strong> Completed:</strong> {generatedAssessments.filter(a => a.attemptedStatus === 'submitted' || a.attemptedStatus === 'completed').length}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Old Resume Assessment Tab - Commented Out */}
            {activeTab === 'resumeOld' && (
              <div className="space-y-6">
                {/* Upload Section */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">📄</span>
                    <div>
                      <h3 className="text-xl font-bold">Resume-Based Assessment</h3>
                      <p className="text-emerald-200 text-sm">Upload your resume and paste a job description to generate a personalized test</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Resume Upload */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                      <label className="block text-sm font-medium text-emerald-100 mb-2">Resume (PDF)</label>
                      <div className="border-2 border-dashed border-white/30 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setResumeFile(e.target.files[0])}
                          className="hidden"
                          id="resume-upload"
                        />
                        <label htmlFor="resume-upload" className="cursor-pointer">
                          {resumeFile ? (
                            <div className="text-emerald-100">
                              <span className="text-2xl">✅</span>
                              <p className="mt-1 font-medium">{resumeFile.name}</p>
                            </div>
                          ) : (
                            <div className="text-emerald-200">
                              <span className="text-2xl">📤</span>
                              <p className="mt-1">Click to upload PDF</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Job Description */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                      <label className="block text-sm font-medium text-emerald-100 mb-2">Job Description</label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the job description here..."
                        rows={4}
                        className="w-full p-3 rounded-lg bg-white/20 border border-white/20 text-white placeholder-emerald-200 focus:ring-2 focus:ring-white/50"
                      />
                    </div>
                  </div>

                  {/* Extract Topics Button */}
                  <button
                    onClick={async () => {
                      if (!resumeFile || !jobDescription.trim()) {
                        alert('Please upload resume and enter job description');
                        return;
                      }
                      setResumeProcessing(true);
                      try {
                        const formData = new FormData();
                        formData.append('resume', resumeFile);
                        formData.append('job_description', jobDescription);
                        
                        const response = await aiApi.post('/resume-assessment/extract-topics', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        
                        if (response.data.success) {
                          setExtractedTopics(response.data.topics);
                        } else {
                          alert('Failed to extract topics');
                        }
                      } catch (err) {
                        console.error('Error:', err);
                        alert(err.response?.data?.detail || 'Failed to analyze resume');
                      } finally {
                        setResumeProcessing(false);
                      }
                    }}
                    disabled={!resumeFile || !jobDescription.trim() || resumeProcessing}
                    className="w-full mt-4 bg-white text-emerald-600 font-semibold py-3 rounded-xl hover:bg-emerald-50 transition disabled:opacity-50"
                  >
                    {resumeProcessing ? '🔍 Analyzing Resume...' : '🎯 Analyze & Find Topics'}
                  </button>
                </div>

                {/* Extracted Topics */}
                {extractedTopics.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Topics to Test</h3>
                    <div className="grid md:grid-cols-2 gap-3 mb-6">
                      {extractedTopics.map((topic, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                          <div>
                            <p className="font-medium text-emerald-800">{topic.name}</p>
                            {topic.subtopic && <p className="text-xs text-emerald-600">{topic.subtopic}</p>}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            topic.difficulty === 'Hard' ? 'bg-red-100 text-red-700' :
                            topic.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {topic.difficulty}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Generate Assessment Button */}
                    <button
                      onClick={async () => {
                        setGeneratingResumeAssessment(true);
                        try {
                          const response = await api.post('/resume-assessments/generate', {
                            topics: extractedTopics,
                            jobTitle: extractedTopics[0]?.name || 'Custom',
                            duration: 15
                          });
                          
                          if (response.data.success) {
                            navigate(`/student/assessment/${response.data.assessment._id}`);
                          }
                        } catch (err) {
                          console.error('Error:', err);
                          alert(err.response?.data?.message || 'Failed to generate assessment');
                        } finally {
                          setGeneratingResumeAssessment(false);
                        }
                      }}
                      disabled={generatingResumeAssessment}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-4 rounded-xl hover:shadow-lg transition disabled:opacity-50"
                    >
                      {generatingResumeAssessment ? '⏳ Creating Assessment...' : '🚀 Generate Personalized Assessment'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Exams Tab */}
            {activeTab === 'exams' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6">📝 Placement Exams</h3>
                
                {/* Company Pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {placementCompanies.map(company => (
                    <button
                      key={company}
                      onClick={() => handleCompanySelect(company)}
                      className={`px-4 py-2 rounded-full font-medium transition ${
                        selectedPlacementCompany === company
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {company}
                    </button>
                  ))}
                </div>

                {/* Exam Formats */}
                {placementFormats.length > 0 && (
                  <div className="space-y-3">
                    {placementFormats.map(format => (
                      <div key={format._id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-purple-200 transition">
                        <div>
                          <h4 className="font-semibold text-gray-900">{format.examName}</h4>
                          <p className="text-sm text-gray-500">⏱ {format.duration} mins · 📚 {format.sections.length} sections</p>
                        </div>
                        <button
                          onClick={() => startPlacementExam(format._id)}
                          disabled={startingExam}
                          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                        >
                          {startingExam ? '...' : 'Start'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {!selectedPlacementCompany && (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-2">🏢</p>
                    <p>Select a company to view available exams</p>
                  </div>
                )}
              </div>
            )}

            {/* Targeted Assessments Tab */}
            {activeTab === 'targeted' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">🎪</span>
                    <div>
                      <h3 className="text-2xl font-bold">Targeted Assessments</h3>
                      <p className="text-indigo-200 text-sm">Practice tests generated from your weak areas</p>
                    </div>
                  </div>
                </div>

                {targetedAssessmentsGrouped.length > 0 ? (
                  <div className="space-y-4">
                    {targetedAssessmentsGrouped.map((group, idx) => (
                      <div key={idx} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {/* Source Exam Header - Expandable */}
                        <button
                          onClick={() => setExpandedExam(expandedExam === idx ? null : idx)}
                          className="w-full p-6 hover:bg-gray-50 transition flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4 text-left">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                              {group.sourceExam.companyName.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-gray-900">{group.sourceExam.title}</h4>
                              <p className="text-sm text-gray-500">
                                {new Date(group.sourceExam.analysisDate).toLocaleDateString()} · 
                                {group.totalGenerated} targeted assessments · 
                                {group.totalCompleted}/{group.totalGenerated} completed
                              </p>
                              <div className="flex gap-3 mt-2">
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                  Company: {group.sourceExam.company}
                                </span>
                                {group.totalCompleted > 0 && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                    Avg: {group.avgScore}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-2xl">
                            {expandedExam === idx ? '▼' : '▶'}
                          </div>
                        </button>

                        {/* Targeted Assessments List - Expandable */}
                        {expandedExam === idx && (
                          <div className="border-t border-gray-100 p-6 space-y-3 bg-gray-50">
                            {group.generatedAssessments.length > 0 ? (
                              group.generatedAssessments.map((ta, taIdx) => (
                                <div
                                  key={taIdx}
                                  className="bg-white p-4 rounded-xl border border-gray-100 hover:border-indigo-300 transition flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white ${
                                      ta.status === 'submitted' 
                                        ? parseFloat(ta.percentage) >= 70
                                          ? 'bg-green-500'
                                          : 'bg-orange-500'
                                        : 'bg-gray-400'
                                    }`}>
                                      {ta.status === 'submitted' ? ta.percentage : '—'}
                                    </div>
                                    <div className="flex-1">
                                      <h5 className="font-semibold text-gray-900">{ta.title}</h5>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-500">⏱ {ta.duration} mins</span>
                                        <span className="text-xs text-gray-500">·</span>
                                        <span className="text-xs text-gray-500">{ta.totalMarks} marks</span>
                                        <span className="text-xs text-gray-500">·</span>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                          ta.status === 'submitted' 
                                            ? 'bg-green-100 text-green-700'
                                            : ta.status === 'in-progress'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}>
                                          {ta.status === 'submitted' ? '✓ Completed' : ta.status === 'in-progress' ? 'In Progress' : 'Pending'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {ta.status === 'submitted' ? (
                                      <>
                                        <button
                                          onClick={() => navigate(`/assessment-results/${ta._id}`)}
                                          className="text-blue-600 font-medium hover:text-blue-800 px-4 py-2"
                                        >
                                          View Results →
                                        </button>
                                        <button
                                          onClick={() => startAssessment(ta._id)}
                                          className="text-indigo-600 font-medium hover:text-indigo-800 px-4 py-2"
                                        >
                                          Retake
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => startAssessment(ta._id)}
                                        className="bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
                                      >
                                        Start Assessment
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-6 text-gray-400">
                                <p>No targeted assessments generated yet</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                    <p className="text-4xl mb-3">🎪</p>
                    <p className="text-gray-600 font-medium mb-2">No targeted assessments yet</p>
                    <p className="text-gray-400 text-sm mb-6">Take a placement exam first. Targeted assessments will be auto-generated from your weak areas.</p>
                    <button
                      onClick={() => setActiveTab('exams')}
                      className="bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
                    >
                      Take a Placement Exam
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Interviews Tab */}
            {activeTab === 'interviews' && (
              <div className="space-y-4">
                {/* LLM Recommendations Section */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">💡</span>
                      <div>
                        <h3 className="text-xl font-bold">AI-Powered Improvement Tips</h3>
                        <p className="text-purple-200 text-sm">Personalized recommendations based on your interview performance</p>
                      </div>
                    </div>
                    <button
                      onClick={fetchLlmRecommendations}
                      disabled={loadingLlmRecs || interviews.length === 0}
                      className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-purple-50 transition disabled:opacity-50"
                    >
                      {loadingLlmRecs ? '✨ Generating...' : '🎯 Get Tips'}
                    </button>
                  </div>
                  
                  {llmRecommendations && (
                    <div className="space-y-4 mt-4">
                      {/* Overall Assessment */}
                      <div className="bg-white/10 rounded-xl p-4">
                        <h4 className="font-semibold mb-2">📊 Overall Assessment</h4>
                        <p className="text-purple-100">{llmRecommendations.overall_assessment}</p>
                      </div>
                      
                      {/* Immediate Improvements */}
                      {llmRecommendations.immediate_improvements?.length > 0 && (
                        <div className="bg-white/10 rounded-xl p-4">
                          <h4 className="font-semibold mb-3">🎯 Areas to Improve</h4>
                          <div className="space-y-2">
                            {llmRecommendations.immediate_improvements.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="bg-white/10 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    item.priority === 'high' ? 'bg-red-500' : 
                                    item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}>{item.priority}</span>
                                  <span className="font-medium">{item.area}</span>
                                </div>
                                <p className="text-sm text-purple-100">{item.action}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Practice Questions */}
                      {llmRecommendations.practice_questions?.length > 0 && (
                        <div className="bg-white/10 rounded-xl p-4">
                          <h4 className="font-semibold mb-3">💬 Practice Questions</h4>
                          <div className="space-y-2">
                            {llmRecommendations.practice_questions.slice(0, 2).map((q, idx) => (
                              <div key={idx} className="bg-white/10 rounded-lg p-3">
                                <p className="font-medium text-sm mb-1">{q.question}</p>
                                <p className="text-xs text-purple-200">💡 {q.tips}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Next Steps */}
                      {llmRecommendations.next_steps?.length > 0 && (
                        <div className="bg-white/10 rounded-xl p-4">
                          <h4 className="font-semibold mb-2">📋 Next Steps</h4>
                          <ul className="list-disc list-inside text-sm text-purple-100 space-y-1">
                            {llmRecommendations.next_steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!llmRecommendations && !loadingLlmRecs && interviews.length > 0 && (
                    <p className="text-purple-200 text-sm text-center py-4">
                      Click "Get Tips" to get personalized improvement recommendations based on your latest interview
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">🤖 AI Interview History</h3>
                    <button
                      onClick={() => navigate('/interview')}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                      + New Interview
                    </button>
                  </div>

                  {interviews.length > 0 ? (
                    <div className="space-y-3">
                      {interviews.map(interview => (
                        <div key={interview.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold">
                              {interview.final_score ?? '—'}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{interview.interview_type?.toUpperCase()} Interview</h4>
                              <p className="text-sm text-gray-500 line-clamp-1">{interview.job_description}</p>
                              <p className="text-xs text-gray-400">{new Date(interview.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(`/student/interview-results/${interview.id}`)}
                            className="text-blue-600 font-medium hover:text-blue-800"
                          >
                            View →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-4xl mb-2">🤖</p>
                      <p>No AI interviews yet. Start your first one!</p>
                    </div>
                  )}
                </div>

                
              </div>
            )}

            {/* Jobs Tab */}
            {activeTab === 'jobs' && (
              <JobPortal />
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6">📈 My Attempts</h3>
                
                {attempts.length > 0 ? (
                  <div className="space-y-3">
                    {attempts.map(attempt => (
                      <div key={attempt._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold ${
                            parseFloat(attempt.percentage) >= 70 
                              ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                              : 'bg-gradient-to-br from-orange-400 to-red-500'
                          }`}>
                            {attempt.percentage || 0}%
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{attempt.assessment?.title}</h4>
                            <p className="text-sm text-gray-500">{attempt.assessment?.companyName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            attempt.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {attempt.status}
                          </span>
                          {attempt.status === 'submitted' && (
                            <button
                              onClick={() => navigate(`/assessment-results/${attempt._id}`)}
                              className="text-blue-600 font-medium hover:text-blue-800"
                            >
                              View →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-4xl mb-2">📊</p>
                    <p>No attempts yet. Start practicing!</p>
                  </div>
                )}
              </div>
            )}

            {/* Progress Visualization Tab (Phase 7) */}
            {activeTab === 'progress' && (
              <div className="space-y-6">
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-gray-500 font-medium text-sm">Active Learning Paths</h3>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{progressStats?.totalActive || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Companies you're practicing</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-gray-500 font-medium text-sm">Qualified Skills</h3>
                    <p className="text-3xl font-bold text-green-600 mt-2">{progressStats?.totalQualified || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Areas marked as 'Strong'</p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-gray-500 font-medium text-sm">Avg. Improvement</h3>
                    <p className="text-3xl font-bold text-purple-600 mt-2">+{progressStats?.avgImprovement || 0}%</p>
                    <p className="text-xs text-gray-400 mt-1">Growth from baseline</p>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Improvement Chart */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">📈 Improvement by Company</h3>
                    <div className="h-64">
                      {progressData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={progressData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="company" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip 
                              cursor={{fill: '#f3f4f6'}}
                              contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            />
                            <Legend />
                            <Bar dataKey="initialScore" name="Initial Score" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="currentScore" name="Current Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          No data available yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Difficulty Distribution (using Radar for skill balance) */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">🎯 Skill Balance</h3>
                    <div className="h-64">
                      {progressData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={progressData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="company" fontSize={11} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                            <Radar name="Current Proficiency" dataKey="currentScore" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                         <div className="h-full flex items-center justify-center text-gray-400">
                          Complete assessments to see analysis
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score Timeline - All Attempts */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">📊 Score Timeline</h3>
                  <div className="h-72">
                    {progressData.some(p => p.scoreHistory?.length > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={
                          progressData.flatMap(p => 
                            (p.scoreHistory || []).map((h, idx) => ({
                              name: `#${h.attemptNumber || idx + 1}`,
                              score: h.score,
                              company: p.company,
                              difficulty: h.difficulty || 'Easy'
                            }))
                          )
                        }>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                          <Tooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                            formatter={(value, name, props) => [`${value}%`, `Score (${props.payload.difficulty})`]}
                            labelFormatter={(label) => `Attempt ${label}`}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            name="Score" 
                            stroke="#3b82f6" 
                            strokeWidth={3} 
                            dot={{ fill: '#3b82f6', r: 6, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        Take practice assessments to see your progress
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed List */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Detailed Progress</h3>
                  <div className="grid gap-4">
                    {progressData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white ${
                            item.status === 'qualified' ? 'bg-green-500' : 'bg-orange-500'
                          }`}>
                            {item.company.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{item.company}</h4>
                            <div className="flex items-center gap-2 text-xs mt-1">
                              <span className="text-gray-500">Difficulty: {item.difficulty}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-500">{item.attempts} Attempts</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className={`font-bold text-lg ${
                            item.improvement > 0 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {item.improvement > 0 ? '+' : ''}{item.improvement}%
                          </p>
                          <p className="text-xs text-gray-400">Improvement</p>
                        </div>
                      </div>
                    ))}
                    
                    {progressData.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        Start taking assessments to track your progress!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
            
            </div>
          </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default StudentDashboard;
