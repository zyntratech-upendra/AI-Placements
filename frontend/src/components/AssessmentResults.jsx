import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';

const AssessmentResults = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState(null);

  useEffect(() => {
    fetchAttemptDetails();
  }, [attemptId]);

  const fetchAttemptDetails = async () => {
    try {
      const { data } = await api.get(`/attempts/${attemptId}`);
      setAttempt(data.attempt);
      setLoading(false);
    } catch (error) {
      console.error(error);
      alert('Error loading results');
      navigate('/student');
    }
  };

  const getOptionKey = (index) =>
    String.fromCharCode(65 + index); // A, B, C, D

  if (loading || !attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const assessment = attempt.assessment;

  // 🔑 BUILD QUESTION LOOKUP MAP (UUID → QUESTION)
  const questionMap = {};
  assessment.questions.forEach(qArr => {
    const q = qArr[0];
    questionMap[q.id] = q;
  });

  const totalQuestions = attempt.answers.length;
  const correctAnswers = attempt.answers.filter(a => a.isCorrect).length;
  const wrongAnswers = totalQuestions - correctAnswers;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">

        {/* SUMMARY */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold mb-2">{assessment.title}</h1>
          <p className="text-gray-600 mb-6">{assessment.companyName}</p>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <Stat label="Total Score" value={`${attempt.totalScore}/${assessment.totalMarks}`} color="blue" />
            <Stat label="Percentage" value={`${attempt.percentage}%`} color="green" />
            <Stat label="Correct" value={correctAnswers} color="emerald" />
            <Stat label="Wrong" value={wrongAnswers} color="red" />
          </div>
        </div>

        {/* ANSWER REVIEW */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-100 px-8 py-4 border-b">
            <h2 className="text-xl font-bold">Answer Review</h2>
          </div>

          <div className="divide-y">
            {attempt.answers.map((answer, index) => {
              const question = questionMap[answer.questionId];
              if (!question) return null;

              return (
                <div key={index}>
                  <button
                    onClick={() =>
                      setExpandedQuestion(expandedQuestion === index ? null : index)
                    }
                    className="w-full px-8 py-6 text-left hover:bg-gray-50"
                  >
                    <div className="flex justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 font-semibold">
                            {index + 1}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            answer.isCorrect
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {answer.isCorrect ? '✓ Correct' : '✗ Wrong'}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900">
                          {question.text}
                        </p>
                      </div>
                    </div>
                  </button>

                  {expandedQuestion === index && (
                    <div className="px-8 py-6 bg-gray-50 border-t space-y-4">
                      {/* Options */}
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-3">Options:</h4>
                        {question.options.map((option, optIndex) => {
                          const optionKey = getOptionKey(optIndex);
                          const isCorrect = question.answer === optionKey;
                          const isSelected = answer.selectedAnswer === optionKey;

                          return (
                            <div
                              key={optIndex}
                              className={`p-3 mb-2 rounded-lg border-2 ${
                                isCorrect
                                  ? 'border-green-500 bg-green-50'
                                  : isSelected
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <span className="font-medium">
                                {optionKey}. {option}
                              </span>
                              {isCorrect && (
                                <span className="ml-2 text-green-600 font-semibold">
                                  CORRECT
                                </span>
                              )}
                              {isSelected && !isCorrect && (
                                <span className="ml-2 text-red-600 font-semibold">
                                  YOUR ANSWER
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation Section */}
                      {question.explanation && (
                        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                          <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                            <span className="mr-2">💡</span> Explanation
                          </h4>
                          <p className="text-blue-800 leading-relaxed whitespace-pre-wrap">
                            {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button
            onClick={() => navigate('/student')}
            className="btn btn-primary px-8"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, color }) => (
  <div className={`bg-${color}-50 rounded-lg p-6`}>
    <p className="text-sm text-gray-600">{label}</p>
    <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
  </div>
);

export default AssessmentResults;
