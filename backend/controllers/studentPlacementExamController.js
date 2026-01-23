const PlacementExamFormat = require('../models/PlacementExamFormat');
const ParsedQuestion = require('../models/ParsedQuestion');
const Assessment = require('../models/Assessment');
const StudentQuestionHistory = require('../models/StudentQuestionHistory');

exports.startPlacementExam = async (req, res) => {
  try {
    const { formatId } = req.body;
    const studentId = req.user._id;

    /* ===============================
       FETCH FORMAT
    =============================== */
    const format = await PlacementExamFormat.findById(formatId);
    if (!format) {
      return res.status(404).json({ message: 'Placement format not found' });
    }

    /* ===============================
       FETCH / CREATE HISTORY
    =============================== */
    let history = await StudentQuestionHistory.findOne({
      studentId,
      company: format.company
    });

    if (!history) {
      history = await StudentQuestionHistory.create({
        studentId,
        company: format.company,
        recentQuestionIds: []
      });
    }

    /* ===============================
       BUILD SECTION-WISE QUESTIONS
    =============================== */
    const finalSections = [];

    for (const section of format.sections) {
      const parsedDoc = await ParsedQuestion.findOne({
        company: format.company,
        topic: section.topic,
        subfolder: section.subtopic
      });

      if (!parsedDoc || !parsedDoc.questionsByDifficulty) continue;

      let pool =
        parsedDoc.questionsByDifficulty[section.difficulty] || [];

      // 🔐 NO-REPEAT LOGIC
      pool = pool.filter(
        q => !history.recentQuestionIds.includes(q.questionId)
      );

      // fallback if pool is small
      if (pool.length < section.questionCount) {
        pool =
          parsedDoc.questionsByDifficulty[section.difficulty];
      }

      const selected = pool
        .sort(() => 0.5 - Math.random())
        .slice(0, section.questionCount);

      finalSections.push({
        topic: section.topic,
        subtopic: section.subtopic,
        difficulty: section.difficulty,
        questions: selected
      });
    }

    if (!finalSections.length) {
      return res.status(400).json({
        message: 'No questions available for this exam'
      });
    }

    /* ===============================
       UPDATE HISTORY (LAST ~8 EXAMS)
    =============================== */
    const newQuestionIds = finalSections.flatMap(sec =>
      sec.questions.map(q => q.questionId)
    );

    history.recentQuestionIds = [
      ...history.recentQuestionIds,
      ...newQuestionIds
    ].slice(-200); // ≈ last 8 exams

    await history.save();

    /* ===============================
       CREATE ASSESSMENT
    =============================== */
    const assessment = await Assessment.create({
      title: format.examName,
      companyName: format.company,
      duration: format.duration,
      totalMarks: finalSections.reduce(
        (sum, sec) => sum + sec.questions.length,
        0
      ),
      sections: finalSections,
      assessmentType: 'placement',
      isPractice: true,
      createdBy: studentId
    });

    res.status(201).json({
      success: true,
      assessment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
