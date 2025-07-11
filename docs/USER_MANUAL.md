# Federated Memory System - User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Memory Modules Guide](#memory-modules-guide)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)

## Introduction

The Federated Memory System is a distributed memory architecture designed for AI assistants and LLMs. It provides intelligent routing of memories to specialized modules, ensuring efficient storage and retrieval of different types of information.

### Key Benefits

- **Intelligent Routing**: Automatically routes memories to the most appropriate module
- **Semantic Search**: Find memories based on meaning, not just keywords
- **Module Specialization**: Each module is optimized for its specific domain
- **High Performance**: Sub-200ms search across all modules
- **Privacy First**: User isolation and access control at every level

## Getting Started

### System Requirements

- Node.js 18 or higher
- PostgreSQL 16+ with pgvector extension
- 4GB RAM minimum (8GB recommended)
- OpenAI API key for embeddings

### Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file with:
   ```env
   DATABASE_URL=postgresql://localhost:5432/federated_memory
   OPENAI_API_KEY=your-api-key
   JWT_SECRET=your-secret-key
   ```

3. **Set Up Database**
   ```bash
   # Create database
   createdb federated_memory
   
   # Enable pgvector
   psql federated_memory -c "CREATE EXTENSION IF NOT EXISTS vector;"
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start the Server**
   ```bash
   npm run dev
   ```

### First Steps

1. **Register a User**
   ```bash
   curl -X POST http://localhost:3000/api/users/register \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "name": "Your Name"}'
   ```

2. **Store Your First Memory**
   ```bash
   curl -X POST http://localhost:3000/api/memories \
     -H "Authorization: Bearer <your-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "content": "Learning about the Federated Memory System",
       "metadata": {
         "tags": ["documentation", "getting-started"]
       }
     }'
   ```

3. **Search Memories**
   ```bash
   curl -G http://localhost:3000/api/memories/search \
     -H "Authorization: Bearer <your-token>" \
     --data-urlencode "query=federated memory" \
     --data-urlencode "limit=10"
   ```

## Core Concepts

### Central Memory Index (CMI)

The CMI is the brain of the system. It:
- Analyzes incoming memories
- Determines the best module for storage
- Maintains a lightweight index for fast routing
- Coordinates federated searches across modules

### Memory Modules

Each module specializes in a specific domain:

1. **Technical Module**: Code, debugging, architecture
2. **Personal Module**: Life events, relationships, goals
3. **Work Module**: Projects, meetings, deadlines
4. **Learning Module**: Courses, books, insights
5. **Communication Module**: Messages, conversations
6. **Creative Module**: Ideas, designs, brainstorming

### Embeddings

The system uses two types of embeddings:
- **Routing Embeddings** (512-dim): Fast routing decisions
- **Search Embeddings** (1536-dim): Accurate semantic search

## API Reference

### Authentication

All API endpoints (except health checks) require authentication:

```http
Authorization: Bearer <jwt-token>
```

### User Endpoints

#### Register User
```http
POST /api/users/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "User Name"
}

Response:
{
  "id": "user-uuid",
  "email": "user@example.com",
  "token": "jwt-token"
}
```

#### Login
```http
POST /api/users/login
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "id": "user-uuid",
  "email": "user@example.com",
  "token": "jwt-token"
}
```

#### Get User Info
```http
GET /api/users/me
Authorization: Bearer <token>

Response:
{
  "id": "user-uuid",
  "email": "user@example.com",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### Get User Statistics
```http
GET /api/users/stats
Authorization: Bearer <token>

Response:
{
  "totalMemories": 150,
  "moduleBreakdown": {
    "technical": 45,
    "personal": 30,
    "work": 25,
    "learning": 20,
    "communication": 20,
    "creative": 10
  },
  "recentActivity": {...}
}
```

### Memory Endpoints

#### Store Memory
```http
POST /api/memories
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Memory content here",
  "metadata": {
    "tags": ["tag1", "tag2"],
    "priority": "high",
    "custom": "any-value"
  },
  "moduleId": "technical" // Optional - auto-routed if not specified
}

Response:
{
  "id": "memory-uuid",
  "message": "Memory stored successfully"
}
```

#### Search Memories
```http
GET /api/memories/search?query=search+terms&limit=10&offset=0
Authorization: Bearer <token>

Response:
{
  "results": [
    {
      "id": "memory-uuid",
      "content": "Memory content",
      "metadata": {...},
      "similarity": 0.95,
      "moduleId": "technical",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 10,
  "totalCount": 50
}
```

#### Get Memory
```http
GET /api/memories/:id
Authorization: Bearer <token>

Response:
{
  "id": "memory-uuid",
  "content": "Memory content",
  "metadata": {...},
  "moduleId": "technical",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### Update Memory
```http
PUT /api/memories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Updated content",
  "metadata": {
    "tags": ["updated"],
    "lastModified": "2024-01-01T00:00:00Z"
  }
}

Response:
{
  "message": "Memory updated successfully"
}
```

#### Delete Memory
```http
DELETE /api/memories/:id
Authorization: Bearer <token>

Response:
{
  "message": "Memory deleted successfully"
}
```

### Module Endpoints

#### List Modules
```http
GET /api/modules
Authorization: Bearer <token>

Response:
{
  "modules": [
    {
      "id": "technical",
      "name": "Technical Memory Module",
      "description": "Handles code, debugging, and technical documentation",
      "type": "specialized",
      "enabled": true
    },
    ...
  ]
}
```

#### Get Module Statistics
```http
GET /api/modules/:moduleId/stats
Authorization: Bearer <token>

Response:
{
  "moduleId": "technical",
  "stats": {
    "totalMemories": 45,
    "totalSize": 1048576,
    "lastAccessed": "2024-01-01T00:00:00Z",
    "mostFrequentCategories": ["debugging", "architecture"],
    "averageAccessCount": 3.5
  }
}
```

#### Module Analysis
```http
POST /api/modules/:moduleId/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "options": {
    "depth": "detailed",
    "includeRelationships": true
  }
}

Response:
{
  "moduleId": "personal",
  "analysis": {
    "emotionalTrends": {...},
    "topicClusters": [...],
    "insights": [...]
  }
}
```

### Health Check Endpoints

#### Basic Health
```http
GET /api/health

Response:
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "service": "federated-memory"
}
```

#### Detailed Health
```http
GET /api/health/detailed

Response:
{
  "status": "ok",
  "checks": {
    "database": {
      "status": "ok",
      "responseTime": 23
    },
    "moduleRegistry": {
      "status": "ok",
      "moduleCount": 6,
      "modules": ["technical", "personal", ...]
    },
    "cmiService": {
      "status": "ok"
    },
    "embeddingService": {
      "status": "ok",
      "provider": "openai"
    }
  }
}
```

## Memory Modules Guide

### Technical Module

**Best for:**
- Code snippets and examples
- Error messages and solutions
- Architecture decisions
- Tool configurations
- API documentation

**Metadata fields:**
- `language`: Programming language
- `framework`: Framework/library name
- `errorType`: Type of error
- `solution`: Solution description

**Example:**
```json
{
  "content": "Fixed CORS error in Express by adding cors middleware",
  "metadata": {
    "language": "javascript",
    "framework": "express",
    "errorType": "CORS",
    "solution": "app.use(cors())"
  }
}
```

### Personal Module

**Best for:**
- Life events and milestones
- Health information
- Personal goals
- Relationships
- Preferences

**Metadata fields:**
- `category`: life-event, health, goal, etc.
- `emotionalContext`: emotional state
- `people`: people involved
- `isPrivate`: privacy flag

**Example:**
```json
{
  "content": "Started new workout routine - 3x per week strength training",
  "metadata": {
    "category": "health",
    "emotionalContext": "motivated",
    "goal": "fitness",
    "frequency": "3x-weekly"
  }
}
```

### Work Module

**Best for:**
- Project information
- Meeting notes
- Deadlines and tasks
- Team decisions
- Professional goals

**Metadata fields:**
- `project`: Project name
- `priority`: high, medium, low
- `deadline`: ISO date string
- `stakeholders`: array of names

**Example:**
```json
{
  "content": "Q1 planning meeting - decided to focus on API redesign",
  "metadata": {
    "project": "Platform 2.0",
    "priority": "high",
    "deadline": "2024-03-31",
    "stakeholders": ["John", "Sarah", "Mike"]
  }
}
```

### Learning Module

**Best for:**
- Course notes
- Book summaries
- Research findings
- Skills development
- Educational insights

**Metadata fields:**
- `source`: book, course, article, etc.
- `topic`: Main topic
- `difficulty`: beginner, intermediate, advanced
- `progress`: percentage complete

**Example:**
```json
{
  "content": "Learned about vector databases and embeddings",
  "metadata": {
    "source": "course",
    "topic": "machine-learning",
    "difficulty": "intermediate",
    "progress": 45
  }
}
```

### Communication Module

**Best for:**
- Email summaries
- Chat conversations
- Meeting transcripts
- Phone call notes
- Message threads

**Metadata fields:**
- `participants`: Array of participants
- `channel`: email, chat, phone, etc.
- `threadId`: Conversation thread ID
- `sentiment`: positive, neutral, negative

**Example:**
```json
{
  "content": "Client wants to extend deadline by 2 weeks",
  "metadata": {
    "participants": ["client@example.com"],
    "channel": "email",
    "threadId": "thread-123",
    "sentiment": "neutral"
  }
}
```

### Creative Module

**Best for:**
- Ideas and brainstorming
- Design concepts
- Creative writing
- Innovation thoughts
- Problem-solving approaches

**Metadata fields:**
- `ideaType`: concept, design, solution, etc.
- `stage`: initial, developed, refined
- `relatedIdeas`: Array of related idea IDs
- `inspiration`: Source of inspiration

**Example:**
```json
{
  "content": "App idea: AI-powered meal planner based on fridge contents",
  "metadata": {
    "ideaType": "concept",
    "stage": "initial",
    "category": "mobile-app",
    "inspiration": "food-waste-problem"
  }
}
```

## Best Practices

### 1. Content Guidelines

- **Be Specific**: Include concrete details rather than vague descriptions
- **Add Context**: Include relevant background information
- **Use Natural Language**: Write as you would naturally speak or think

### 2. Metadata Best Practices

- **Consistent Tags**: Use consistent tag naming (e.g., "javascript" not "js" and "JavaScript")
- **Temporal Context**: Include dates/times for time-sensitive information
- **Relationships**: Link related memories using IDs or tags

### 3. Search Optimization

- **Natural Queries**: Use natural language questions
- **Specific Terms**: Include specific technical terms or names
- **Context Clues**: Add context to disambiguate common terms

### 4. Module Selection

Let the system auto-route when unsure, but specify module for:
- Sensitive personal information → Personal module
- Time-critical work items → Work module
- Learning progressions → Learning module

## Troubleshooting

### Common Issues

#### "Module not found" Error
- **Cause**: Module not loaded or disabled
- **Solution**: Check ACTIVE_MODULES in .env file

#### Slow Search Performance
- **Cause**: Large dataset without proper indexing
- **Solution**: Ensure pgvector indexes are created:
  ```sql
  CREATE INDEX ON memories USING ivfflat (embedding vector_cosine_ops);
  ```

#### Authentication Errors
- **Cause**: Expired or invalid token
- **Solution**: Login again to get a new token

#### Memory Not Routing Correctly
- **Cause**: Ambiguous content
- **Solution**: Specify moduleId explicitly or add more context

### Performance Optimization

1. **Enable Redis Caching**
   ```env
   REDIS_URL=redis://localhost:6379
   ```

2. **Tune PostgreSQL**
   ```sql
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   ```

3. **Module-Specific Indexes**
   Each module can have custom indexes for metadata fields

## Advanced Usage

### Batch Operations

```javascript
// Store multiple memories
const memories = [
  { content: "Memory 1", metadata: {...} },
  { content: "Memory 2", metadata: {...} },
];

for (const memory of memories) {
  await fetch('/api/memories', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(memory)
  });
}
```

### Federated Search

Search across all modules with a single query:

```javascript
const response = await fetch('/api/memories/search?query=important+project&limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const results = await response.json();
// Results automatically merged and ranked by relevance
```

### Module-Specific Queries

Target specific modules for focused searches:

```javascript
// Search only technical memories
const response = await fetch('/api/memories/search?query=bug+fix&moduleId=technical', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Export and Backup

```bash
# Export all memories
curl -X GET http://localhost:3000/api/memories/export \
  -H "Authorization: Bearer <token>" \
  -o memories-backup.json

# Export specific module
curl -X GET http://localhost:3000/api/memories/export?moduleId=personal \
  -H "Authorization: Bearer <token>" \
  -o personal-memories.json
```

### Integration Examples

#### Python Client
```python
import requests

class FederatedMemoryClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}
    
    def store_memory(self, content, metadata=None):
        response = requests.post(
            f"{self.base_url}/api/memories",
            headers=self.headers,
            json={"content": content, "metadata": metadata or {}}
        )
        return response.json()
    
    def search(self, query, limit=10):
        response = requests.get(
            f"{self.base_url}/api/memories/search",
            headers=self.headers,
            params={"query": query, "limit": limit}
        )
        return response.json()
```

#### Node.js Client
```javascript
class FederatedMemoryClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  async storeMemory(content, metadata = {}) {
    const response = await fetch(`${this.baseUrl}/api/memories`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, metadata })
    });
    return response.json();
  }

  async search(query, limit = 10) {
    const params = new URLSearchParams({ query, limit });
    const response = await fetch(
      `${this.baseUrl}/api/memories/search?${params}`,
      { headers: { 'Authorization': `Bearer ${this.token}` } }
    );
    return response.json();
  }
}
```

## Support and Resources

- **Documentation**: `/docs` directory in the repository
- **API Testing**: Use the included test script: `npm run test:api`
- **Issues**: Submit issues on GitHub
- **Community**: Join our Discord server (link in README)

---

Remember: The Federated Memory System is designed to augment your cognitive capabilities. Use it to offload information, discover connections, and build a personal knowledge base that grows with you.