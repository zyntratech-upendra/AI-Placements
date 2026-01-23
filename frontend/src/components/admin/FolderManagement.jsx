import { useState, useEffect } from 'react';
import api from '../../config/api';

const FolderManagement = () => {
  // Step Management
  const [creationStep, setCreationStep] = useState('main'); // main, topic, navigate, subfolder, addTopic, addSubfolder
  const [parentFolder, setParentFolder] = useState(null);
  const [createdTopics, setCreatedTopics] = useState([]); // Store created topics
  const [selectedTopicForSubfolder, setSelectedTopicForSubfolder] = useState(null); // Selected for adding subfolders
  const [subFolders, setSubFolders] = useState([]); // Array of subfolder names
  const [newSubFolder, setNewSubFolder] = useState('');
  const [folders, setFolders] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [isAddingFromNavigation, setIsAddingFromNavigation] = useState(false); // Track if adding from navigation
  
  // Main Folder Creation
  const [newFolder, setNewFolder] = useState({
    name: '',
    companyName: '',
    description: ''
  });

  // Topic and Difficulty Lists
  const [topics, setTopics] = useState(['Aptitude', 'Reasoning', 'General Knowledge']);
  const [difficulties] = useState(['Easy', 'Medium', 'Difficult']);
  const [selectedTopics, setSelectedTopics] = useState({});
  const [newTopic, setNewTopic] = useState('');
  
  // Navigation
  const [navigationPath, setNavigationPath] = useState([]); // Track path
  const [childFolders, setChildFolders] = useState([]);
  
  const [uploadFile, setUploadFile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const { data } = await api.get('/folders');
      // Filter to show only root folders (no parentFolderId)
      const rootFolders = data.folders.filter(f => !f.parentFolderId);
      setFolders(rootFolders || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const fetchChildFolders = async (parentId) => {
    try {
      const { data } = await api.get('/folders');
      // Filter to show only folders with matching parentFolderId
      let children = data.folders.filter(f => f.parentFolderId === parentId);
      
      // If we're at subfolder level (navigationPath.length === 3), calculate total files in difficulty folders
      if (navigationPath.length === 3) {
        children = children.map(subfolder => {
          // Get all difficulty folders under this subfolder
          const difficultyFolders = data.folders.filter(f => f.parentFolderId === subfolder._id);
          // Calculate total files by summing fileCount of all difficulty folders
          const totalFileCount = difficultyFolders.reduce((sum, diff) => sum + (diff.fileCount || 0), 0);
          return {
            ...subfolder,
            fileCount: totalFileCount
          };
        });
      }
      
      setChildFolders(children || []);
    } catch (error) {
      console.error('Error fetching child folders:', error);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (creationStep === 'main') {
        // Step 1: Create main folder
        const { data } = await api.post('/folders', newFolder);
        setParentFolder(data.folder);
        setCreationStep('topic');
        setSelectedTopics({});
      } else if (creationStep === 'topic') {
        // Step 2: Create multiple topics
        const topicsToCreate = topics.filter(topic => selectedTopics[topic]);
        
        if (topicsToCreate.length === 0) {
          alert('Please select at least one topic');
          setLoading(false);
          return;
        }

        const created = [];
        for (const topic of topicsToCreate) {
          const topicFolderData = await api.post('/folders', {
            name: topic,
            companyName: parentFolder.companyName,
            description: `${topic} questions for ${parentFolder.name}`,
            parentFolderId: parentFolder._id
          });
          created.push(topicFolderData.data.folder);
        }
        
        setCreatedTopics(created);
        setCreationStep('navigate');
        setLoading(false);
        return;
      } else if (creationStep === 'navigate') {
        // Step 3: Selected a topic to add subfolders
        if (!selectedTopicForSubfolder) {
          alert('Please select a topic');
          setLoading(false);
          return;
        }
        setCreationStep('subfolder');
        setLoading(false);
        return;
      } else if (creationStep === 'subfolder') {
        // Step 4: Create all subfolders for the selected topic
        if (subFolders.length === 0) {
          alert('Please add at least one subfolder');
          setLoading(false);
          return;
        }

        // Create each subfolder and its difficulty levels
        for (const subFolderName of subFolders) {
          const subFolderData = await api.post('/folders', {
            name: subFolderName,
            companyName: parentFolder.companyName,
            description: `${subFolderName} for ${selectedTopicForSubfolder.name}`,
            parentFolderId: selectedTopicForSubfolder._id
          });

          // Create difficulty folders under each subfolder
          for (const difficulty of difficulties) {
            await api.post('/folders', {
              name: difficulty,
              companyName: parentFolder.companyName,
              description: `${difficulty} level questions`,
              parentFolderId: subFolderData.data.folder._id
            });
          }
        }

        // Ask if user wants to add subfolders to another topic
        if (window.confirm('Subfolders created! Do you want to add subfolders to another topic?')) {
          setCreationStep('navigate');
          setSelectedTopicForSubfolder(null);
          setSubFolders([]);
          setNewSubFolder('');
        } else {
          // Reset and finish
          setShowCreateModal(false);
          setNewFolder({ name: '', companyName: '', description: '' });
          setParentFolder(null);
          setCreatedTopics([]);
          setSelectedTopicForSubfolder(null);
          setSubFolders([]);
          setNewSubFolder('');
          setSelectedTopics({});
          setCreationStep('main');
          fetchFolders();
          alert('Folder hierarchy created successfully!');
        }
      } else if (creationStep === 'addTopic') {
        // Adding topic from navigation
        const topicsToCreate = topics.filter(topic => selectedTopics[topic]);
        
        if (topicsToCreate.length === 0) {
          alert('Please select at least one topic');
          setLoading(false);
          return;
        }

        for (const topic of topicsToCreate) {
          await api.post('/folders', {
            name: topic,
            companyName: parentFolder.companyName,
            description: `${topic} questions for ${parentFolder.name}`,
            parentFolderId: parentFolder._id
          });
        }

        setShowCreateModal(false);
        setSelectedTopics({});
        setNewTopic('');
        fetchChildFolders(parentFolder._id);
        alert('Topics added successfully!');
      } else if (creationStep === 'addSubfolder') {
        // Adding subfolder from navigation
        if (subFolders.length === 0) {
          alert('Please add at least one subfolder');
          setLoading(false);
          return;
        }

        for (const subFolderName of subFolders) {
          const subFolderData = await api.post('/folders', {
            name: subFolderName,
            companyName: parentFolder.companyName,
            description: `${subFolderName} for ${selectedTopicForSubfolder.name}`,
            parentFolderId: selectedTopicForSubfolder._id
          });

          for (const difficulty of difficulties) {
            await api.post('/folders', {
              name: difficulty,
              companyName: parentFolder.companyName,
              description: `${difficulty} level questions`,
              parentFolderId: subFolderData.data.folder._id
            });
          }
        }

        setShowCreateModal(false);
        setSubFolders([]);
        setNewSubFolder('');
        fetchChildFolders(selectedTopicForSubfolder._id);
        alert('Subfolders created successfully!');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Error creating folder: ' + error.response?.data?.message || error.message);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedFolder) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('folderId', selectedFolder._id);

    try {
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowUploadModal(false);
      setUploadFile(null);
      fetchFolderFiles(selectedFolder._id);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
    setLoading(false);
  };

  const fetchFolderFiles = async (folderId) => {
    try {
      const { data } = await api.get(`/folders/${folderId}`);
      setFolderFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const handleFolderClick = (folder) => {
    setSelectedFolder(folder);
    const newPath = [...navigationPath, folder];
    
    // If we're already at difficulty level (4 deep) and clicking another difficulty folder, 
    // replace the last folder instead of adding to path
    if (navigationPath.length === 4) {
      // Replace the last difficulty folder with the new one
      const updatedPath = navigationPath.slice(0, -1);
      updatedPath.push(folder);
      setNavigationPath(updatedPath);
      setFolderFiles([]);
      fetchFolderFiles(folder._id);
    } else {
      setNavigationPath(newPath);
      // If at difficulty level (4 deep: Company > Topic > Subfolder > Difficulty), fetch files
      if (newPath.length === 4) {
        fetchFolderFiles(folder._id);
      } else {
        // Otherwise fetch child folders
        fetchChildFolders(folder._id);
        setFolderFiles([]);
      }
    }
  };

  const handleGoBack = () => {
    if (navigationPath.length > 1) {
      const newPath = navigationPath.slice(0, -1);
      setNavigationPath(newPath);
      const parentFolder = newPath[newPath.length - 1];
      setSelectedFolder(parentFolder);
      fetchChildFolders(parentFolder._id);
      setFolderFiles([]);
    } else if (navigationPath.length === 1) {
      setNavigationPath([]);
      setSelectedFolder(null);
      setChildFolders([]);
      setFolderFiles([]);
    }
  };

  const handleProcessOCR = async (fileId) => {
    console.log(fileId)
    try {
      await api.post(`/files/${fileId}/ocr`);
      alert('OCR processing started!');
      fetchFolderFiles(selectedFolder._id);
    } catch (error) {
      console.error('Error processing OCR:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {navigationPath.length === 0 ? 'Company Folders' : navigationPath.map(f => f.name).join(' > ')}
        </h2>
        <button
          onClick={() => {
            if (navigationPath.length === 0) {
              // At root level - create new company
              setShowCreateModal(true);
              setCreationStep('main');
              setIsAddingFromNavigation(false);
            } else if (navigationPath.length === 1) {
              // At company level - add new topic
              setShowCreateModal(true);
              setCreationStep('addTopic');
              setIsAddingFromNavigation(true);
              setParentFolder(navigationPath[0]);
            } else if (navigationPath.length === 2) {
              // At topic level - add new subfolder
              setShowCreateModal(true);
              setCreationStep('addSubfolder');
              setIsAddingFromNavigation(true);
              setSelectedTopicForSubfolder(navigationPath[1]);
              setParentFolder(navigationPath[0]);
            }
          }}
          className="btn btn-primary"
        >
          + Create Folder
        </button>
      </div>
      

      {navigationPath.length > 0 && (
        <button
          onClick={handleGoBack}
          className="text-blue-600 hover:text-blue-700 flex items-center space-x-2 text-sm font-medium"
        >
          <span>← Back</span>
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {navigationPath.length === 0 
          ? folders.map((folder) => (
              <div
                key={folder._id}
                onClick={() => handleFolderClick(folder)}
                className={`card cursor-pointer transition-all hover:shadow-lg ${
                  selectedFolder?._id === folder._id ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-4xl mb-3">📁</div>
                    <h3 className="font-semibold text-lg text-gray-900">{folder.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{folder.companyName}</p>
                    <p className="text-xs text-gray-500 mt-2">{folder.description}</p>
                  </div>
                </div>
              </div>
            ))
          : childFolders.length > 0
          ? childFolders.map((folder) => (
              <div
                key={folder._id}
                onClick={() => handleFolderClick(folder)}
                className={`card cursor-pointer transition-all hover:shadow-lg ${
                  selectedFolder?._id === folder._id ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-4xl mb-3">
                      {navigationPath.length === 1 ? '📚' : '⚙️'}
                    </div>
                    <h3 className="font-semibold text-lg text-gray-900">{folder.name}</h3>
                    <p className="text-xs text-gray-500 mt-2">{folder.description}</p>
                    {(navigationPath.length === 2 || navigationPath.length === 3) && (
                      <p className="text-xs text-gray-500 mt-1">Files: {folder.fileCount || 0}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          : (
            <div className="col-span-3 text-center py-12">
              <p className="text-gray-500">No folders found</p>
            </div>
          )
        }
      </div>

      {selectedFolder && navigationPath.length === 4 && (
        <div className="card bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Files in {navigationPath.map(f => f.name).join(' > ')}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Total Files: <span className="font-semibold">{folderFiles.length}</span>
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn btn-primary text-sm"
            >
              + Upload File
            </button>
          </div>

          <div className="space-y-3">
            {folderFiles.length > 0 ? (
              folderFiles.map((file) => (
                <div key={file._id} className="bg-white p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">📄</div>
                    <div>
                      <p className="font-medium text-gray-900">{file.originalName}</p>
                      <p className="text-xs text-gray-500">
                        {(file.fileSize / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {file.ocrProcessed ? (
                      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                        Processed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleProcessOCR(file._id)}
                        className="text-xs btn btn-primary"
                      >
                        Process OCR
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No files uploaded yet</p>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            {creationStep === 'main' && (
              <>
                <h3 className="text-xl font-bold mb-4">Step 1: Create Main Folder</h3>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  <div>
                    <label className="label">Folder Name</label>
                    <input
                      type="text"
                      value={newFolder.name}
                      onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                      className="input"
                      placeholder="e.g., TCS, Accenture"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Company Name</label>
                    <input
                      type="text"
                      value={newFolder.companyName}
                      onChange={(e) => setNewFolder({ ...newFolder, companyName: e.target.value })}
                      className="input"
                      placeholder="e.g., Tata Consultancy Services"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      value={newFolder.description}
                      onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })}
                      className="input"
                      rows="3"
                      placeholder="Describe this company's assessment"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Next'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setCreationStep('main');
                        setNewFolder({ name: '', companyName: '', description: '' });
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}

            {creationStep === 'topic' && parentFolder && (
              <>
                <h3 className="text-xl font-bold mb-2">Step 2: Create Topics</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select topics for: <strong>{parentFolder.name}</strong>
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  You'll add subfolders to each topic in the next step
                </p>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  <div className="space-y-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {topics.map((topic) => (
                      <label key={topic} className="flex items-center space-x-3 p-2 rounded cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedTopics[topic] || false}
                          onChange={(e) => setSelectedTopics({
                            ...selectedTopics,
                            [topic]: e.target.checked
                          })}
                          className="w-4 h-4 text-blue-500"
                        />
                        <span className="text-gray-900 font-medium">{topic}</span>
                      </label>
                    ))}
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm font-medium text-gray-900 mb-2">Add Custom Topic</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        placeholder="Enter custom topic name"
                        className="input flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newTopic.trim() && !topics.includes(newTopic)) {
                            setTopics([...topics, newTopic.trim()]);
                            setSelectedTopics({
                              ...selectedTopics,
                              [newTopic.trim()]: true
                            });
                            setNewTopic('');
                          }
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">Next Step:</p>
                    <p className="text-xs text-blue-700 mt-1">
                      You'll select each topic and add subfolders to it
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Topics'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreationStep('main');
                        setParentFolder(null);
                        setSelectedTopics({});
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Back
                    </button>
                  </div>
                </form>
              </>
            )}

            {creationStep === 'navigate' && createdTopics.length > 0 && (
              <>
                <h3 className="text-xl font-bold mb-2">Step 3: Select Topic for Subfolders</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select a topic to add subfolders to it
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  You can add multiple subfolders to each topic (e.g., "Time & Work", "Percentages", "Profit & Loss")
                </p>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  <div className="space-y-3 border rounded-lg p-3">
                    {createdTopics.map((topic) => (
                      <label key={topic._id} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="navigateTopic"
                          checked={selectedTopicForSubfolder?._id === topic._id}
                          onChange={() => setSelectedTopicForSubfolder(topic)}
                          className="w-4 h-4 text-blue-500"
                        />
                        <div>
                          <span className="text-gray-900 font-medium block">{topic.name}</span>
                          <span className="text-xs text-gray-500">Topic created</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-green-700">
                      ✓ {createdTopics.length} topic(s) created successfully
                    </p>
                  </div>

                  <div className="flex space-x-3">
                    <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                      {loading ? 'Next...' : 'Add Subfolders to This Topic'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setNewFolder({ name: '', companyName: '', description: '' });
                        setParentFolder(null);
                        setCreatedTopics([]);
                        setSelectedTopicForSubfolder(null);
                        setSubFolders([]);
                        setNewSubFolder('');
                        setSelectedTopics({});
                        setCreationStep('main');
                        fetchFolders();
                        alert('Topics created successfully!');
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Done
                    </button>
                  </div>
                </form>
              </>
            )}

            {creationStep === 'subfolder' && selectedTopicForSubfolder && (
              <>
                <h3 className="text-xl font-bold mb-2">Step 4: Add Subfolders</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Adding subfolders to: <strong>{selectedTopicForSubfolder.name}</strong>
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  📁 Add as many subfolders as needed (e.g., "Time & Work", "Percentages", "Profit & Loss")
                </p>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  {/* List of added subfolders */}
                  {subFolders.length > 0 && (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-sm font-medium text-gray-900 mb-2">Added Subfolders ({subFolders.length}):</p>
                      <div className="space-y-2">
                        {subFolders.map((subfolder, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm text-gray-900">
                              <span className="font-medium">{index + 1}.</span> {subfolder}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSubFolders(subFolders.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input to add new subfolder */}
                  <div>
                    <label className="label">Subfolder Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSubFolder}
                        onChange={(e) => setNewSubFolder(e.target.value)}
                        className="input flex-1"
                        placeholder="e.g., Time & Work, Percentages"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newSubFolder.trim() && !subFolders.includes(newSubFolder.trim())) {
                            setSubFolders([...subFolders, newSubFolder.trim()]);
                            setNewSubFolder('');
                          } else if (subFolders.includes(newSubFolder.trim())) {
                            alert('This subfolder already exists!');
                          }
                        }}
                        className="btn btn-secondary"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">What happens next:</p>
                    <p className="text-xs text-blue-700 mt-1">
                      ✓ Each subfolder will be created<br/>
                      ✓ 3 difficulty folders (Easy, Medium, Hard) automatically under each<br/>
                      ✓ You can upload files to difficulty level folders
                    </p>
                  </div>

                  <div className="flex space-x-3">
                    <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Subfolders'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreationStep('navigate');
                        setSelectedTopicForSubfolder(null);
                        setSubFolders([]);
                        setNewSubFolder('');
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Back
                    </button>
                  </div>
                </form>
              </>
            )}

            {creationStep === 'addTopic' && isAddingFromNavigation && parentFolder && (
              <>
                <h3 className="text-xl font-bold mb-2">Add New Topic</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Adding topic to: <strong>{parentFolder.name}</strong>
                </p>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  <div className="space-y-3">
                    {topics.map((topic) => (
                      <label key={topic} className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedTopics[topic] || false}
                          onChange={(e) => setSelectedTopics({
                            ...selectedTopics,
                            [topic]: e.target.checked
                          })}
                          className="w-4 h-4 text-blue-500"
                        />
                        <span className="text-gray-900 font-medium">{topic}</span>
                      </label>
                    ))}
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm font-medium text-gray-900 mb-2">Add Custom Topic</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        placeholder="Enter topic name"
                        className="input flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newTopic.trim() && !topics.includes(newTopic)) {
                            setTopics([...topics, newTopic.trim()]);
                            setSelectedTopics({
                              ...selectedTopics,
                              [newTopic.trim()]: true
                            });
                            setNewTopic('');
                          }
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Topics'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setSelectedTopics({});
                        setNewTopic('');
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}

            {creationStep === 'addSubfolder' && isAddingFromNavigation && selectedTopicForSubfolder && (
              <>
                <h3 className="text-xl font-bold mb-2">Add New Subfolders</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Adding subfolders to: <strong>{selectedTopicForSubfolder.name}</strong>
                </p>
                <form onSubmit={handleCreateFolder} className="space-y-4">
                  {subFolders.length > 0 && (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-sm font-medium text-gray-900 mb-2">Added Subfolders ({subFolders.length}):</p>
                      <div className="space-y-2">
                        {subFolders.map((subfolder, index) => (
                          <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                            <span className="text-sm text-gray-900">
                              <span className="font-medium">{index + 1}.</span> {subfolder}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSubFolders(subFolders.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-700 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="label">Subfolder Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSubFolder}
                        onChange={(e) => setNewSubFolder(e.target.value)}
                        className="input flex-1"
                        placeholder="e.g., Time & Work, Percentages"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newSubFolder.trim() && !subFolders.includes(newSubFolder.trim())) {
                            setSubFolders([...subFolders, newSubFolder.trim()]);
                            setNewSubFolder('');
                          } else if (subFolders.includes(newSubFolder.trim())) {
                            alert('This subfolder already exists!');
                          }
                        }}
                        className="btn btn-secondary"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Subfolders'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setSubFolders([]);
                        setNewSubFolder('');
                      }}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Upload File</h3>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="label">Select File</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="input"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                </p>
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                  {loading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderManagement;
