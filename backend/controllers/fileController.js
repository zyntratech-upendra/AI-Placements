const File = require('../models/File');
const Folder = require('../models/Folder');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const { folderId } = req.body;

    const folder = await Folder.findById(folderId);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    const file = await File.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      folder: folderId,
      uploadedBy: req.user._id
    });

    folder.fileCount += 1;
    await folder.save();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAllFiles = async (req, res) => {
  try {
    const files = await File.find()
      .populate('folder', 'name companyName')
      .populate('uploadedBy', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getFilesByFolder = async (req, res) => {
  try {
    const files = await File.find({ folder: req.params.folderId })
      .populate('uploadedBy', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const folder = await Folder.findById(file.folder);
    if (folder) {
      folder.fileCount = Math.max(0, folder.fileCount - 1);
      await folder.save();
    }

    await File.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.processOCR = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
   

    if (!fs.existsSync(file.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on disk'
      });
    }

    file.ocrStatus = 'processing';
    await file.save();

    try {
      const formData = new FormData();
      // Include filename so FastAPI can determine file extension
      formData.append('file', fs.createReadStream(file.filePath), {
        filename: file.originalName || file.filename,
        contentType: file.fileType
      });
      // ✅ NEW: Include folderId and fileId for folder context
      formData.append('folderId', file.folder.toString());
      formData.append('fileId', file._id.toString());
      
      // ML service is now integrated into interview-backend (port 8000)
      // Can be overridden via ML_SERVICE_URL env variable if running separately
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      console.log(`Sending OCR request to: ${ML_SERVICE_URL}/api/parse-document`);
      console.log(`File: ${file.originalName}, Path: ${file.filePath}, FolderId: ${file.folder}`);
      
      const response = await axios.post(`${ML_SERVICE_URL}/api/parse-document`, formData, {
        headers: formData.getHeaders(),
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      console.log('OCR Service Response:', response.data);

      if (!response.data.success) {
        throw new Error(response.data.error || 'OCR processing failed');
      }

      // ML service now handles storing questions in MongoDB with single-document-per-folder pattern
      // No need to insert questions here - just update file status
      file.ocrProcessed = true;
      file.ocrStatus = 'completed';
      file.questionsExtracted = response.data.questionsCount || 0;
      await file.save();

      res.status(200).json({
        success: true,
        message: 'OCR processing completed',
        questionsCount: response.data.questionsCount,
        totalByDifficulty: response.data.totalByDifficulty,
        folderPath: response.data.folderPath,
        folderContext: response.data.folderContext
      });
    } catch (ocrError) {
      file.ocrStatus = 'failed';
      file.ocrError = ocrError.message;
      await file.save();

      // Log detailed error for debugging
      console.error('OCR Error Details:', {
        message: ocrError.message,
        response: ocrError.response?.data,
        status: ocrError.response?.status,
        code: ocrError.code
      });

      return res.status(500).json({
        success: false,
        message: 'OCR service error',
        error: ocrError.response?.data?.error || ocrError.message || 'Unknown error occurred',
        details: ocrError.response?.data || null
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getParsedQuestionsByFolder = async (req, res) => {
  try {
    const { folderId } = req.params;
    
    // Import ParsedQuestion model
    const ParsedQuestion = require('../models/ParsedQuestion');
    
    // Query MongoDB for parsed questions by folder
    const parsedQuestions = await ParsedQuestion.findOne({ folderId: folderId });
    
    if (!parsedQuestions) {
      return res.status(404).json({
        success: false,
        message: 'No parsed questions found for this folder'
      });
    }

    res.status(200).json({
      success: true,
      parsedQuestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
