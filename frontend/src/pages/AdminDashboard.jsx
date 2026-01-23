import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../config/api';
import FolderManagement from '../components/admin/FolderManagement';
import UserManagement from '../components/admin/UserManagement';
import AssessmentManagement from '../components/admin/AssessmentManagement';
import PlacementExamBuilder from '../components/admin/PlacementExamBuilder';
import JobManagement from '../components/admin/JobManagement';
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('folders');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFolders: 0,
    totalAssessments: 0,
    totalAttempts: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, foldersRes, assessmentsRes, attemptsRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/folders'),
        api.get('/assessments'),
        api.get('/attempts/all')
      ]);

      setStats({
        totalUsers: usersRes.data.count || 0,
        totalFolders: foldersRes.data.count || 0,
        totalAssessments: assessmentsRes.data.count || 0,
        totalAttempts: attemptsRes.data.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const tabs = [
    { id: 'folders', label: 'Folders & Files', icon: '📁' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'assessments', label: 'Assessments', icon: '📝' },
    { id: 'placement-exams', label: 'Placement Exams', icon: '🧩' },
    { id: 'jobs', label: 'Job Portal', icon: '💼' }
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage users, folders, and assessments</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Users</p>
                <p className="text-3xl font-bold mt-1">{stats.totalUsers}</p>
              </div>
              <div className="text-4xl opacity-50">👥</div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Folders</p>
                <p className="text-3xl font-bold mt-1">{stats.totalFolders}</p>
              </div>
              <div className="text-4xl opacity-50">📁</div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Assessments</p>
                <p className="text-3xl font-bold mt-1">{stats.totalAssessments}</p>
              </div>
              <div className="text-4xl opacity-50">📝</div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Total Attempts</p>
                <p className="text-3xl font-bold mt-1">{stats.totalAttempts}</p>
              </div>
              <div className="text-4xl opacity-50">✅</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex space-x-1 border-b border-gray-200 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-all ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {activeTab === 'folders' && <FolderManagement />}
            {activeTab === 'users' && <UserManagement />}
            {activeTab === 'assessments' && <AssessmentManagement />}
            {activeTab === 'placement-exams' && <PlacementExamBuilder />}
            {activeTab === 'jobs' && <JobManagement />}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
