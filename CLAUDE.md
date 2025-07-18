# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Federated Memory System - A distributed, modular memory architecture for LLMs with intelligent routing via a Central Memory Index (CMI). The system uses specialized memory modules for different domains (Technical, Personal, Work, Learning, Communication, Creative).

## Key Architecture Concepts

### Universal Memory Cell (UMC) Architecture - CRITICAL

**DO NOT USE SEPARATE DATABASE TABLES** - The system uses a Universal Memory Cell pattern:

- **ALL entities** (persons, projects, tasks, etc.) are stored as memories in module tables
- **Two universal fields** enable hybrid database functionality:
  1. **EMBEDDING** (vector): 1536-dimensional vector for semantic search
  2. **METADATA** (JSONB): Structured data for SQL queries and relationships

This creates a **semantic/graph/SQL hybrid database** where:
- **Semantic**: Vector similarity search via embeddings  
- **Graph**: Relationships via metadata references and CMI indexing
- **SQL**: Structured queries via JSONB metadata fields

**Examples**:
- Person entities: `metadata.type='person'` in work_memories table
- Custom fields: Stored in `metadata.customFields` JSONB
- Relationships: Referenced via IDs in metadata, indexed by CMI

**Benefits**: No schema migrations, semantic search across all types, flexible metadata

### Other Core Concepts

1. **Central Memory Index (CMI)**: Routes queries to appropriate modules using 512-dimensional embeddings
2. **Memory Modules**: Domain-specific storage with 1536-dimensional embeddings for semantic search
3. **Dual Embedding Strategy**: Compressed embeddings for routing, full embeddings for search
4. **Module Isolation**: Each module uses existing memory tables, no separate schemas needed

## Development Commands

```bash
# Development
npm run dev              # Start server (port 3000)
npm run build            # Compile TypeScript
npm run test            # Run Jest tests
npm run test:watch      # Run tests in watch mode

# Database
npm run db:migrate      # Apply Prisma migrations
npm run db:studio       # Open Prisma Studio UI
npm run db:generate     # Generate Prisma client

# Code Quality
npm run lint            # ESLint check
npm run format          # Prettier formatting
npm run typecheck       # TypeScript type checking

# Module Generation
npm run generate:module [name]  # Create new module from template
```

## Database Setup

PostgreSQL 16+ with pgvector extension required:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Project Structure

```
src/
├── modules/           # Memory module implementations
│   ├── base/         # BaseModule abstract class
│   └── [module]/     # Each module (technical, personal, etc.)
├── services/         # Core services (CMI, federation)
├── api/             # REST/WebSocket endpoints
├── utils/           # Shared utilities
└── types/           # TypeScript interfaces
```

## Module Development

When creating/modifying modules:
1. Extend `BaseModule` abstract class
2. Implement required methods: `processMetadata()`, `formatSearchResult()`
3. Add module-specific metadata interfaces
4. Register in CMI routing table
5. Add database migration for module table

## Testing

- Test files adjacent to source: `module.ts` → `module.test.ts`
- Mock external services (OpenAI, Redis)
- Test module isolation and integration
- Performance benchmarks for routing (<50ms) and search (<100ms)

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
JWT_SECRET=...
REDIS_URL=redis://... (optional)
```

## Performance Considerations

- CMI uses compressed embeddings (512-dim) for fast routing
- Modules use full embeddings (1536-dim) for accuracy
- Implement caching for frequently accessed memories
- Use database indexing on vector columns
- Batch embedding requests when possible

## Current Implementation Status

- ✅ Core infrastructure (server, base module, interfaces)
- ⚠️ Memory modules need implementation
- ⚠️ CMI service needs completion
- ⚠️ API endpoints need building
- ⚠️ WebSocket support pending
- ⚠️ MCP protocol integration pending