/**
 * FaceAnalyticsDashboard Component
 * Displays comprehensive face detection analytics and insights
 */

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './FaceAnalyticsDashboard.css';

function FaceAnalyticsDashboard({ analytics }) {
  const [displayMetrics, setDisplayMetrics] = useState(null);
  const [emotionChartData, setEmotionChartData] = useState([]);

  useEffect(() => {
    if (!analytics) return;

    // Process analytics data for display
    const metrics = {
      presence: analytics.presence || {},
      attention: analytics.attention || {},
      emotion: analytics.emotion || {},
      antiCheat: analytics.antiCheat || {},
    };

    setDisplayMetrics(metrics);

    // Prepare emotion chart data
    if (metrics.emotion?.distribution) {
      const emotionData = Object.entries(metrics.emotion.distribution).map(([emotion, count]) => ({
        name: emotion,
        value: count,
      }));
      setEmotionChartData(emotionData);
    }
  }, [analytics]);

  if (!displayMetrics) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

  const scoreColor = (score) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <div className="analytics-dashboard">
      <h2 className="dashboard-title">📊 Interview Analytics Report</h2>

      <div className="analytics-grid">
        {/* 1️⃣ PRESENCE DETECTION */}
        <div className="metric-card presence-card">
          <h3>👤 Candidate Presence</h3>
          <div className="metric-content">
            <div className="large-metric">
              <span className="metric-value">
                {displayMetrics.presence?.percentage?.toFixed(1)}%
              </span>
              <span className="metric-label">Present</span>
            </div>
            <div className="metric-details">
              <p>Total Checks: <strong>{displayMetrics.presence?.totalDetections || 0}</strong></p>
              <p>Detected: <strong>{displayMetrics.presence?.detected || 0}</strong></p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayMetrics.presence?.percentage || 0}%`,
                    backgroundColor: scoreColor(displayMetrics.presence?.percentage || 0),
                  }}
                />
              </div>
            </div>
          </div>
          <div className="metric-status">
            {(displayMetrics.presence?.percentage || 0) >= 90
              ? '✅ Excellent presence'
              : (displayMetrics.presence?.percentage || 0) >= 70
              ? '⚠️ Good presence'
              : '❌ Poor presence'}
          </div>
        </div>

        {/* 2️⃣ ATTENTION TRACKING */}
        <div className="metric-card attention-card">
          <h3>👁️ Attention & Focus</h3>
          <div className="metric-content">
            <div className="large-metric">
              <span className="metric-value">
                {displayMetrics.attention?.averageScore?.toFixed(0)}%
              </span>
              <span className="metric-label">Attention Score</span>
            </div>
            <div className="metric-details">
              <p>Looking Away: <strong>{displayMetrics.attention?.lookingAway || 0}</strong> times</p>
              <p>Looking Away Time: <strong>{displayMetrics.attention?.lookingAwayPercentage?.toFixed(1)}%</strong></p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${displayMetrics.attention?.averageScore || 0}%`,
                    backgroundColor: scoreColor(displayMetrics.attention?.averageScore || 0),
                  }}
                />
              </div>
            </div>
          </div>
          <div className="metric-status">
            {(displayMetrics.attention?.averageScore || 0) >= 80
              ? '✅ Highly focused'
              : (displayMetrics.attention?.averageScore || 0) >= 60
              ? '⚠️ Moderately focused'
              : '❌ Low focus'}
          </div>
        </div>

        {/* 3️⃣ EMOTION ANALYSIS */}
        <div className="metric-card emotion-card">
          <h3>😊 Emotional State</h3>
          <div className="emotion-distribution">
            {emotionChartData.length > 0 ? (
              <div className="emotion-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={emotionChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {emotionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="no-data">No emotion data available</p>
            )}
          </div>
          <div className="emotion-legend">
            {emotionChartData.map((emotion, idx) => (
              <div key={emotion.name} className="emotion-item">
                <span
                  className="emotion-color"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span>{emotion.name}: {emotion.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 4️⃣ ANTI-CHEATING */}
        <div className="metric-card anticheating-card">
          <h3>🚨 Anti-Cheating Detection</h3>
          <div className="metric-content">
            <div className="large-metric">
              <span className="metric-value">
                {displayMetrics.antiCheat?.riskLevel === 'LOW' ? '✅' : '❌'}
              </span>
              <span className="metric-label">{displayMetrics.antiCheat?.riskLevel || 'UNKNOWN'} Risk</span>
            </div>
            <div className="metric-details">
              <p>Total Incidents: <strong>{displayMetrics.antiCheat?.totalIncidents || 0}</strong></p>
              <p>Multiple Faces: <strong>{displayMetrics.antiCheat?.multiipleFacesIncidents || 0}</strong></p>
              {displayMetrics.antiCheat?.totalIncidents > 0 && (
                <div className="warning-box">
                  ⚠️ Suspicious activity detected
                </div>
              )}
            </div>
          </div>
          <div className="metric-status">
            {displayMetrics.antiCheat?.riskLevel === 'LOW'
              ? '✅ No cheating indicators'
              : '❌ Cheating risk detected'}
          </div>
        </div>
      </div>

      {/* Detailed Metrics Section */}
      <div className="detailed-metrics">
        <div className="detail-card">
          <h4>📈 Attention Timeline</h4>
          <p className="metric-item">
            Total Checks: <span className="value">{displayMetrics.attention?.totalChecks}</span>
          </p>
          <p className="metric-item">
            Average Attention: <span className="value">{displayMetrics.attention?.averageScore?.toFixed(1)}%</span>
          </p>
        </div>

        <div className="detail-card">
          <h4>👤 Identity Verification</h4>
          <p className="metric-item">
            Status: <span className="value">Pending verification</span>
          </p>
          <p className="metric-item">
            Match Score: <span className="value">N/A</span>
          </p>
        </div>

        <div className="detail-card">
          <h4>🎯 Overall Interview Score</h4>
          <div className="overall-score">
            <div className="score-circle">
              <span className="score-number">
                {(
                  ((displayMetrics.presence?.percentage || 0) +
                    (displayMetrics.attention?.averageScore || 0)) /
                  2
                ).toFixed(0)}
              </span>
              <span className="score-label">%</span>
            </div>
            <p className="score-description">
              Based on presence and attention metrics
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-section">
        <h4>📋 Summary</h4>
        <ul className="summary-list">
          <li>
            ✅ Candidate was present for{' '}
            <strong>{displayMetrics.presence?.percentage?.toFixed(1)}%</strong> of the interview
          </li>
          <li>
            👁️ Average attention score: <strong>{displayMetrics.attention?.averageScore?.toFixed(0)}%</strong>
          </li>
          <li>
            😊 Most common emotion:{' '}
            <strong>
              {emotionChartData.length > 0
                ? emotionChartData.reduce((prev, current) =>
                    prev.value > current.value ? prev : current
                  ).name
                : 'Unknown'}
            </strong>
          </li>
          <li>
            🚨 Anti-cheating risk level: <strong>{displayMetrics.antiCheat?.riskLevel || 'UNKNOWN'}</strong>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default FaceAnalyticsDashboard;
