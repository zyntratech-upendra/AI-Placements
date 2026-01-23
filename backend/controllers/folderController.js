const Folder = require('../models/Folder');
const File = require('../models/File');

// Helper function to get folder hierarchy path
const getFolderPath = async (folderId) => {
  const path = [];
  let currentFolder = await Folder.findById(folderId);
  
  while (currentFolder) {
    path.unshift(currentFolder.name);
    if (currentFolder.parentFolderId) {
      currentFolder = await Folder.findById(currentFolder.parentFolderId);
    } else {
      break;
    }
  }
  
  return path.join(' > ');
};

exports.createFolder = async (req, res) => {
  try {
    const { name, companyName, description, parentFolderId } = req.body;

    // Validate that if parentFolderId is provided, parent folder exists
    if (parentFolderId) {
      const parentFolder = await Folder.findById(parentFolderId);
      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          message: 'Parent folder not found'
        });
      }
    }

    const folder = await Folder.create({
      name,
      companyName,
      description,
      parentFolderId: parentFolderId || null,
      createdBy: req.user._id
    });

    // Populate the created folder
    await folder.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Folder created successfully',
      folder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getAllFolders = async (req, res) => {
  try {
    const folders = await Folder.find()
      .populate('createdBy', 'name email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: folders.length,
      folders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.getFolderById = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('parentFolderId');

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Get files in this folder
    const files = await File.find({ folder: folder._id })
      .populate('uploadedBy', 'name email')
      .sort('-createdAt');

    // Get child folders
    const childFolders = await Folder.find({ parentFolderId: folder._id })
      .populate('createdBy', 'name email')
      .sort('name');

    // Get folder path/hierarchy
    const folderPath = await getFolderPath(folder._id);

    res.status(200).json({
      success: true,
      folder,
      files,
      childFolders,
      folderPath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.updateFolder = async (req, res) => {
  try {
    const { name, companyName, description } = req.body;

    let folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    folder = await Folder.findByIdAndUpdate(
      req.params.id,
      { name, companyName, description },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Folder updated successfully',
      folder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

exports.deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: 'Folder not found'
      });
    }

    // Delete all child folders and their files recursively
    const deleteChildFolders = async (folderId) => {
      const childFolders = await Folder.find({ parentFolderId: folderId });
      
      for (const childFolder of childFolders) {
        await deleteChildFolders(childFolder._id);
        await File.deleteMany({ folder: childFolder._id });
        await Folder.findByIdAndDelete(childFolder._id);
      }
    };

    await deleteChildFolders(folder._id);
    await File.deleteMany({ folder: folder._id });
    await Folder.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Folder and all associated files/subfolders deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get child folders of a specific folder
exports.getChildFolders = async (req, res) => {
  try {
    const { parentId } = req.params;

    const childFolders = await Folder.find({ parentFolderId: parentId })
      .populate('createdBy', 'name email')
      .sort('name');

    res.status(200).json({
      success: true,
      count: childFolders.length,
      folders: childFolders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
