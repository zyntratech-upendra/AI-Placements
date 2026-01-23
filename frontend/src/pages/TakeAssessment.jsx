import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';

const TakeAssessment = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAssessment();
  }, [assessmentId]);

  useEffect(() => {
    if (!attempt || !assessment) return;

    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (timeLeft === 0 && attempt.status !== 'submitted') {
      handleSubmit();
    }
  }, [timeLeft, attempt, assessment]);

  const initializeAssessment = async () => {
    try {
      const { data } = await api.post('/attempts/start', { assessmentId });

      if (!data.assessment || !data.assessment.questions?.length) {
        throw new Error('Assessment has no questions');
      }
      console.log('Assessment Data:', data.assessment);

      setAssessment(data.assessment);
      setAttempt(data.attempt);
      setTimeLeft(data.assessment.duration * 60);
      setLoading(false);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || error.message);
      navigate('/student');
    }
  };

  const getOptionKey = (index) => String.fromCharCode(65 + index);

  const handleAnswerSelect = async (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));

    try {
      await api.post('/attempts/answer', {
        attemptId: attempt._id,
        questionId,
        selectedAnswer: answer
      });
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const { data } = await api.post('/attempts/submit', {
        attemptId: attempt._id
      });
      navigate(`/assessment-results/${data.attempt._id}`);
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || error.message);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !assessment?.questions?.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const question = assessment.questions?.[currentQuestion]?.[0];
  if (!question) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{assessment.title}</h1>
            <p className="text-sm text-gray-600">{assessment.companyName}</p>
          </div>
          <div className="flex space-x-6">
            <div>
              <p className="text-sm text-gray-600">Time Left</p>
              <p className={`text-2xl font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-blue-600'}`}>
                {formatTime(timeLeft)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Progress</p>
              <p className="text-2xl font-bold">
                {currentQuestion + 1}/{assessment.questions.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-6">{question.text}</h2>

          <div className="space-y-3">
            {question.options.map((option, index) => {
              const optionKey = getOptionKey(index);
              const isSelected = answers[question.id] === optionKey;

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(question.id, optionKey)}
                  className={`w-full p-4 text-left rounded-lg border-2 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-6 h-6 mr-3 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <div className="w-3 h-3 bg-white rounded-full"></div>}
                    </div>
                    {option}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentQuestion(q => Math.max(0, q - 1))}
            disabled={currentQuestion === 0}
            className="btn btn-secondary disabled:opacity-50"
          >
            ← Previous
          </button>

          <div className="flex space-x-2">
            {assessment.questions.map((qArr, index) => {
              const q = qArr[0];
              return (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-10 h-10 rounded-lg font-medium ${
                    index === currentQuestion
                      ? 'bg-blue-600 text-white'
                      : answers[q.id]
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {currentQuestion < assessment.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestion(q => q + 1)}
              className="btn btn-primary"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="btn bg-green-600 hover:bg-green-700 text-white"
            >
              Submit Assessment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TakeAssessment;
