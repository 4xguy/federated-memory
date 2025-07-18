# 🚀 Federated Memory System - Quick Start Guide

Get up and running with the Federated Memory System in 5 minutes!

## Prerequisites

- Node.js 18+
- PostgreSQL 16+
- An OpenAI API key

## Step 1: Clone and Install

```bash
git clone <repository-url>
cd federated-memory
npm install
```

## Step 2: Set Up Environment

Create a `.env` file:

```bash
DATABASE_URL="postgresql://localhost:5432/federated_memory"
OPENAI_API_KEY="sk-your-openai-key"
JWT_SECRET="your-secret-key"
PORT=3000
```

## Step 3: Set Up Database

```bash
# Create database
createdb federated_memory

# Enable pgvector extension
psql federated_memory -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate
```

## Step 4: Start the Server

```bash
npm run dev
```

You should see:
```
Federated Memory System running on port 3000
REST API: http://localhost:3000/api
```

## Step 5: Test the System

### 1. Check Health
```bash
curl http://localhost:3000/api/health
```

### 2. Register a User
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

Save the returned token!

### 3. Store a Memory
```bash
curl -X POST http://localhost:3000/api/memories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "My first memory in the Federated Memory System!",
    "metadata": {"tags": ["test", "first"]}
  }'
```

### 4. Search Memories
```bash
curl -G http://localhost:3000/api/memories/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --data-urlencode "query=first memory" \
  --data-urlencode "limit=10"
```

## 🎉 Success!

You now have a working Federated Memory System. The system automatically:
- Analyzed your memory content
- Routed it to the appropriate module
- Created embeddings for semantic search
- Indexed it for fast retrieval

## Next Steps

1. **Explore Modules**: Try storing different types of content:
   - Technical: Code snippets, errors, configurations
   - Personal: Goals, events, preferences
   - Work: Projects, meetings, deadlines
   - Learning: Notes, insights, progress
   - Communication: Conversations, emails
   - Creative: Ideas, designs, brainstorming

2. **Read the Docs**:
   - [User Manual](docs/USER_MANUAL.md) - Complete usage guide
   - [API Reference](docs/USER_MANUAL.md#api-reference) - All endpoints
   - [Module Guide](docs/USER_MANUAL.md#memory-modules-guide) - Module details

3. **Run Tests**:
   ```bash
   npm run test:api  # Test the REST API
   npm test          # Run unit tests
   ```

## Common Issues

### Port Already in Use
Change the port in `.env`:
```
PORT=3001
```

### Database Connection Failed
Check PostgreSQL is running:
```bash
pg_isready
```

### OpenAI API Errors
Verify your API key:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

## Getting Help

- Check the [User Manual](docs/USER_MANUAL.md)
- Review [Troubleshooting](docs/USER_MANUAL.md#troubleshooting)
- Submit issues on GitHub

Happy memory storing! 🧠✨