# Federated Memory System

A universal memory architecture with distributed storage, intelligent routing, and full BigMemory compatibility. Built for LLMs with MCP (Model Context Protocol) integration.

<!-- Latest Update: 2025-07-18 - BigMemory Tool Parity Complete -->

## 🚀 What's New

- **Full BigMemory Compatibility**: All 18 BigMemory tools implemented
- **Universal Memory Structure**: Everything stored as memories with JSONB metadata
- **Registry-Based Categories**: Efficient category and type management
- **Token Authentication**: BigMemory-style token URLs for Claude.ai
- **Database-Optimized**: PostgreSQL functions for efficient counting

## Features

- **Universal Memory Architecture**: All data (projects, tasks, categories) stored as memories with metadata
- **BigMemory Tool Parity**: Complete implementation of all BigMemory MCP tools
- **Token-Based Authentication**: Simple token URLs for Claude.ai integration (no OAuth required)
- **Intelligent Routing (CMI)**: Central Memory Index routes queries to appropriate modules
- **6 Memory Modules**: Technical, Personal, Work, Learning, Communication, Creative
- **Category System**: Hierarchical categories with registry-based management
- **Project Management**: Projects and tasks as memories with full metadata support

## 🌟 Key Features

- **Central Memory Index (CMI)**: Lightning-fast routing with 512-dimensional embeddings
- **Specialized Modules**: 6 purpose-built memory modules (Technical, Personal, Work, Learning, Communication, Creative)
- **Federated Search**: Parallel search across modules with intelligent result merging
- **pgvector Integration**: Semantic search using PostgreSQL's vector extension
- **Flexible Metadata**: JSONB storage for module-specific data structures
- **REST API**: Complete RESTful API with JWT authentication
- **MCP Protocol**: Full support for Model Context Protocol with OAuth 2.0
- **Claude.ai Integration**: Connect from Claude.ai web with OAuth 2.0 + PKCE
- **High Performance**: Sub-200ms federated search latency
- **Redis Caching**: Optional caching layer for improved performance

## 📈 Current Status

✅ **Implemented (18/18 BigMemory Tools):**
1. **searchMemory** - Semantic search across federated modules
2. **storeMemory** - Store with auto-routing to appropriate module
3. **listModules** - List all 6 memory modules
4. **getModuleStats** - Memory counts and statistics per module
5. **getMemory** - Retrieve specific memory by ID
6. **updateMemory** - Update memory content/metadata
7. **removeMemory** - Delete memory
8. **searchCategories** - List categories from registry
9. **createCategory** - Create hierarchical categories
10. **createProject** - Projects as memories with metadata
11. **listProjects** - Filter and list projects
12. **getProjectTasks** - Tasks for specific project
13. **createTask** - Tasks with priority, status, assignee
14. **updateTaskStatus** - Update task completion
15. **linkTaskDependency** - Task relationships
16. **listTasks** - Filter tasks by multiple criteria
17. **getTaskDependencies** - Task dependency graph
18. **createRecurringTask** - Recurring task templates

✅ **Architecture Features:**
- Universal memory structure (no separate tables)
- JSONB metadata for flexible data storage
- Registry memories for categories and types
- Token-based authentication (BigMemory style)
- Database functions for efficient operations
- Module isolation with shared interfaces

🚧 **Known Limitations:**
- Category memory counts require database migration
- Some complex queries may need optimization

📋 **Planned Enhancements:**
- Real-time memory sync across modules
- Advanced analytics dashboard
- Memory relationship visualization
- Backup and archive tools

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│            Central Memory Index (CMI)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ Memory Graph │  │ Relationship │  │  Router  │ │
│  │    Index     │  │    Matrix    │  │  Logic   │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
└─────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌──────▼───────┐ ┌───────▼────────┐
│   Technical    │ │   Personal   │ │     Work       │
│    Module      │ │    Module    │ │    Module      │
└────────────────┘ └──────────────┘ └────────────────┘
```

## 🔌 Claude.ai Integration (BigMemory Compatible)

### Token-Based Authentication
Connect to Claude.ai using a simple token URL (no OAuth required):

1. **Login to get your token**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "your@email.com", "password": "yourpassword"}'
   ```

2. **Get your MCP URL from the response**:
   ```
   https://your-domain.com/{your-token}/sse
   ```

3. **Add to Claude.ai**:
   - Go to Claude.ai settings
   - Add the MCP URL directly
   - No OAuth configuration needed!

### Emergency Access
If you need immediate access:
```bash
curl -X POST http://localhost:3000/api/auth/emergency-login \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

## 🚀 Quick Start

> **Want to get started in 5 minutes?** Check out our [Quick Start Guide](QUICKSTART.md)!

### Prerequisites

- Node.js 18+ (20+ recommended)
- PostgreSQL 16+ with pgvector extension
- Redis (optional, for caching)
- OpenAI API key for embeddings

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd federated-memory

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration (see OAuth setup below)

# Set up database
createdb federated_memory
psql federated_memory -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate

# Apply category counting functions (optional but recommended)
psql $DATABASE_URL < prisma/migrations/20250118_add_category_counting.sql

# Generate Prisma client
npm run db:generate

# Start development server
npm run dev
```

The server will start on port 3000 (or PORT env variable):
- REST API: http://localhost:3000/api
- Health Check: http://localhost:3000/api/health
- MCP Server: http://localhost:3000/mcp

### Docker Setup

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec app npm run db:migrate
```

## 🧠 Universal Memory Architecture

### Core Concept
Everything in federated-memory is stored as a **memory** with **metadata**:

```javascript
{
  id: "unique-memory-id",
  content: "The actual memory content as text",
  moduleId: "work",  // Which module stores it
  metadata: {
    type: "project",  // What kind of memory
    category: "project_management",  // How it's categorized
    // Type-specific fields in metadata:
    name: "API Redesign",
    status: "active",
    dueDate: "2025-02-01",
    team: ["alice", "bob"],
    // ... any other structured data
  }
}
```

### No Separate Tables
- ✅ Projects → Memories with `type: "project"`
- ✅ Tasks → Memories with `type: "task"`
- ✅ Categories → Registry memory with `type: "list"`
- ✅ Relationships → Memories with dependency metadata

### Registry Pattern
Special memories that maintain lists:
- **Category Registry**: List of all categories with icons/descriptions
- **Type Registry**: List of all memory types
- Auto-created on first use with sensible defaults

## 📦 Memory Modules

### 1. Technical Module
- **Purpose**: Programming, debugging, architecture, tools
- **Features**: Code extraction, error pattern matching, framework detection

### 2. Personal Module
- **Purpose**: Life events, health, relationships, goals
- **Features**: Privacy controls, emotional context analysis
- **Registry Storage**: Categories and types stored here

### 3. Work Module
- **Purpose**: Projects, meetings, decisions, deadlines
- **Features**: Time-based retrieval, stakeholder tracking
- **Project Management**: All projects/tasks stored as memories

### 4. Learning Module
- **Purpose**: Courses, books, research, insights
- **Features**: Knowledge progression, mastery tracking

### 5. Communication Module
- **Purpose**: Emails, messages, conversations
- **Features**: Thread management, participant search

### 6. Creative Module
- **Purpose**: Ideas, brainstorming, designs
- **Features**: Idea linking, evolution tracking

## 🔧 Configuration

### Environment Variables

```env
# Core Configuration
DATABASE_URL="postgresql://user:pass@localhost:5432/federated_memory"
OPENAI_API_KEY="sk-..."
JWT_SECRET="your-secret-key"
REDIS_URL="redis://localhost:6379" # Optional

# Server Configuration
PORT=3000
NODE_ENV=development

# Module Configuration (all modules enabled by default)
ACTIVE_MODULES="technical,personal,work,learning,communication,creative"
```

### OAuth Setup

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - For local: `http://localhost:3000/api/auth/google/callback`
   - For production: `https://your-domain.com/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`:
   ```env
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   ```

#### GitHub OAuth
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Set Authorization callback URL:
   - For local: `http://localhost:3000/api/auth/github/callback`
   - For production: `https://your-domain.com/api/auth/github/callback`
4. Copy Client ID and Client Secret to `.env`:
   ```env
   GITHUB_CLIENT_ID="your-github-client-id"
   GITHUB_CLIENT_SECRET="your-github-client-secret"
   ```

## 🌐 REST API

### Authentication
All endpoints except health checks require JWT authentication:
```
Authorization: Bearer <token>
```

### Endpoints

#### Health Check
```bash
GET /api/health
GET /api/health/detailed
GET /api/health/ready
GET /api/health/live
```

#### User Management
```bash
POST /api/users/register
POST /api/users/login
GET /api/users/me
GET /api/users/stats
DELETE /api/users/me
```

#### Memory Operations
```bash
POST /api/memories          # Store memory
GET /api/memories/search    # Search memories
GET /api/memories/:id       # Get specific memory
PUT /api/memories/:id       # Update memory
DELETE /api/memories/:id    # Delete memory
```

#### Module Management
```bash
GET /api/modules            # List modules
GET /api/modules/:id/stats  # Module statistics
POST /api/modules/:id/analyze # Module analysis
```

## 🛠️ Development

### Project Structure

```
federated-memory/
├── src/
│   ├── core/           # Core systems (CMI, modules, embeddings)
│   ├── modules/        # Memory module implementations
│   ├── api/            # REST and MCP endpoints
│   └── services/       # Business logic services
├── prisma/             # Database schema and migrations
├── tests/              # Test suites
└── docs/               # Documentation
```

### Creating a New Module

```bash
npm run generate:module -- --name=finance --description="Financial memory module"
```

### Available Commands

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build            # Build TypeScript to JavaScript
npm start                # Start production server

# Database
npm run db:migrate       # Run database migrations
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio GUI

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage report

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run typecheck        # Check TypeScript types

# Utilities
npm run generate:module  # Generate new module template
```

### Testing the API

```bash
# Run the included test script
npm run test:api

# Or use curl
curl http://localhost:3000/api/health

# Store a memory (requires auth token)
curl -X POST http://localhost:3000/api/memories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test memory", "metadata": {"tags": ["test"]}}'
```

## 📊 Performance

- **CMI Routing**: <50ms
- **Module Search**: <100ms
- **Federated Search**: <200ms total
- **Concurrent Users**: 1000+

## 🔐 Security

- User isolation at all levels
- Module-level access control
- JWT authentication
- Rate limiting per module
- Comprehensive audit logging

## 📚 Documentation

- [User Manual](docs/USER_MANUAL.md) - Complete guide for using the system
- [MCP Server Guide](docs/MCP_SERVER.md) - MCP protocol implementation
- [Master Implementation Guide](docs/MASTER_PROMPT.md) - Technical implementation details
- [Development Setup](docs/DEVELOPMENT_SETUP.md) - Developer environment setup
- [Module Implementation](docs/MODULE_IMPLEMENTATION.md) - Creating custom modules
- [Project Structure](docs/PROJECT_STRUCTURE.md) - Codebase organization

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built on the foundation of [BigMemory](https://github.com/4xguy/bigmemory)
- Powered by PostgreSQL pgvector
- OpenAI embeddings for semantic search