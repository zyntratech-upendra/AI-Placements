import { useState, useEffect } from 'react';
import api from '../config/api';

const JobPortal = () => {
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJobType, setFilterJobType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [applicationData, setApplicationData] = useState({});
  const [submittingApplication, setSubmittingApplication] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/jobs');
      setJobs(response.data.data || []);
      setFilteredJobs(response.data.data || []);
      
      // Check which jobs the student has applied to
      const appliedSet = new Set();
      for (const job of response.data.data) {
        const checkRes = await api.get(`/jobs/${job._id}/check-application`);
        if (checkRes.data.applied) {
          appliedSet.add(job._id);
        }
      }
      setAppliedJobs(appliedSet);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = jobs;

    if (searchQuery) {
      filtered = filtered.filter(job =>
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterJobType) {
      filtered = filtered.filter(job => job.jobType === filterJobType);
    }

    if (filterCategory) {
      filtered = filtered.filter(job => job.jobCategory === filterCategory);
    }

    setFilteredJobs(filtered);
  }, [searchQuery, filterJobType, filterCategory, jobs]);

  const handleApplyClick = (job) => {
    if (!appliedJobs.has(job._id)) {
      setSelectedJob(job);
      setApplicationData({});
    }
  };

  const handleApplicationSubmit = async () => {
    if (!selectedJob) return;

    try {
      setSubmittingApplication(true);
      await api.post(`/jobs/${selectedJob._id}/apply`, {
        applicationData
      });

      const newApplied = new Set(appliedJobs);
      newApplied.add(selectedJob._id);
      setAppliedJobs(newApplied);
      setSelectedJob(null);
      setApplicationData({});
      
      alert('Application submitted successfully!');
    } catch (error) {
      console.error('Error submitting application:', error);
      alert(error.response?.data?.message || 'Error submitting application');
    } finally {
      setSubmittingApplication(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-semibold">Loading jobs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Job Portal</h1>
          <p className="text-gray-600">Browse and apply for on-campus and off-campus job opportunities</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Jobs</label>
              <input
                type="text"
                placeholder="Company, title, or skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
              <select
                value={filterJobType}
                onChange={(e) => setFilterJobType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
                <option value="Contract">Contract</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                <option value="On-Campus">On-Campus</option>
                <option value="Off-Campus">Off-Campus</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="mt-2 text-sm text-gray-600">
                Applied: {appliedJobs.size} / Found: {filteredJobs.length}
              </div>
            </div>
          </div>
        </div>

        {/* Job Listings */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">No jobs found matching your criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredJobs.map((job) => (
              <div key={job._id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{job.title}</h3>
                    <p className="text-lg text-blue-600 font-semibold">{job.companyName}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2 ${
                      job.jobCategory === 'On-Campus' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {job.jobCategory}
                    </span>
                    <br />
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                      {job.jobType}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-semibold text-gray-900">{job.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Openings</p>
                    <p className="font-semibold text-gray-900">{job.openings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">CTC/Salary</p>
                    <p className="font-semibold text-gray-900">{job.ctc || job.salary || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Deadline</p>
                    <p className="font-semibold text-gray-900">{new Date(job.deadline).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-700 line-clamp-3">{job.description_detailed || job.description}</p>
                </div>

                {job.skills && job.skills.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {job.skills.map((skill, idx) => (
                        <span key={idx} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => handleApplyClick(job)}
                    disabled={appliedJobs.has(job._id) || new Date() > new Date(job.deadline)}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                      appliedJobs.has(job._id)
                        ? 'bg-green-100 text-green-800 cursor-not-allowed'
                        : new Date() > new Date(job.deadline)
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {appliedJobs.has(job._id) ? '✓ Applied' : new Date() > new Date(job.deadline) ? 'Deadline Passed' : 'Apply Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Application Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Apply for Job</h2>
                    <p className="text-gray-600">{selectedJob.title} at {selectedJob.companyName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  {selectedJob.requiredFields && selectedJob.requiredFields.length > 0 ? (
                    selectedJob.requiredFields.map((field, idx) => (
                      <div key={idx}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {field.fieldName}
                          {field.required && <span className="text-red-600">*</span>}
                        </label>
                        {field.fieldType === 'textarea' ? (
                          <textarea
                            value={applicationData[field.fieldName] || ''}
                            onChange={(e) => setApplicationData({
                              ...applicationData,
                              [field.fieldName]: e.target.value
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            rows="3"
                          />
                        ) : (
                          <input
                            type={field.fieldType}
                            value={applicationData[field.fieldName] || ''}
                            onChange={(e) => setApplicationData({
                              ...applicationData,
                              [field.fieldName]: e.target.value
                            })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600">No additional fields required for this job.</p>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setSelectedJob(null)}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplicationSubmit}
                    disabled={submittingApplication}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    {submittingApplication ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobPortal;
