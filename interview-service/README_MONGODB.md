# MongoDB Setup Guide

## Local MongoDB Setup

### Option 1: MongoDB Community Server (Recommended for Production)

1. Download and install MongoDB Community Server from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
2. Start MongoDB service:
   - Windows: MongoDB will start automatically as a service
   - Linux/Mac: `sudo systemctl start mongod` or `brew services start mongodb-community`
3. MongoDB will be available at `mongodb://localhost:27017/`

### Option 2: MongoDB Atlas (Cloud - Free Tier Available)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a new cluster (free M0 tier available)
3. Set up database access (create a user with password)
4. Whitelist your IP address in Network Access
5. Get your connection string and update your `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   ```

## Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env`:
   ```env
   GROQ_API_KEY=your_actual_groq_key
   OPENAI_API_KEY=your_actual_openai_key
   MONGODB_URI=mongodb://localhost:27017/
   MONGODB_DB_NAME=ai_interviewer
   ```

## Installation

Install Python dependencies:

```bash
pip install -r requirements.txt
```

## Database Collections

The application uses two MongoDB collections:

1. **interview_sessions**: Stores interview session data
   - id (unique identifier)
   - job_description
   - resume_text
   - duration_seconds
   - questions (array)
   - status
   - created_at

2. **interview_answers**: Stores candidate answers
   - id (unique identifier)
   - session_id (reference to session)
   - question_id
   - audio_path
   - transcript
   - score
   - feedback (array)
   - model_answer
   - created_at
   - updated_at

## Running the Application

```bash
python backend/main.py
```

Or with uvicorn:

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Verifying MongoDB Connection

You can verify your MongoDB connection using MongoDB Compass or the mongo shell:

```bash
# Using mongo shell
mongosh mongodb://localhost:27017/

# List databases
show dbs

# Switch to your database
use ai_interviewer

# View collections
show collections

# Query sessions
db.interview_sessions.find().pretty()
```

## Troubleshooting

### Connection Issues

- Ensure MongoDB service is running
- Check firewall settings
- Verify connection string format
- For Atlas: ensure IP is whitelisted

### Authentication Errors

- Verify username/password in connection string
- Check user permissions in MongoDB

### Network Timeouts

- Increase timeout in connection string: `?serverSelectionTimeoutMS=5000`
- Check network connectivity
