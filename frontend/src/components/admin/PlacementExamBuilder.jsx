import { useState, useEffect } from 'react';
import api from '../../config/api';

const PlacementExamBuilder = () => {
  const [companies, setCompanies] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);

  const [company, setCompany] = useState('');
  const [examName, setExamName] = useState('');
  const [duration, setDuration] = useState(90);

  const [sections, setSections] = useState([]);

  const [currentSection, setCurrentSection] = useState({
    topic: '',
    subtopic: '',
    difficulty: '',
    questionCount: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await api.get('/folders');
    const companyFolders = data.folders.filter(f => !f.parentFolderId);
    setCompanies(companyFolders);
  };

  const handleCompanyChange = async (id) => {
    const selected = companies.find(c => c._id === id);
    setCompany(selected.name);

    const { data } = await api.get('/folders');
    setTopics(data.folders.filter(f => f.parentFolderId === id));
  };

  const handleTopicChange = async (id) => {
    const selected = topics.find(t => t._id === id);
    setCurrentSection(prev => ({ ...prev, topic: selected.name }));

    const { data } = await api.get('/folders');
    setSubtopics(data.folders.filter(f => f.parentFolderId === id));
  };

  const addSection = () => {
    setSections([...sections, currentSection]);
    setCurrentSection({
      topic: '',
      subtopic: '',
      difficulty: '',
      questionCount: ''
    });
  };

  const removeSection = (index) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const saveExamFormat = async () => {
    await api.post('/placement-exams', {
      company,
      examName,
      duration,
      sections: sections.map(s => ({
        topic: s.topic,
        subtopic: s.subtopic,
        difficulty: s.difficulty,
        questionCount: Number(s.questionCount)
      }))
    });

    alert('Placement Exam Format Created!');
    setSections([]);
    setExamName('');
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="card bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
        <h2 className="text-2xl font-bold">🏢 Placement Exam Builder</h2>
        <p className="text-indigo-100">
          Design real company placement exam patterns
        </p>
      </div>

      {/* Exam Info */}
      <div className="card">
        <h3 className="font-semibold mb-4">Exam Details</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            className="input"
            onChange={(e) => handleCompanyChange(e.target.value)}
          >
            <option value="">Select Company</option>
            {companies.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          <input
            className="input"
            placeholder="Exam Name"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
          />

          <input
            type="number"
            className="input"
            placeholder="Duration (mins)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>

      {/* Section Builder */}
      <div className="card">
        <h3 className="font-semibold mb-4">Add Exam Sections</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <select className="input" onChange={(e) => handleTopicChange(e.target.value)}>
            <option value="">Topic</option>
            {topics.map(t => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>

          <select
            className="input"
            onChange={(e) =>
              setCurrentSection(prev => ({
                ...prev,
                subtopic: subtopics.find(s => s._id === e.target.value)?.name
              }))
            }
          >
            <option value="">Subtopic</option>
            {subtopics.map(s => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>

          <select
            className="input"
            onChange={(e) =>
              setCurrentSection(prev => ({ ...prev, difficulty: e.target.value }))
            }
          >
            <option value="">Difficulty</option>
            <option>Easy</option>
            <option>Medium</option>
            <option>Difficult</option>
          </select>

          <input
            type="number"
            className="input"
            placeholder="No. of Questions"
            onChange={(e) =>
              setCurrentSection(prev => ({
                ...prev,
                questionCount: e.target.value
              }))
            }
          />

          <button onClick={addSection} className="btn btn-primary">
            + Add
          </button>
        </div>

        {/* Sections Preview */}
        {sections.map((s, i) => (
          <div
            key={i}
            className="flex justify-between items-center bg-gray-50 p-3 rounded-lg mb-2"
          >
            <p className="text-sm">
              <strong>{s.topic}</strong> → {s.subtopic} | {s.difficulty} | {s.questionCount} Q
            </p>
            <button
              onClick={() => removeSection(i)}
              className="text-red-500 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      


      {/* Save */}
      <button
        onClick={saveExamFormat}
        disabled={!company || !examName || sections.length === 0}
        className="btn btn-success w-full text-lg"
      >
        🚀 Save Placement Exam Format
      </button>
    </div>
  );
};

export default PlacementExamBuilder;
