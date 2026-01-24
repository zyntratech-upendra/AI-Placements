import { useState, useEffect } from 'react';
import api from '../../config/api';

const JobManagement = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [viewingApplicants, setViewingApplicants] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [applicantStats, setApplicantStats] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    companyName: '',
    description: '',
    description_detailed: '',
    location: '',
    salary: '',
    ctc: '',
    jobType: 'Full-time',
    jobCategory: 'On-Campus',
    openings: '',
    skills: '',
    deadline: '',
    status: 'active'
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/jobs?status=active,draft');
      console.log('Fetched jobs with status filter:', response.data);
      
      if (response.data.data && response.data.data.length > 0) {
        setJobs(response.data.data);
      } else {
        // If no jobs found, try fetching all jobs to debug
        console.log('No jobs found with status filter, fetching all jobs...');
        const allJobsResponse = await api.get('/jobs');
        console.log('All jobs:', allJobsResponse.data);
        setJobs(allJobsResponse.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      alert('Error loading jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (e) => {
    e.preventDefault();
    try {
      const jobPayload = {
        ...formData,
        openings: parseInt(formData.openings),
        skills: formData.skills.split(',').map(s => s.trim()).filter(s => s)
      };
      console.log('Creating job with payload:', jobPayload);

      if (selectedJob) {
        const response = await api.put(`/jobs/${selectedJob._id}`, jobPayload);
        console.log('Job updated:', response.data);
        alert('Job updated successfully');
      } else {
        const response = await api.post('/jobs', jobPayload);
        console.log('Job created:', response.data);
        alert('Job created successfully');
      }

      resetForm();
      // Add a slight delay before fetching to ensure backend has processed
      setTimeout(() => {
        console.log('Fetching jobs after creation...');
        fetchJobs();
      }, 500);
    } catch (error) {
      console.error('Error saving job:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || 'Error saving job');
    }
  };

  const handleEditJob = (job) => {
    setFormData({
      title: job.title,
      companyName: job.companyName,
      description: job.description,
      description_detailed: job.description_detailed || '',
      location: job.location,
      salary: job.salary || '',
      ctc: job.ctc || '',
      jobType: job.jobType,
      jobCategory: job.jobCategory,
      openings: job.openings.toString(),
      skills: job.skills ? job.skills.join(', ') : '',
      deadline: job.deadline.split('T')[0],
      status: job.status
    });
    setSelectedJob(job);
    setShowCreateForm(true);
  };

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        await api.delete(`/jobs/${jobId}`);
        alert('Job deleted successfully');
        fetchJobs();
      } catch (error) {
        console.error('Error deleting job:', error);
        alert('Error deleting job');
      }
    }
  };

  const handleViewApplicants = async (jobId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/applicants`);
      setApplicants(response.data.data || []);
      setApplicantStats(response.data.stats);
      setViewingApplicants(jobId);
    } catch (error) {
      console.error('Error fetching applicants:', error);
      alert('Error loading applicants');
    }
  };

  const handleUpdateApplicationStatus = async (applicationId, newStatus) => {
    try {
      await api.put(`/jobs/applications/${applicationId}/status`, { status: newStatus });
      
      // Refresh applicants list
      const jobId = viewingApplicants;
      const response = await api.get(`/jobs/${jobId}/applicants`);
      setApplicants(response.data.data || []);
      setApplicantStats(response.data.stats);
    } catch (error) {
      console.error('Error updating application status:', error);
      alert('Error updating status');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      companyName: '',
      description: '',
      description_detailed: '',
      location: '',
      salary: '',
      ctc: '',
      jobType: 'Full-time',
      jobCategory: 'On-Campus',
      openings: '',
      skills: '',
      deadline: '',
      status: 'active'
    });
    setSelectedJob(null);
    setShowCreateForm(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading jobs...</div>;
  }

  if (viewingApplicants) {
    const job = jobs.find(j => j._id === viewingApplicants);
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{job?.title} - Applicants</h3>
            <p className="text-gray-600">{job?.companyName}</p>
          </div>
          <button
            onClick={() => setViewingApplicants(null)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Back to Jobs
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Students</p>
            <p className="text-3xl font-bold text-blue-600">{applicantStats?.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Applied</p>
            <p className="text-3xl font-bold text-green-600">{applicantStats?.applied}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Not Applied</p>
            <p className="text-3xl font-bold text-orange-600">{applicantStats?.notApplied}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Selected</p>
            <p className="text-3xl font-bold text-purple-600">{applicantStats?.byStatus?.selected || 0}</p>
          </div>
        </div>

        {/* Applicants List */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Roll Number</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Applied Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {applicants.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-600">
                    No applicants yet
                  </td>
                </tr>
              ) : (
                applicants.map(app => (
                  <tr key={app._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{app.studentId?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{app.studentId?.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{app.studentId?.rollNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(app.appliedAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <select
                        value={app.status}
                        onChange={(e) => handleUpdateApplicationStatus(app._id, e.target.value)}
                        className={`px-3 py-1 rounded-lg text-sm font-semibold border-0 ${
                          app.status === 'selected' ? 'bg-green-100 text-green-800' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          app.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        <option value="applied">Applied</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="selected">Selected</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => {
                          // You can expand this to show detailed application data
                          alert(`Applied on: ${new Date(app.appliedAt).toLocaleString()}`);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">Job Management</h3>
        <button
          onClick={() => {
            resetForm();
            setShowCreateForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create New Job
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4">
            {selectedJob ? 'Edit Job' : 'Create New Job'}
          </h4>
          <form onSubmit={handleCreateJob} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Openings *</label>
                <input
                  type="number"
                  required
                  value={formData.openings}
                  onChange={(e) => setFormData({ ...formData, openings: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Type *</label>
                <select
                  required
                  value={formData.jobType}
                  onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Internship">Internship</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Category *</label>
                <select
                  required
                  value={formData.jobCategory}
                  onChange={(e) => setFormData({ ...formData, jobCategory: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="On-Campus">On-Campus</option>
                  <option value="Off-Campus">Off-Campus</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CTC</label>
                <input
                  type="text"
                  value={formData.ctc}
                  onChange={(e) => setFormData({ ...formData, ctc: e.target.value })}
                  placeholder="e.g., 8 LPA"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                <input
                  type="text"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  placeholder="e.g., 50,000/month"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                <input
                  type="date"
                  required
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="e.g., Python, JavaScript, React"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Description</label>
              <textarea
                value={formData.description_detailed}
                onChange={(e) => setFormData({ ...formData, description_detailed: e.target.value })}
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {selectedJob ? 'Update Job' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Job Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Company</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Openings</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Deadline</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-600">
                  No jobs created yet
                </td>
              </tr>
            ) : (
              jobs.map(job => (
                <tr key={job._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{job.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{job.companyName}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      job.jobCategory === 'On-Campus' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {job.jobCategory}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{job.openings}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(job.deadline).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => handleViewApplicants(job._id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Applicants
                    </button>
                    <button
                      onClick={() => handleEditJob(job)}
                      className="text-green-600 hover:text-green-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job._id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JobManagement;
