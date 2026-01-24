const InterviewCompany = require('../models/InterviewCompany');
const InterviewQuestion = require('../models/InterviewQuestion');

// ==================== COMPANY OPERATIONS ====================

// Get all interview companies
exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await InterviewCompany.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching companies',
      error: error.message
    });
  }
};

// Get single interview company with its questions
exports.getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await InterviewCompany.findById(id)
      .populate('createdBy', 'name email');

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const questions = await InterviewQuestion.find({ company: id })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        company,
        questions,
        questionCount: questions.length
      }
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company',
      error: error.message
    });
  }
};

// Create new interview company
exports.createCompany = async (req, res) => {
  try {
    const { name, description, industry, headquarters } = req.body;
    const userId = req.user?._id || req.user?.id || req.userId;

    // Validate user ID
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Check if company already exists
    const existingCompany = await InterviewCompany.findOne({
      name: { $regex: `^${name}$`, $options: 'i' }
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company with this name already exists'
      });
    }

    const company = await InterviewCompany.create({
      name: name.trim(),
      description: description?.trim() || '',
      industry: industry?.trim() || '',
      headquarters: headquarters?.trim() || '',
      createdBy: userId
    });

    await company.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating company',
      error: error.message
    });
  }
};

// Update interview company
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, industry, headquarters } = req.body;

    const company = await InterviewCompany.findById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Check if new name already exists (if name is being changed)
    if (name && name !== company.name) {
      const existingCompany = await InterviewCompany.findOne({
        name: { $regex: `^${name}$`, $options: 'i' },
        _id: { $ne: id }
      });

      if (existingCompany) {
        return res.status(400).json({
          success: false,
          message: 'Company with this name already exists'
        });
      }

      company.name = name.trim();
    }

    if (description !== undefined) company.description = description.trim();
    if (industry !== undefined) company.industry = industry.trim();
    if (headquarters !== undefined) company.headquarters = headquarters.trim();

    await company.save();
    await company.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating company',
      error: error.message
    });
  }
};

// Delete interview company
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await InterviewCompany.findById(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Delete all questions associated with this company
    await InterviewQuestion.deleteMany({ company: id });

    await InterviewCompany.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Company and associated questions deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting company',
      error: error.message
    });
  }
};

// ==================== QUESTION OPERATIONS ====================

// Get all questions for a company
exports.getCompanyQuestions = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { category, difficulty } = req.query;

    // Build filter
    const filter = { company: companyId };
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;

    const questions = await InterviewQuestion.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching questions',
      error: error.message
    });
  }
};

// Get single question
exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await InterviewQuestion.findById(id)
      .populate('company', 'name')
      .populate('createdBy', 'name email');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching question',
      error: error.message
    });
  }
};

// Create new interview question
exports.createQuestion = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      title,
      description,
      category,
      difficulty,
      expectedAnswer,
      tips,
      tags
    } = req.body;

    const userId = req.user?._id || req.user?.id || req.userId;

    // Validate user ID
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required'
      });
    }

    // Verify company exists
    const company = await InterviewCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const question = await InterviewQuestion.create({
      company: companyId,
      title: title.trim(),
      description: description.trim(),
      category: category || 'Technical',
      difficulty: difficulty || 'Medium',
      expectedAnswer: expectedAnswer?.trim() || '',
      tips: tips?.trim() || '',
      tags: Array.isArray(tags) ? tags.filter(t => t.trim()) : [],
      createdBy: userId
    });

    await question.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: question
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating question',
      error: error.message
    });
  }
};

// Update interview question
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      difficulty,
      expectedAnswer,
      tips,
      tags,
      isActive
    } = req.body;

    const question = await InterviewQuestion.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    if (title) question.title = title.trim();
    if (description) question.description = description.trim();
    if (category) question.category = category;
    if (difficulty) question.difficulty = difficulty;
    if (expectedAnswer !== undefined) question.expectedAnswer = expectedAnswer.trim();
    if (tips !== undefined) question.tips = tips.trim();
    if (tags !== undefined) question.tags = Array.isArray(tags) ? tags.filter(t => t.trim()) : [];
    if (isActive !== undefined) question.isActive = isActive;

    await question.save();
    await question.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      data: question
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating question',
      error: error.message
    });
  }
};

// Delete interview question
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await InterviewQuestion.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    await InterviewQuestion.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting question',
      error: error.message
    });
  }
};

// Bulk add questions
exports.bulkAddQuestions = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { questions } = req.body;
    const userId = req.user?._id || req.user?.id || req.userId;

    // Validate user ID
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Questions array is required and must not be empty'
      });
    }

    // Verify company exists
    const company = await InterviewCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    // Prepare questions with company reference
    const questionsToAdd = questions.map(q => ({
      company: companyId,
      title: q.title?.trim(),
      description: q.description?.trim(),
      category: q.category || 'Technical',
      difficulty: q.difficulty || 'Medium',
      expectedAnswer: q.expectedAnswer?.trim() || '',
      tips: q.tips?.trim() || '',
      tags: Array.isArray(q.tags) ? q.tags.filter(t => t.trim()) : [],
      createdBy: userId,
      isActive: true
    }));

    const createdQuestions = await InterviewQuestion.insertMany(questionsToAdd);

    res.status(201).json({
      success: true,
      message: `${createdQuestions.length} questions added successfully`,
      count: createdQuestions.length,
      data: createdQuestions
    });
  } catch (error) {
    console.error('Error adding questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding questions',
      error: error.message
    });
  }
};

// Get statistics for a company
exports.getCompanyStats = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await InterviewCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    const totalQuestions = await InterviewQuestion.countDocuments({ company: companyId });

    const questionsByCategory = await InterviewQuestion.aggregate([
      { $match: { company: mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const questionsByDifficulty = await InterviewQuestion.aggregate([
      { $match: { company: mongoose.Types.ObjectId(companyId) } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        company: company.name,
        totalQuestions,
        byCategory: questionsByCategory,
        byDifficulty: questionsByDifficulty
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};
