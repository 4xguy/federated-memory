# Federated Memory System - Implementation Prompt

## Project Overview
Create a federated memory system with a Central Memory Index (CMI) that routes queries to specialized memory modules. The system should use PostgreSQL with pgvector for embeddings and JSONB for flexible metadata storage.

## Core Architecture

### System Components
1. **Central Memory Index (CMI)**: Lightweight router with 512-dimensional embeddings
2. **Memory Modules**: 6 specialized modules (Technical, Personal, Work, Learning, Communication, Creative)
3. **Module Interface**: Standardized API for all modules
4. **Query Router**: Intelligent routing based on query classification

### Technology Stack
- **Language**: TypeScript
- **Runtime**: Node.js 20+
- **Database**: PostgreSQL 16+ with pgvector extension
- **ORM**: Prisma with pgvector support
- **Embeddings**: OpenAI text-embedding-ada-002
- **Caching**: Redis (optional)
- **API**: REST + WebSocket (MCP protocol)
- **Testing**: Jest

## Database Schema

### Central Memory Index
```sql
CREATE TABLE memory_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    module_id VARCHAR(50) NOT NULL,
    remote_memory_id UUID NOT NULL,
    
    -- Lightweight embedding for routing
    embedding vector(512),
    
    -- Essential metadata
    title TEXT,
    summary TEXT,
    keywords TEXT[],
    categories TEXT[],
    
    -- Scoring and access
    importance_score FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(module_id, remote_memory_id),
    INDEX idx_user_module (user_id, module_id),
    INDEX idx_embedding USING hnsw (embedding vector_cosine_ops)
);

CREATE TABLE memory_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    source_module VARCHAR(50),
    source_memory_id UUID,
    target_module VARCHAR(50),
    target_memory_id UUID,
    relationship_type VARCHAR(50),
    strength FLOAT DEFAULT 0.5,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memory_modules (
    module_id VARCHAR(50) PRIMARY KEY,
    module_name VARCHAR(255) NOT NULL,
    description TEXT,
    module_type VARCHAR(50) DEFAULT 'standard',
    configuration JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Module Storage Pattern
```sql
-- Each module uses this pattern
CREATE TABLE {module}_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    
    -- Content and embeddings
    content TEXT NOT NULL,
    embedding vector(1536),
    
    -- Flexible metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Access tracking
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_user (user_id),
    INDEX idx_embedding USING hnsw (embedding vector_cosine_ops),
    INDEX idx_metadata USING gin (metadata)
);
```

## Module Definitions

### 1. Technical Module
- **Purpose**: Programming, debugging, architecture, tools
- **Metadata**: `{tool: string, language: string, framework: string, error_type?: string}`
- **Special features**: Code snippet extraction, error pattern matching

### 2. Personal Module
- **Purpose**: Life events, health, relationships, personal goals
- **Metadata**: `{life_area: string, people: string[], emotional_valence: number}`
- **Special features**: Privacy controls, emotional context

### 3. Work Module
- **Purpose**: Projects, meetings, decisions, deadlines
- **Metadata**: `{project_id: string, stakeholders: string[], deadline?: date, priority: string}`
- **Special features**: Time-based retrieval, decision tracking

### 4. Learning Module
- **Purpose**: Courses, books, research, insights
- **Metadata**: `{source: string, topic: string, mastery_level: number}`
- **Special features**: Knowledge progression tracking

### 5. Communication Module
- **Purpose**: Emails, messages, conversations
- **Metadata**: `{participants: string[], channel: string, thread_id?: string}`
- **Special features**: Thread continuation, participant search

### 6. Creative Module
- **Purpose**: Ideas, brainstorming, designs
- **Metadata**: `{idea_stage: string, tags: string[], related_ideas: string[]}`
- **Special features**: Idea linking, evolution tracking

## Implementation Steps

### Phase 1: Core Infrastructure
1. Initialize TypeScript project with Prisma
2. Set up PostgreSQL with pgvector
3. Create base database schema
4. Implement authentication system
5. Create module registry

### Phase 2: CMI Development
1. Build memory index service
2. Implement embedding generation (512d for index)
3. Create query router
4. Build relationship tracking
5. Add access pattern monitoring

### Phase 3: Module Framework
1. Create abstract MemoryModule class
2. Implement module interface standards
3. Build module loader system
4. Create inter-module communication
5. Add module health monitoring

### Phase 4: Module Implementation
1. Implement each of the 6 modules
2. Add module-specific metadata handling
3. Create specialized search functions
4. Build module-specific APIs
5. Add module testing

### Phase 5: Query System
1. Implement federated search
2. Build query classification
3. Add result ranking/merging
4. Create caching layer
5. Optimize performance

### Phase 6: MCP Integration
1. Implement MCP protocol
2. Create MCP tool definitions
3. Build WebSocket server
4. Add SSE support
5. Create Claude Desktop config

## API Design

### REST Endpoints
```
POST   /api/memory                 # Store memory (auto-routes to module)
GET    /api/memory/search         # Federated search
GET    /api/memory/:module/:id    # Get specific memory
PUT    /api/memory/:module/:id    # Update memory
DELETE /api/memory/:module/:id    # Delete memory
GET    /api/modules               # List modules
GET    /api/modules/:id/stats     # Module statistics
```

### MCP Tools
```typescript
// 1. Store Memory
{
  name: "store_memory",
  parameters: {
    content: string,
    module?: string,  // Auto-detected if not provided
    metadata?: object
  }
}

// 2. Search Memories
{
  name: "search_memories",
  parameters: {
    query: string,
    modules?: string[],  // Specific modules or all
    limit?: number,
    filters?: object
  }
}

// 3. Update Memory
{
  name: "update_memory",
  parameters: {
    module: string,
    memory_id: string,
    content?: string,
    metadata?: object
  }
}

// 4. Get Related Memories
{
  name: "get_related",
  parameters: {
    module: string,
    memory_id: string,
    relationship_types?: string[]
  }
}
```

## Testing Strategy
1. Unit tests for each service
2. Integration tests for CMI routing
3. Module isolation tests
4. Performance benchmarks
5. MCP protocol tests

## Performance Targets
- CMI routing: <50ms
- Module search: <100ms
- Total federated search: <200ms
- Memory storage: <500ms
- Concurrent users: 1000+

## Security Considerations
1. User isolation at all levels
2. Module-level access control
3. Encrypted module connections
4. Rate limiting per module
5. Audit logging