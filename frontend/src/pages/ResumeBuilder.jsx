import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import aiApi from '../config/aiapi';
import Layout from '../components/Layout';

const ResumeBuilder = () => {
  // Resume Data State
  const [resume, setResume] = useState({
    personalInfo: {
      fullName: '',
      email: '',
      phone: '',
      location: '',
      summary: '',
      portfolio: '',
      linkedIn: ''
    },
    education: [
      { id: 1, school: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', description: '' }
    ],
    experience: [
      { id: 1, company: '', position: '', location: '', startDate: '', endDate: '', description: '', achievements: '' }
    ],
    skills: [
      { id: 1, category: 'Technical', skills: '' }
    ],
    projects: [
      { id: 1, name: '', description: '', technologies: '', link: '', startDate: '', endDate: '' }
    ],
    certifications: [
      { id: 1, name: '', issuer: '', date: '', credentialId: '', credentialUrl: '' }
    ]
  });

  const [template, setTemplate] = useState('modern');
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [showAIModal, setShowAIModal] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [resumes, setResumes] = useState([]);
  const [currentResumeId, setCurrentResumeId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newResumeName, setNewResumeName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const navigate = useNavigate();

  const templates = [
    { id: 'modern', name: 'Modern', description: 'Clean and contemporary design' },
    { id: 'classic', name: 'Classic', description: 'Traditional professional resume' },
    { id: 'creative', name: 'Creative', description: 'Bold and creative layout' },
    { id: 'minimal', name: 'Minimal', description: 'Simple and minimalist design' }
  ];

  useEffect(() => {
    fetchResumes();
    fetchJobs();
  }, []);

  const fetchResumes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/resume/list');
      if (response.data.success) {
        setResumes(response.data.data || []);
        if (response.data.data.length > 0) {
          // Load first resume (active one)
          const activeResume = response.data.data.find(r => r.isActive) || response.data.data[0];
          await loadResume(activeResume._id);
        }
      }
    } catch (error) {
      console.error('Error fetching resumes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResume = async (resumeId) => {
    try {
      const response = await api.get(`/resume/${resumeId}`);
      if (response.data.success && response.data.data) {
        setResume(response.data.data.content);
        setTemplate(response.data.data.template || 'modern');
        setCurrentResumeId(resumeId);
      }
    } catch (error) {
      console.error('Error loading resume:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await api.get('/jobs');
      setJobs(response.data.data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const saveResume = async () => {
    try {
      setSaving(true);
      const response = await api.post('/resume', {
        content: resume,
        template,
        resumeId: currentResumeId
      });
      
      if (response.data.success) {
        setSuccessMessage('Resume saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving resume:', error);
      alert('Error saving resume');
    } finally {
      setSaving(false);
    }
  };

  const createNewResume = async () => {
    if (!newResumeName.trim()) {
      alert('Please enter a resume name');
      return;
    }

    try {
      const response = await api.post('/resume/create', {
        resumeName: newResumeName
      });

      if (response.data.success) {
        setResumes([...resumes, response.data.data]);
        await loadResume(response.data.data._id);
        setShowCreateModal(false);
        setNewResumeName('');
        setSuccessMessage(`Resume "${newResumeName}" created successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error creating resume:', error);
      alert('Error creating resume');
    }
  };

  const deleteResume = async (resumeId) => {
    if (!window.confirm('Are you sure you want to delete this resume?')) return;

    try {
      const response = await api.delete(`/resume/${resumeId}`);

      if (response.data.success) {
        const updatedResumes = resumes.filter(r => r._id !== resumeId);
        setResumes(updatedResumes);
        
        if (currentResumeId === resumeId && updatedResumes.length > 0) {
          await loadResume(updatedResumes[0]._id);
        } else if (updatedResumes.length === 0) {
          setCurrentResumeId(null);
          setResume({
            personalInfo: {},
            education: [],
            experience: [],
            skills: [],
            projects: [],
            certifications: []
          });
        }

        setSuccessMessage('Resume deleted successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error deleting resume:', error);
      alert('Error deleting resume');
    }
  };

  const renameResumeHandler = async () => {
    if (!renameValue.trim()) {
      alert('Please enter a resume name');
      return;
    }

    try {
      const response = await api.put(`/resume/${currentResumeId}/rename`, {
        resumeName: renameValue
      });

      if (response.data.success) {
        const updatedResumes = resumes.map(r =>
          r._id === currentResumeId ? { ...r, resumeName: renameValue } : r
        );
        setResumes(updatedResumes);
        setShowRenameModal(false);
        setRenameValue('');
        setSuccessMessage('Resume renamed successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error renaming resume:', error);
      alert('Error renaming resume');
    }
  };

  const handlePersonalInfoChange = (field, value) => {
    setResume(prev => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value }
    }));
  };

  const handleEducationChange = (index, field, value) => {
    const newEducation = [...resume.education];
    newEducation[index] = { ...newEducation[index], [field]: value };
    setResume(prev => ({ ...prev, education: newEducation }));
  };

  const addEducation = () => {
    const newId = Math.max(...resume.education.map(e => e.id), 0) + 1;
    setResume(prev => ({
      ...prev,
      education: [...prev.education, { id: newId, school: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', description: '' }]
    }));
  };

  const removeEducation = (id) => {
    setResume(prev => ({
      ...prev,
      education: prev.education.filter(e => e.id !== id)
    }));
  };

  const handleExperienceChange = (index, field, value) => {
    const newExperience = [...resume.experience];
    newExperience[index] = { ...newExperience[index], [field]: value };
    setResume(prev => ({ ...prev, experience: newExperience }));
  };

  const addExperience = () => {
    const newId = Math.max(...resume.experience.map(e => e.id), 0) + 1;
    setResume(prev => ({
      ...prev,
      experience: [...prev.experience, { id: newId, company: '', position: '', location: '', startDate: '', endDate: '', description: '', achievements: '' }]
    }));
  };

  const removeExperience = (id) => {
    setResume(prev => ({
      ...prev,
      experience: prev.experience.filter(e => e.id !== id)
    }));
  };

  const handleSkillsChange = (index, field, value) => {
    const newSkills = [...resume.skills];
    newSkills[index] = { ...newSkills[index], [field]: value };
    setResume(prev => ({ ...prev, skills: newSkills }));
  };

  const addSkills = () => {
    const newId = Math.max(...resume.skills.map(s => s.id), 0) + 1;
    setResume(prev => ({
      ...prev,
      skills: [...prev.skills, { id: newId, category: 'Technical', skills: '' }]
    }));
  };

  const removeSkills = (id) => {
    setResume(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s.id !== id)
    }));
  };

  const handleProjectsChange = (index, field, value) => {
    const newProjects = [...resume.projects];
    newProjects[index] = { ...newProjects[index], [field]: value };
    setResume(prev => ({ ...prev, projects: newProjects }));
  };

  const addProjects = () => {
    const newId = Math.max(...resume.projects.map(p => p.id), 0) + 1;
    setResume(prev => ({
      ...prev,
      projects: [...prev.projects, { id: newId, name: '', description: '', technologies: '', link: '', startDate: '', endDate: '' }]
    }));
  };

  const removeProjects = (id) => {
    setResume(prev => ({
      ...prev,
      projects: prev.projects.filter(p => p.id !== id)
    }));
  };

  const handleCertificationsChange = (index, field, value) => {
    const newCertifications = [...resume.certifications];
    newCertifications[index] = { ...newCertifications[index], [field]: value };
    setResume(prev => ({ ...prev, certifications: newCertifications }));
  };

  const addCertifications = () => {
    const newId = Math.max(...resume.certifications.map(c => c.id), 0) + 1;
    setResume(prev => ({
      ...prev,
      certifications: [...prev.certifications, { id: newId, name: '', issuer: '', date: '', credentialId: '', credentialUrl: '' }]
    }));
  };

  const removeCertifications = (id) => {
    setResume(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c.id !== id)
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('resume', file);

      const response = await api.post('/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      if (response.data.success) {
        setResume(response.data.data.content);
        setTemplate(response.data.data.template || 'modern');
        setSuccessMessage('Resume uploaded and parsed successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error uploading resume:', error);
      alert('Error uploading resume');
    }
  };

  const generateAIResume = async () => {
    if (!jobDescription && selectedJobs.length === 0) {
      alert('Please provide a job description or select jobs');
      return;
    }

    try {
      setGeneratingAI(true);
      const jobDesc = jobDescription || selectedJobs.map(j => j.description).join('\n');
      
      const response = await aiApi.post('/generate-resume', {
        jobDescription: jobDesc,
        currentResume: resume
      });

      if (response.data.success) {
        setResume(response.data.data);
        setSuccessMessage('Resume generated successfully!');
        setShowAIModal(false);
        setJobDescription('');
        setSelectedJobs([]);
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error generating resume:', error);
      alert('Error generating resume');
    } finally {
      setGeneratingAI(false);
    }
  };

  const downloadResume = async (format) => {
    try {
      const response = await api.post('/resume/download', {
        format,
        template,
        resumeId: currentResumeId
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `resume.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentElement.removeChild(link);
    } catch (error) {
      console.error('Error downloading resume:', error);
      alert('Error downloading resume');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-xl font-semibold">Loading resume...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Resume Builder</h1>
                <p className="text-gray-600">Create, edit, and download your professional resume</p>
              </div>
              <button
                onClick={() => navigate('/student')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                ← Back to Dashboard
              </button>
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                {successMessage}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Editor */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6">
                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mb-6 pb-6 border-b border-gray-200">
                  <button
                    onClick={() => setShowAIModal(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    ✨ AI Generate Resume
                  </button>
                  <button
                    onClick={() => document.getElementById('fileInput').click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    📤 Upload Resume
                  </button>
                  <input
                    id="fileInput"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                  <button
                    onClick={saveResume}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : '💾 Save Resume'}
                  </button>
                  <button
                    onClick={() => downloadResume('pdf')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    📄 Download PDF
                  </button>
                  <button
                    onClick={() => downloadResume('docx')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    📝 Download DOCX
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
                  {['personal', 'education', 'experience', 'skills', 'projects', 'certifications'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 font-medium capitalize whitespace-nowrap ${
                        activeTab === tab
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                  {/* Personal Info Tab */}
                  {activeTab === 'personal' && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={resume.personalInfo.fullName}
                            onChange={(e) => handlePersonalInfoChange('fullName', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={resume.personalInfo.email}
                            onChange={(e) => handlePersonalInfoChange('email', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <input
                            type="tel"
                            value={resume.personalInfo.phone}
                            onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                          <input
                            type="text"
                            value={resume.personalInfo.location}
                            onChange={(e) => handlePersonalInfoChange('location', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                          <input
                            type="url"
                            value={resume.personalInfo.linkedIn}
                            onChange={(e) => handlePersonalInfoChange('linkedIn', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio</label>
                          <input
                            type="url"
                            value={resume.personalInfo.portfolio}
                            onChange={(e) => handlePersonalInfoChange('portfolio', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Professional Summary</label>
                        <textarea
                          value={resume.personalInfo.summary}
                          onChange={(e) => handlePersonalInfoChange('summary', e.target.value)}
                          rows="4"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Brief overview of your professional background and career goals"
                        />
                      </div>
                    </div>
                  )}

                  {/* Education Tab */}
                  {activeTab === 'education' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Education</h3>
                        <button
                          onClick={addEducation}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          + Add Education
                        </button>
                      </div>

                      {resume.education.map((edu, idx) => (
                        <div key={edu.id} className="border border-gray-300 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-gray-900">Education {idx + 1}</h4>
                            <button
                              onClick={() => removeEducation(edu.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="School/University"
                              value={edu.school}
                              onChange={(e) => handleEducationChange(idx, 'school', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Degree"
                              value={edu.degree}
                              onChange={(e) => handleEducationChange(idx, 'degree', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Field of Study"
                              value={edu.field}
                              onChange={(e) => handleEducationChange(idx, 'field', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="GPA"
                              value={edu.gpa}
                              onChange={(e) => handleEducationChange(idx, 'gpa', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="month"
                              placeholder="Start Date"
                              value={edu.startDate}
                              onChange={(e) => handleEducationChange(idx, 'startDate', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="month"
                              placeholder="End Date"
                              value={edu.endDate}
                              onChange={(e) => handleEducationChange(idx, 'endDate', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <textarea
                            placeholder="Additional details or achievements"
                            value={edu.description}
                            onChange={(e) => handleEducationChange(idx, 'description', e.target.value)}
                            rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Experience Tab */}
                  {activeTab === 'experience' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Work Experience</h3>
                        <button
                          onClick={addExperience}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          + Add Experience
                        </button>
                      </div>

                      {resume.experience.map((exp, idx) => (
                        <div key={exp.id} className="border border-gray-300 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-gray-900">Experience {idx + 1}</h4>
                            <button
                              onClick={() => removeExperience(exp.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="Company"
                              value={exp.company}
                              onChange={(e) => handleExperienceChange(idx, 'company', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Position"
                              value={exp.position}
                              onChange={(e) => handleExperienceChange(idx, 'position', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Location"
                              value={exp.location}
                              onChange={(e) => handleExperienceChange(idx, 'location', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="month"
                              placeholder="Start Date"
                              value={exp.startDate}
                              onChange={(e) => handleExperienceChange(idx, 'startDate', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="month"
                              placeholder="End Date"
                              value={exp.endDate}
                              onChange={(e) => handleExperienceChange(idx, 'endDate', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <textarea
                            placeholder="Job description and responsibilities"
                            value={exp.description}
                            onChange={(e) => handleExperienceChange(idx, 'description', e.target.value)}
                            rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <textarea
                            placeholder="Key achievements and accomplishments"
                            value={exp.achievements}
                            onChange={(e) => handleExperienceChange(idx, 'achievements', e.target.value)}
                            rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skills Tab */}
                  {activeTab === 'skills' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Skills</h3>
                        <button
                          onClick={addSkills}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          + Add Skill Category
                        </button>
                      </div>

                      {resume.skills.map((skill, idx) => (
                        <div key={skill.id} className="border border-gray-300 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-gray-900">Skill Category {idx + 1}</h4>
                            <button
                              onClick={() => removeSkills(skill.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <select
                              value={skill.category}
                              onChange={(e) => handleSkillsChange(idx, 'category', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="Technical">Technical</option>
                              <option value="Languages">Languages</option>
                              <option value="Tools">Tools</option>
                              <option value="Soft Skills">Soft Skills</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <textarea
                            placeholder="Enter skills separated by commas (e.g., Python, JavaScript, React)"
                            value={skill.skills}
                            onChange={(e) => handleSkillsChange(idx, 'skills', e.target.value)}
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Projects Tab */}
                  {activeTab === 'projects' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
                        <button
                          onClick={addProjects}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          + Add Project
                        </button>
                      </div>

                      {resume.projects.map((project, idx) => (
                        <div key={project.id} className="border border-gray-300 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-gray-900">Project {idx + 1}</h4>
                            <button
                              onClick={() => removeProjects(project.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="Project Name"
                              value={project.name}
                              onChange={(e) => handleProjectsChange(idx, 'name', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="url"
                              placeholder="Project Link"
                              value={project.link}
                              onChange={(e) => handleProjectsChange(idx, 'link', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="month"
                              placeholder="Start Date"
                              value={project.startDate}
                              onChange={(e) => handleProjectsChange(idx, 'startDate', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="month"
                              placeholder="End Date"
                              value={project.endDate}
                              onChange={(e) => handleProjectsChange(idx, 'endDate', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <textarea
                            placeholder="Project description"
                            value={project.description}
                            onChange={(e) => handleProjectsChange(idx, 'description', e.target.value)}
                            rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            placeholder="Technologies used (comma-separated)"
                            value={project.technologies}
                            onChange={(e) => handleProjectsChange(idx, 'technologies', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Certifications Tab */}
                  {activeTab === 'certifications' && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900">Certifications</h3>
                        <button
                          onClick={addCertifications}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          + Add Certification
                        </button>
                      </div>

                      {resume.certifications.map((cert, idx) => (
                        <div key={cert.id} className="border border-gray-300 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <h4 className="font-medium text-gray-900">Certification {idx + 1}</h4>
                            <button
                              onClick={() => removeCertifications(cert.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ✕ Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="Certification Name"
                              value={cert.name}
                              onChange={(e) => handleCertificationsChange(idx, 'name', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Issuer"
                              value={cert.issuer}
                              onChange={(e) => handleCertificationsChange(idx, 'issuer', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="month"
                              placeholder="Date Issued"
                              value={cert.date}
                              onChange={(e) => handleCertificationsChange(idx, 'date', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                              type="text"
                              placeholder="Credential ID"
                              value={cert.credentialId}
                              onChange={(e) => handleCertificationsChange(idx, 'credentialId', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <input
                            type="url"
                            placeholder="Credential URL"
                            value={cert.credentialUrl}
                            onChange={(e) => handleCertificationsChange(idx, 'credentialUrl', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar - Templates & Preview */}
            <div className="lg:col-span-1">
              {/* Resume List */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">My Resumes</h3>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    + New
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {resumes.map(res => (
                    <div
                      key={res._id}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        currentResumeId === res._id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <button
                          onClick={() => loadResume(res._id)}
                          className="flex-1 text-left"
                        >
                          <p className="font-medium text-gray-900 truncate">{res.resumeName}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(res.createdAt).toLocaleDateString()}
                          </p>
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setRenameValue(res.resumeName);
                              setShowRenameModal(true);
                            }}
                            className="text-gray-600 hover:text-blue-600 text-sm"
                            title="Rename"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => deleteResume(res._id)}
                            className="text-gray-600 hover:text-red-600 text-sm"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {res.isActive && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Active
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Template Selection */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume Templates</h3>
                <div className="space-y-3">
                  {templates.map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => setTemplate(tmpl.id)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        template === tmpl.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-400'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{tmpl.name}</p>
                      <p className="text-sm text-gray-600">{tmpl.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview</h3>
                <div className="bg-gray-100 rounded-lg p-4 min-h-96 text-sm text-gray-600">
                  <div className="text-center mb-4 pb-4 border-b border-gray-300">
                    <h4 className="font-bold text-gray-900">{resume.personalInfo.fullName || 'Your Name'}</h4>
                    <p className="text-xs text-gray-600">{resume.personalInfo.location}</p>
                    {resume.personalInfo.email && <p className="text-xs text-gray-600">{resume.personalInfo.email}</p>}
                  </div>

                  {resume.personalInfo.summary && (
                    <div className="mb-3 pb-3 border-b border-gray-300">
                      <p className="text-xs line-clamp-3">{resume.personalInfo.summary}</p>
                    </div>
                  )}

                  <div className="text-xs space-y-2">
                    {resume.education.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-900">Education</p>
                        {resume.education[0].school && <p>{resume.education[0].school}</p>}
                      </div>
                    )}
                    {resume.experience.length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-900">Experience</p>
                        {resume.experience[0].company && <p>{resume.experience[0].company}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Generation Modal */}
          {showAIModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Generate Resume with AI</h2>
                    <button
                      onClick={() => setShowAIModal(false)}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Jobs from Portal
                      </label>
                      <select
                        multiple
                        value={selectedJobs.map(j => j._id)}
                        onChange={(e) => {
                          const selectedIds = Array.from(e.target.selectedOptions, option => option.value);
                          setSelectedJobs(jobs.filter(j => selectedIds.includes(j._id)));
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        size="4"
                      >
                        {jobs.map(job => (
                          <option key={job._id} value={job._id}>
                            {job.title} - {job.companyName}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple jobs</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Or Paste Job Description
                      </label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        rows="6"
                        placeholder="Paste job description here..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowAIModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={generateAIResume}
                      disabled={generatingAI || (!jobDescription && selectedJobs.length === 0)}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {generatingAI ? 'Generating...' : 'Generate Resume'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Resume Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Create New Resume</h2>
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setNewResumeName('');
                      }}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resume Name
                      </label>
                      <input
                        type="text"
                        value={newResumeName}
                        onChange={(e) => setNewResumeName(e.target.value)}
                        placeholder="e.g., Software Engineer, Data Scientist"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && createNewResume()}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setNewResumeName('');
                      }}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createNewResume}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Create Resume
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rename Resume Modal */}
          {showRenameModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Rename Resume</h2>
                    <button
                      onClick={() => {
                        setShowRenameModal(false);
                        setRenameValue('');
                      }}
                      className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Name
                      </label>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        onKeyPress={(e) => e.key === 'Enter' && renameResumeHandler()}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowRenameModal(false);
                        setRenameValue('');
                      }}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={renameResumeHandler}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Rename
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ResumeBuilder;
