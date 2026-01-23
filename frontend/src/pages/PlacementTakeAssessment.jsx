import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';

const PlacementTakeAssessment = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  // 🔹 Core state
  const [assessment, setAssessment] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  // 🔹 Proctoring
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  /* ===========================
     FETCH PLACEMENT ASSESSMENT
  ============================ */
  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const { data } = await api.get(
          `/placement-assessments/${assessmentId}`
        );

        const assessmentData = data.assessment;
        console.log('Fetched assessment:', assessmentData);

        setAssessment(assessmentData);
        setSections(assessmentData.sections || []);
        setTimeLeft(assessmentData.duration * 60);
        setLoading(false);
      } catch (err) {
        alert('Failed to load placement assessment');
      }
    };

    fetchAssessment();
  }, [assessmentId]);

  /* ===========================
     TIMER + AUTO SUBMIT
  ============================ */
  useEffect(() => {
    if (!timeLeft) return;

    if (timeLeft <= 0) {
      submitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  /* ===========================
     TAB SWITCH DETECTION
  ============================ */
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const next = prev + 1;

          if (next === 1) {
            alert('⚠ Warning: Tab switching is not allowed.');
          }

          if (next >= 3) {
            alert('❌ Exam auto-submitted due to multiple tab switches.');
            submitExam();
          }

          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  /* ===========================
     HELPERS
  ============================ */
  const currentSection = sections[activeSectionIndex];
  const questions = currentSection?.questions || [];
  const currentQuestion = questions[activeQuestionIndex];

  const formatTime = () => {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${m}m ${s}s`;
  };

  // Helper function to convert index to option letter (0->A, 1->B, 2->C, 3->D)
  const getOptionKey = (index) => String.fromCharCode(65 + index);

  // Helper to get consistent question ID (questionId, _id, or fallback)
  const getQuestionId = (question, sectionIdx, questionIdx) => {
    return question?.questionId || question?._id || `sec${sectionIdx}-q${questionIdx}`;
  };

  // Current question's ID for answer tracking
  const currentQuestionId = currentQuestion ? getQuestionId(currentQuestion, activeSectionIndex, activeQuestionIndex) : null;

  /* ===========================
     SUBMIT EXAM
  ============================ */
  const submitExam = async () => {
    try {
      const answersArray = [];

      console.log(questions);

      sections.forEach((section, sectionIdx) => {
        section.questions.forEach((question, questionIdx) => {
          // Use questionId, fall back to _id, or generate one
          const qId = question.questionId || question._id || `sec${sectionIdx}-q${questionIdx}`;
          
          const userSelectedIndex = answers[qId] !== undefined ? answers[qId] : '';
          const userSelectedAnswer = userSelectedIndex !== '' ? getOptionKey(userSelectedIndex) : '';
          const correctAnswer = question.answer || '';
          console.log(`Q${questionIdx}: ${userSelectedAnswer} vs ${correctAnswer}`);
          const isAnswerCorrect = userSelectedAnswer === correctAnswer;
          const marks = isAnswerCorrect ? (question.marks || 1) : 0;

          answersArray.push({
            questionId: qId,
            selectedAnswer: userSelectedAnswer,
            isCorrect: isAnswerCorrect,
            marksObtained: marks
          });
        });
      });

      console.log(answersArray)

      const { data } = await api.post(
        `/placement-assessments/${assessmentId}/submit`,
        { answers: answersArray }
      );

      navigate(`/placement/result/${data.attempt._id}`);
    } catch (error) {
      alert('Failed to submit exam');
    }
  };

  if (loading || !assessment || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading placement exam...</p>
      </div>
    );
  }

  /* ===========================
     UI
  ============================ */
return (
  <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200">

    {/* ===== HEADER ===== */}
    <div className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            {assessment.title}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            🏢 {assessment.companyName} · Official Placement Examination
          </p>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-600 font-medium">
            Section {activeSectionIndex + 1} of {sections.length}
          </span>
          <span className="bg-red-600 text-white px-5 py-1.5 rounded-full font-semibold text-sm shadow">
            ⏱ {formatTime()}
          </span>
        </div>
      </div>
    </div>

    {/* ===== BODY ===== */}
    <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-5 gap-6">

      {/* ===== SECTIONS PANEL ===== */}
      <div className="md:col-span-1 bg-white rounded-2xl shadow-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Exam Sections
        </h3>

        {sections.map((sec, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveSectionIndex(idx);
              setActiveQuestionIndex(0);
            }}
            className={`w-full text-left px-4 py-3 rounded-xl mb-3 transition-all duration-200
              ${
                idx === activeSectionIndex
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }
            `}
          >
            <p className="text-sm font-semibold">
              {sec.topic}
            </p>
            <p className="text-xs opacity-80">
              {sec.subtopic}
            </p>
          </button>
        ))}
      </div>

      {/* ===== QUESTION PANEL ===== */}
      <div className="md:col-span-3 bg-white rounded-2xl shadow-lg p-8">

        <div className="flex justify-between items-center mb-4">
          <p className="text-xs font-medium text-gray-500">
            Difficulty:
            <span className="ml-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              {currentSection.difficulty}
            </span>
          </p>

          <p className="text-xs text-gray-400">
            Question {activeQuestionIndex + 1} / {questions.length}
          </p>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 leading-relaxed mb-6">
          {activeQuestionIndex + 1}. {currentQuestion.text}
        </h2>

        <div className="space-y-3">
          {currentQuestion.options.map((opt, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl border cursor-pointer transition-all
                ${
                  answers[currentQuestionId] === idx
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }
              `}
            >
              <input
                type="radio"
                className="accent-indigo-600"
                checked={answers[currentQuestionId] === idx}
                onChange={() =>
                  setAnswers({
                    ...answers,
                    [currentQuestionId]: idx,
                  })
                }
              />
              <span className="text-sm text-gray-800">
                {opt}
              </span>
            </label>
          ))}
        </div>

        {/* ===== NAVIGATION ===== */}
        <div className="flex justify-between mt-10">
          <button
            disabled={activeQuestionIndex === 0}
            onClick={() => setActiveQuestionIndex(i => i - 1)}
            className="px-6 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-40"
          >
            ← Previous
          </button>

          {activeQuestionIndex === questions.length - 1 ? (
            // Last question of current section
            activeSectionIndex === sections.length - 1 ? (
              // Last section - show Submit
              <button
                onClick={submitExam}
                className="px-8 py-2 rounded-xl bg-red-600 text-white font-semibold shadow hover:bg-red-700"
              >
                Submit Exam
              </button>
            ) : (
              // More sections remain - show Next Section
              <button
                onClick={() => {
                  setActiveSectionIndex(i => i + 1);
                  setActiveQuestionIndex(0);
                }}
                className="px-8 py-2 rounded-xl bg-purple-600 text-white font-semibold shadow hover:bg-purple-700"
              >
                Next Section →
              </button>
            )
          ) : (
            <button
              onClick={() => setActiveQuestionIndex(i => i + 1)}
              className="px-8 py-2 rounded-xl bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* ===== QUESTION NAVIGATOR ===== */}
      <div className="md:col-span-1 bg-white rounded-2xl shadow-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Question Navigator
        </h3>

        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, i) => {
            const qId = getQuestionId(q, activeSectionIndex, i);
            return (
              <button
                key={qId}
                onClick={() => setActiveQuestionIndex(i)}
                className={`h-10 rounded-lg text-sm font-semibold transition
                  ${
                    i === activeQuestionIndex
                      ? 'bg-indigo-600 text-white'
                      : answers[qId] !== undefined
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                  }
                `}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="mt-5 text-xs text-gray-500 space-y-1">
          <p>🟩 Answered</p>
          <p>⬜ Not Answered</p>
         
        </div>
      </div>
    </div>
  </div>
);

};

export default PlacementTakeAssessment;
