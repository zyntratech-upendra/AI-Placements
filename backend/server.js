const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const connectDB = require('./config/db');
connectDB();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/folders', require('./routes/folders'));
app.use('/api/files', require('./routes/files'));
app.use('/api/assessments', require('./routes/assessments'));
app.use('/api/attempts', require('./routes/attempts'));
app.use('/api/placement-exams', require('./routes/placementExamRoutes'));
app.use('/api/student/placement-exam', require('./routes/studentPlacementRoutes'));
app.use('/api/placement-assessments', require('./routes/placementAssessmentRoutes'));
app.use('/api/placement-results', require('./routes/PlacementResult'));
app.use('/api/weak-areas', require('./routes/weakAreaRoutes'));
app.use('/api/targeted-assessments', require('./routes/targetedAssessmentRoutes'));
app.use('/api/resume-assessments', require('./routes/resumeAssessmentRoutes'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/interview', require('./routes/interviewRoutes'));
app.use('/api/resume', require('./routes/resumeRoutes'));





app.get('/', (req, res) => {
  res.json({ message: 'Placement Portal API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
