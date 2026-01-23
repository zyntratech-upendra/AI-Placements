const PlacementExamFormat = require('../models/PlacementExamFormat');

/**
 * Admin creates placement exam format (BLUEPRINT)
 */
exports.createPlacementExamFormat = async (req, res) => {
  try {
    const { company, examName, duration, sections } = req.body;

    if (!sections || sections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one section is required'
      });
    }

    const format = await PlacementExamFormat.create({
      company,
      examName,
      duration,
      sections,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      format
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all formats for a company
 */
exports.getFormatsByCompany = async (req, res) => {
  try {
    const formats = await PlacementExamFormat.find({
      company: req.params.company
    }).sort('-createdAt');

    res.json({ success: true, formats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.previewQuestionCount = async (req, res) => {
  const { company, topic, subtopic, difficulty } = req.query;

  const parsedDoc = await ParsedQuestion.findOne({
    company,
    topic,
    subfolder: subtopic
  });

  if (!parsedDoc || !parsedDoc.questionsByDifficulty) {
    return res.json({ count: 0 });
  }

  const pool =
    parsedDoc.questionsByDifficulty[difficulty] || [];

  res.json({ count: pool.length });
};


exports.updatePlacementExamFormat = async (req, res) => {
  const updated = await PlacementExamFormat.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json({ success: true, updated });
};

exports.clonePlacementExamFormat = async (req, res) => {
  try {
    const original = await PlacementExamFormat.findById(req.params.id);

    const clone = await PlacementExamFormat.create({
      ...original.toObject(),
      _id: undefined,
      examName: original.examName + ' (Clone)',
      createdAt: undefined,
      updatedAt: undefined
    });

    res.json({ success: true, clone });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPlacementCompanies = async (req, res) => {
  const companies = await PlacementExamFormat.distinct('company', {
    isActive: true
  });
  console.log(companies);
  res.json({ companies });
};
