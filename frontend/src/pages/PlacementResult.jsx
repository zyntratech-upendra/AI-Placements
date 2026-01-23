import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';

const PlacementResult = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const { data } = await api.get(
          `/placement-results/${attemptId}`
        );
        console.log(data);  
        setResult(data.result);
        setLoading(false);
      } catch (error) {
        alert('Unable to load placement result');
      }
    };

    fetchResult();
  }, [attemptId]);

  if (loading || !result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading placement result...</p>
      </div>
    );
  }

  const percentage = Math.round(
    (result.totalScore / result.totalMarks) * 100
  );

  const getPerformanceBadge = () => {
    if (percentage >= 75) return 'Excellent';
    if (percentage >= 60) return 'Good';
    if (percentage >= 40) return 'Average';
    return 'Needs Improvement';
  };

  // Identify weak sections (< 60%)
  const weakSections = result.sectionResults.filter(
    sec => (sec.score / sec.total) < 0.6
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 px-6 py-10">

      {/* ===== HEADER ===== */}
      <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl p-8 mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Placement Exam Result
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              🏢 {result.companyName}
            </p>
          </div>

          <span
            className={`px-5 py-2 rounded-full font-semibold text-sm
              ${
                percentage >= 60
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-600'
              }
            `}
          >
            {getPerformanceBadge()}
          </span>
        </div>
      </div>

      {/* ===== SCORE SUMMARY ===== */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-sm text-gray-500">Score</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">
            {result.totalScore} / {result.totalMarks}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-sm text-gray-500">Percentage</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {percentage}%
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-sm text-gray-500">Result Status</p>
          <p
            className={`text-3xl font-bold mt-2
              ${percentage >= 60 ? 'text-emerald-600' : 'text-red-600'}
            `}
          >
            {percentage >= 60 ? 'QUALIFIED ✓' : 'NOT QUALIFIED'}
          </p>
        </div>
      </div>

      {/* ===== WEAK AREAS ALERT ===== */}
      {weakSections.length > 0 && (
        <div className="max-w-5xl mx-auto bg-amber-50 border border-amber-200 rounded-3xl shadow p-8 mb-10">
          <div className="flex items-start gap-4">
            <div className="text-3xl">⚠️</div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-amber-800 mb-3">
                Areas That Need Improvement
              </h2>
              <p className="text-amber-700 text-sm mb-4">
                Based on your performance, we've identified the following sections where you need more practice:
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {weakSections.map((sec, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
                  >
                    {sec.topic} - {sec.subtopic}
                  </span>
                ))}
              </div>
              <p className="text-amber-600 text-xs">
                💡 Practice more on these topics to improve your score and qualify!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== SECTION PERFORMANCE ===== */}
      <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow p-8 mb-10">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Section-wise Performance
        </h2>

        <div className="space-y-4">
          {result.sectionResults.map((sec, idx) => {
            const secPercentage = Math.round((sec.score / sec.total) * 100);
            const isWeak = secPercentage < 50;
            const isAverage = secPercentage >= 50 && secPercentage < 70;
            
            return (
              <div
                key={idx}
                className={`border rounded-xl p-4 flex justify-between items-center
                  ${isWeak ? 'border-red-200 bg-red-50' : 
                    isAverage ? 'border-amber-200 bg-amber-50' : 
                    'border-emerald-200 bg-emerald-50'}
                `}
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {sec.topic} – {sec.subtopic}
                  </p>
                  <p className="text-xs text-gray-500">
                    Difficulty: {sec.difficulty}
                  </p>
                  {isWeak && (
                    <span className="inline-block mt-1 text-xs text-red-600 font-medium">
                      ⚠️ Needs Practice
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <p className="font-bold text-lg">
                    {sec.score} / {sec.total}
                  </p>
                  <p
                    className={`text-xs font-semibold
                      ${isWeak ? 'text-red-600' : 
                        isAverage ? 'text-amber-600' : 'text-emerald-600'}
                    `}
                  >
                    {secPercentage}%
                    {!isWeak && !isAverage && ' ✓'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== ADAPTIVE LEARNING INFO ===== */}
      {result.weakAreaAnalysis && (
        <div className="max-w-5xl mx-auto bg-blue-50 border border-blue-200 rounded-3xl shadow p-8 mb-10">
          <div className="flex items-start gap-4">
            <div className="text-3xl">📊</div>
            <div>
              <h2 className="text-xl font-bold text-blue-800 mb-2">
                Adaptive Learning Activated
              </h2>
              <p className="text-blue-700 text-sm">
                Your performance has been analyzed. Cycle #{result.weakAreaAnalysis.cycleNumber}
              </p>
              {result.weakAreaAnalysis.weakSections?.length > 0 && (
                <p className="text-blue-600 text-xs mt-2">
                  📝 Targeted practice assessments will be available soon for your weak areas.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ACTIONS ===== */}
      <div className="max-w-5xl mx-auto flex justify-between">
        <button
          onClick={() => navigate('/student')}
          className="px-6 py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
        >
          ← Back to Dashboard
        </button>

        <button
          onClick={() => window.print()}
          className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
        >
          Download Result
        </button>
      </div>
    </div>
  );
};

export default PlacementResult;

