# Resume Builder Feature - Complete Setup Guide

## Overview
A comprehensive resume builder with all requested features has been integrated into the StudentDashboard as a separate page.

## Features Implemented

### 1. **Create Resume from Scratch**
- Form-based resume builder with sections for:
  - Personal Information (Name, Email, Phone, Location, LinkedIn, Portfolio)
  - Education (School, Degree, Field, GPA, Dates, Description)
  - Work Experience (Company, Position, Location, Dates, Description, Achievements)
  - Skills (Category-based: Technical, Languages, Tools, Soft Skills)
  - Projects (Name, Description, Technologies, Links, Dates)
  - Certifications (Name, Issuer, Date, Credential ID, URL)

### 2. **Upload Existing Resume**
- File upload functionality supporting: PDF, DOC, DOCX, TXT
- Upload progress indicator
- Automatic parsing and extraction of resume data
- Overwrites form with extracted information

### 3. **AI-Powered Resume Generation**
- Generate resume based on job description
- Auto-fill job requirements from Job Portal
- Select multiple jobs and auto-generate optimized resume
- Or paste job description directly
- AI integration with `/generate-resume` endpoint

### 4. **Resume Templates**
- 4 professional templates:
  - **Modern**: Clean and contemporary design
  - **Classic**: Traditional professional resume
  - **Creative**: Bold and creative layout
  - **Minimal**: Simple and minimalist design
- Template selector in sidebar

### 5. **Save to Database**
- Auto-save functionality
- Resume persisted in database with `/resume` endpoints
- Retrieve previously saved resume on page load
- All resume data including template preference stored

### 6. **Export Formats**
- Download as PDF
- Download as DOCX
- One-click export with selected template applied

### 7. **Job Portal Integration**
- Auto-populate job titles and descriptions from Job Portal
- Select relevant jobs for AI-powered resume generation
- Resume tailored to specific job requirements

### 8. **Live Preview**
- Real-time preview sidebar showing:
  - Name and location
  - Summary
  - First education and experience entry
  - Updates as you type
- Template-based preview rendering

## File Structure

```
frontend/src/
├── pages/
│   ├── ResumeBuilder.jsx (NEW - Main resume builder component)
│   └── StudentDashboard.jsx (UPDATED - Added navigation link)
├── App.jsx (UPDATED - Added route)
└── config/
    ├── api.js (Existing - for backend API calls)
    └── aiapi.js (Existing - for AI API calls)
```

## Navigation

### Access Resume Builder:
1. **From StudentDashboard** → Click "📄 Resume" button in sidebar
2. **Direct URL** → `/resume-builder`
3. **Protected Route** → Only accessible to logged-in students

## Backend API Endpoints Required

### Resume Management
```
GET    /resume                      - Fetch saved resume
POST   /resume                      - Save resume
POST   /resume/upload               - Upload and parse resume
POST   /resume/download            - Download resume (PDF/DOCX)
```

### Job Portal Integration
```
GET    /jobs                        - Fetch all jobs for selection
```

### AI Resume Generation
```
POST   /generate-resume            - Generate resume based on job description
```

## State Management

### Resume Data Structure
```javascript
{
  personalInfo: {
    fullName: '',
    email: '',
    phone: '',
    location: '',
    summary: '',
    portfolio: '',
    linkedIn: ''
  },
  education: [
    {
      id: number,
      school: '',
      degree: '',
      field: '',
      startDate: '',
      endDate: '',
      gpa: '',
      description: ''
    }
  ],
  experience: [
    {
      id: number,
      company: '',
      position: '',
      location: '',
      startDate: '',
      endDate: '',
      description: '',
      achievements: ''
    }
  ],
  skills: [
    {
      id: number,
      category: '',
      skills: ''
    }
  ],
  projects: [
    {
      id: number,
      name: '',
      description: '',
      technologies: '',
      link: '',
      startDate: '',
      endDate: ''
    }
  ],
  certifications: [
    {
      id: number,
      name: '',
      issuer: '',
      date: '',
      credentialId: '',
      credentialUrl: ''
    }
  ]
}
```

## Key Components

### Main Tabs
1. **Personal** - Contact and summary info
2. **Education** - School details
3. **Experience** - Work history
4. **Skills** - Skills by category
5. **Projects** - Portfolio projects
6. **Certifications** - Professional certifications

### Action Buttons
- **✨ AI Generate Resume** - Generate optimized resume
- **📤 Upload Resume** - Parse existing resume
- **💾 Save Resume** - Save to database
- **📄 Download PDF** - Export as PDF
- **📝 Download DOCX** - Export as DOCX

### Sidebar Features
- Template selector (4 options)
- Live preview of resume
- Real-time updates

### Modals
- **AI Generation Modal** - Job selection and description input

## Usage Flow

### Create New Resume
1. Click "Resume" from StudentDashboard sidebar
2. Fill in personal information
3. Add education, experience, skills, projects, certifications
4. Select template from sidebar
5. Click "Save Resume"
6. Download as PDF or DOCX

### Upload & Edit Existing Resume
1. Click "Resume" from StudentDashboard
2. Click "Upload Resume" button
3. Select PDF/DOC/DOCX/TXT file
4. System parses and populates form
5. Edit any field as needed
6. Save changes

### Generate with AI
1. Click "AI Generate Resume" button
2. Either:
   - Select jobs from portal dropdown, OR
   - Paste job description
3. Click "Generate Resume"
4. AI tailors content to job requirements
5. Review and customize as needed
6. Save and download

## Technologies Used
- React 18 (Hooks)
- Tailwind CSS for styling
- React Router for navigation
- Axios for API calls
- Modal dialogs for AI generation
- Form validation

## Browser Support
- Chrome/Edge (Latest)
- Firefox (Latest)
- Safari (Latest)

## Future Enhancements
- [ ] Cover letter builder
- [ ] Template preview before selection
- [ ] Export as image
- [ ] Resume version history
- [ ] Resume scoring/suggestions
- [ ] LinkedIn profile auto-import
- [ ] PDF annotation tools
- [ ] Share resume link

## Troubleshooting

### Resume Not Saving
- Check backend `/resume` endpoint is working
- Verify user is authenticated
- Check browser console for errors

### Upload Not Working
- Ensure file format is supported (PDF, DOC, DOCX, TXT)
- Check file size limits (typically 10MB)
- Verify `/resume/upload` endpoint exists

### AI Generation Issues
- Ensure job description is detailed (minimum 200 chars)
- Check AI API is configured and running
- Verify `/generate-resume` endpoint
- Check internet connection for API calls

### PDF/DOCX Download Issues
- Ensure backend `/resume/download` endpoint works
- Check browser popup blocker settings
- Verify template selected before download

## Notes
- All resume data is auto-saved to database
- Templates affect exported PDF/DOCX appearance
- Preview updates in real-time as you type
- Skills field supports comma-separated values
- Dates use month-year format (YYYY-MM)
- All sections are optional except personal info
- Remove button available for each section entry
