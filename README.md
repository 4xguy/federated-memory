# 🧠 Federated Memory System

A scalable, modular memory system for LLMs featuring a Central Memory Index (CMI) that intelligently routes queries to specialized memory modules. Built with TypeScript, PostgreSQL, and pgvector.

## 🌟 Key Features

- **Central Memory Index (CMI)**: Lightning-fast routing with 512-dimensional embeddings
- **Specialized Modules**: 6 purpose-built memory modules (Technical, Personal, Work, Learning, Communication, Creative)
- **Federated Search**: Parallel search across modules with intelligent result merging
- **pgvector Integration**: Semantic search using PostgreSQL's vector extension
- **Flexible Metadata**: JSONB storage for module-specific data structures
- **MCP Protocol**: Full Model Context Protocol implementation
- **High Performance**: Sub-200ms federated search latency

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

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ with pgvector
- Redis (optional)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd federated-memory

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Set up database
createdb federated_memory
psql federated_memory -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

### Docker Setup

```bash
# Start all services
docker-compose up -d

# Run migrations
docker-compose exec app npm run db:migrate
```

## 📦 Memory Modules

### 1. Technical Module
- **Purpose**: Programming, debugging, architecture, tools
- **Features**: Code extraction, error pattern matching, framework detection

### 2. Personal Module
- **Purpose**: Life events, health, relationships, goals
- **Features**: Privacy controls, emotional context analysis

### 3. Work Module
- **Purpose**: Projects, meetings, decisions, deadlines
- **Features**: Time-based retrieval, stakeholder tracking

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
REDIS_URL="redis://localhost:6379"

# Module Configuration
ACTIVE_MODULES="technical,personal,work,learning,communication,creative"
CMI_EMBEDDING_DIM=512
MODULE_EMBEDDING_DIM=1536
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

### Testing

```bash
# Run all tests
npm test

# Unit tests only
npm test -- --testPathPattern=unit

# Test coverage
npm run test:coverage
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

- [Master Implementation Guide](docs/MASTER_PROMPT.md)
- [Development Setup](docs/DEVELOPMENT_SETUP.md)
- [Module Implementation](docs/MODULE_IMPLEMENTATION.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built on the foundation of [BigMemory](https://github.com/yourusername/bigmemory)
- Powered by PostgreSQL pgvector
- OpenAI embeddings for semantic search