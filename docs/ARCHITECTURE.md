# Federated Memory System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Implementation Patterns](#implementation-patterns)
4. [Query Strategy](#query-strategy)
5. [Module Development Guide](#module-development-guide)
6. [Examples & Templates](#examples--templates)

## System Overview

The Federated Memory System is a distributed, modular memory architecture for LLMs that uses a Universal Memory Cell (UMC) structure. Instead of traditional database tables with fixed schemas, all data is stored as "memories" with two key components:

1. **Vector Embedding** (1536 dimensions) - For semantic search
2. **Metadata** (JSONB) - For structured data and SQL queries

### Key Principles
- **Universal Structure**: Everything is a memory (projects, tasks, people, etc.)
- **Module-Based**: Memories are organized into modules (work, personal, technical, etc.)
- **Intelligent Routing**: Central Memory Index (CMI) routes queries to appropriate modules
- **Hybrid Search**: SQL for structured queries, semantic for natural language
- **BigMemory Compatible**: Token-based authentication for Claude.ai integration

## Core Architecture

### 1. Universal Memory Cell (UMC)

Every piece of data in the system follows this structure:

```typescript
interface Memory {
  id: string;                    // UUID
  userId: string;                // Owner
  content: string;               // Human-readable description
  embedding?: number[];          // 1536-dim vector for semantic search
  metadata: Record<string, any>; // JSONB structured data
  accessCount: number;
  lastAccessed: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Module System

Memories are physically stored in module-specific tables:
- `work_memories` - Projects, tasks, professional data
- `personal_memories` - Personal preferences, notes
- `technical_memories` - Code snippets, technical knowledge
- `learning_memories` - Educational content
- `creative_memories` - Ideas, creative works
- `communication_memories` - Messages, interactions

Each module is represented by a class extending `BaseModule`:

```typescript
class WorkModule extends BaseModule {
  constructor(config: ModuleConfig, embeddingService: EmbeddingService) {
    super(config, embeddingService);
  }
  
  // Module-specific metadata processing
  protected processMetadata(metadata: any): any {
    return {
      ...metadata,
      moduleSpecific: 'work'
    };
  }
}
```

### 3. Central Memory Index (CMI)

The CMI maintains a lightweight index of all memories across modules:

```typescript
interface CMIEntry {
  id: string;
  userId: string;
  moduleId: string;           // Which module contains this memory
  remoteMemoryId: string;     // ID in the module's table
  embedding?: number[];       // 512-dim compressed for fast routing
  title?: string;
  summary?: string;
  keywords: string[];
  categories: string[];
  importanceScore: number;
}
```

### 4. Metadata Organization

Three levels of organization:
1. **Module** - Physical storage location (which table)
2. **Type** - Entity type stored in metadata (e.g., "project", "task", "person")
3. **Category** - User-defined grouping stored in metadata

## Implementation Patterns

### 1. Memory Storage Pattern

When storing any entity as a memory:

```typescript
// Step 1: Generate human-readable content
const content = `${entityType}: ${entity.name}${entity.description ? '\n' + entity.description : ''}`;

// Step 2: Structure metadata
const metadata = {
  type: 'entity_type',        // Required: identifies what kind of data
  id: entity.id,              // Entity's unique ID
  ...entity,                  // All entity fields
  category: 'optional_category'
};

// Step 3: Store in module
const memoryId = await module.store(userId, content, metadata);

// Step 4: Index with CMI
await cmiService.indexMemory(userId, moduleId, memoryId, content, metadata);
```

### 2. Registry Pattern

For managing lists (categories, types, etc.), use registry memories:

```typescript
// Registry memory structure
{
  type: 'registry',
  registryType: 'categories',  // or 'types', 'tags', etc.
  items: [
    {
      name: 'Category Name',
      description: 'Description',
      icon: '📁',
      parentCategory: null,
      createdAt: '2024-01-01'
    }
  ]
}
```

### 3. MCP Tool Registration Architecture

**Dynamic Tool Registration System**

The system uses a centralized, dynamic tool registration pattern instead of hardcoded tool lists. This ensures consistency across authentication methods and enables automatic tool updates.

#### Architecture Components:

1. **Central Tool Registry** (`tools-list.ts`)
   - Single source of truth for all 36 tools (18 BigMemory + 18 Church)
   - Defines tool schemas and metadata
   - Shared between OAuth and token authentication

2. **Tool Execution Engine** (`tool-executor.ts`)
   - Centralized execution logic for all tools
   - Service instance caching and initialization
   - Consistent error handling across tools

3. **Dynamic Server Creation** (`authenticated-server.ts`)
   - Creates MCP servers with registered tools per user
   - Caches server instances for performance
   - Supports both OAuth and token authentication

4. **Token Authentication Integration** (`noauth-controller.ts`)
   - Uses dynamic tool registration instead of hardcoded lists
   - Gets tools from the MCP server registry
   - Maintains consistency with OAuth authentication

```typescript
// Central tool registration pattern
const mcpServers = new Map<string, McpServer>();

function getMcpServerForUser(userId: string, email: string, name?: string) {
  const key = userId;
  
  if (!mcpServers.has(key)) {
    const userContext = { userId, email, name };
    const server = createAuthenticatedMcpServer(userContext);
    mcpServers.set(key, server);
  }
  
  return mcpServers.get(key);
}

// Tools list endpoint
app.get('/api/v1/mcp/tools/list', async (req, res) => {
  const { user } = req as any;
  const mcpServer = getMcpServerForUser(user.id, user.email, user.name);
  const tools = mcpServer.listTools();
  res.json({ tools });
});
```

#### Benefits of Dynamic Registration:

- **Single Source of Truth**: All tools defined once in `tools-list.ts`
- **Automatic Updates**: New tools automatically available across all auth methods
- **Consistency**: OAuth and token auth use identical tool sets
- **Maintainability**: No need to update multiple hardcoded lists
- **Performance**: Server instances cached per user
- **Scalability**: Easy to add new modules and tools

#### MCP Tool Implementation Pattern

All tools follow this structure in `authenticated-server.ts`:

```typescript
server.registerTool(
  'toolName',
  {
    title: 'Human Readable Title',
    description: 'What this tool does',
    inputSchema: {
      requiredField: z.string().describe('Field description'),
      optionalField: z.string().optional().describe('Optional field')
    }
  },
  async (params) => {
    // Check authentication
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      // Implementation
      const result = await service.method(userContext.userId, params);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Tool error', { error });
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### 4. Service Layer Pattern

Services encapsulate business logic:

```typescript
export class DomainService {
  private module: DomainModule;
  private cmiService: any;
  
  constructor(
    private embeddingService: any,
    cmiService: any
  ) {
    this.module = new DomainModule({
      id: 'domain-module',
      name: 'Domain Module',
      description: 'Description',
      tableName: 'domain_memories',
      metadata: {
        searchableFields: ['type', 'status', 'field1'],
        requiredFields: ['type'],
        indexedFields: ['type', 'status']
      }
    }, embeddingService);
    
    this.cmiService = cmiService;
  }
  
  async createEntity(userId: string, entity: Entity): Promise<Entity> {
    // Implementation following memory storage pattern
  }
}
```

## Query Strategy

### When to Use SQL (Direct Metadata Queries)

Use SQL queries when:
- Searching by exact metadata fields (type, status, id)
- Filtering by structured data (dates, enums, booleans)
- Counting or aggregating
- Listing entities with sorting

Example:
```typescript
const tasks = await prisma.$queryRaw`
  SELECT id, content, metadata, "createdAt", "updatedAt"
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'task'
    AND metadata->>'status' != 'completed'
  ORDER BY metadata->>'priority', metadata->>'dueDate'
`;
```

### When to Use Semantic Search

Use semantic search when:
- Natural language queries
- Content-based search
- Finding similar items
- No exact metadata match

Example:
```typescript
const results = await module.search(userId, "tasks about authentication", {
  limit: 10,
  minScore: 0.7
});
```

### Optimization Techniques

1. **Add Database Indexes**:
```sql
CREATE INDEX idx_work_memories_type ON work_memories ((metadata->>'type'));
CREATE INDEX idx_work_memories_status ON work_memories ((metadata->>'status'));
```

2. **Use Database Functions**:
```sql
CREATE FUNCTION get_category_counts(user_id TEXT)
RETURNS TABLE(category_name TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT metadata->>'category', COUNT(*)
  FROM work_memories
  WHERE "userId" = user_id
  GROUP BY metadata->>'category';
END;
$$ LANGUAGE plpgsql;
```

## Module Development Guide

### Step 1: Define Types

Create `src/modules/[module]/types.ts`:
```typescript
export interface Entity {
  id: string;
  name: string;
  // ... other fields
}

export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}
```

### Step 2: Create Module Class

Create `src/modules/[module]/[Module]Module.ts`:
```typescript
export class DomainModule extends BaseModule {
  // Implement required methods
}
```

### Step 3: Create Service

Create `src/services/[domain].service.ts`:
```typescript
export class DomainService {
  // Implement business logic
}
```

### Step 4: Add MCP Tools

Update `src/api/mcp/authenticated-server.ts`:
```typescript
function registerDomainTools(server: McpServer, service: DomainService, userContext?: UserContext) {
  // Register all domain-specific tools
}
```

### Step 5: Add SQL Optimizations

Create `src/api/mcp/[domain]-queries.ts`:
```typescript
export const DomainQueries = {
  async listEntities(userId: string, filters: any) {
    // SQL-optimized queries
  }
};
```

## Examples & Templates

### Creating a New Entity Type

Example: Adding a "person" entity to the system:

```typescript
// 1. Define the type
interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  membershipStatus: 'guest' | 'regular' | 'member';
  customFields: Record<string, any>;
}

// 2. Create storage method
async createPerson(userId: string, person: Omit<Person, 'id'>): Promise<Person> {
  const personId = uuidv4();
  const content = `Person: ${person.firstName} ${person.lastName}`;
  
  const metadata = {
    type: 'person',
    id: personId,
    ...person
  };
  
  const memoryId = await this.module.store(userId, content, metadata);
  await this.cmiService.indexMemory(userId, 'work', memoryId, content, metadata);
  
  return { id: personId, ...person };
}

// 3. Create search method
async searchPeople(userId: string, query: string): Promise<Person[]> {
  // Use SQL for structured search
  if (query.includes(':')) {
    const [field, value] = query.split(':');
    return await prisma.$queryRaw`
      SELECT metadata
      FROM work_memories
      WHERE "userId" = ${userId}
        AND metadata->>'type' = 'person'
        AND metadata->>${field} = ${value}
    `;
  }
  
  // Use semantic search for natural language
  const results = await this.module.search(userId, query);
  return results.map(r => r.metadata as Person);
}
```

### Common Metadata Schemas

See [metadata-schemas.md](./patterns/metadata-schemas.md) for detailed examples of:
- Project metadata structure
- Task metadata structure
- Person metadata structure
- Event metadata structure
- Communication metadata structure

### Query Optimization Examples

See [query-patterns.md](./patterns/query-patterns.md) for:
- Efficient filtering queries
- Aggregation queries
- Join-like queries across metadata
- Performance optimization tips

### MCP Tool Templates

See [mcp-tool-patterns.md](./patterns/mcp-tool-patterns.md) for:
- CRUD tool templates
- Search tool patterns
- Bulk operation tools
- Export/import tools

## Best Practices

1. **Always use the metadata type field** - This is crucial for querying
2. **Generate meaningful content** - Helps with semantic search
3. **Index frequently queried fields** - Add database indexes
4. **Use registries for lists** - Don't create separate tables
5. **Batch operations when possible** - Reduce database calls
6. **Handle errors gracefully** - Provide meaningful error messages
7. **Test with large datasets** - Ensure performance at scale
8. **Document metadata schemas** - Keep track of what fields each type uses
9. **Use dynamic tool registration** - Avoid hardcoding tool lists
10. **Cache MCP server instances** - Improve performance for repeated calls
11. **Centralize tool execution** - Use tool-executor.ts for consistency

## Migration Guide

When adding new features to existing types:

1. **Add new fields to metadata** - Existing memories won't break
2. **Use default values** - Handle missing fields gracefully
3. **Create migration tools if needed** - Update existing memories
4. **Version your schemas** - Track changes over time

Example:
```typescript
// Handle old and new schema
const person = memory.metadata;
const email = person.email || person.contact?.emails?.[0]?.address || '';
```

## Performance Considerations

1. **Connection Pooling**: Use singleton PrismaClient
2. **Batch Embeddings**: Process multiple texts at once
3. **Caching**: Implement Redis for frequently accessed data
4. **Pagination**: Always limit result sets
5. **Indexes**: Add for all searchable metadata fields

## Security Considerations

1. **Authentication**: Token-based for BigMemory compatibility
2. **Data Isolation**: Always filter by userId
3. **Input Validation**: Use Zod schemas
4. **Sensitive Data**: Consider encryption for PII
5. **Audit Trails**: Log all modifications

## Known Issues & Limitations

### Current Issues

See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for detailed tracking of current issues.

**Critical Issues:**
- `cmiService.updateIndex` function missing - affects all memory update operations
- `searchPeople` semantic search failures
- SQL type casting errors in ministry queries

**Impact:** Some Church module tools are non-functional pending backend fixes.

### Limitations

1. **Memory Updates**: Update operations require CMI service completion
2. **Performance**: Large datasets need optimization and indexing
3. **Real-time**: No live updates between users yet
4. **Validation**: Limited schema validation on metadata updates
5. **Backup**: No automated backup system for memories

## Future Extensibility

The system is designed to support:
- Additional memory modules
- New entity types without schema changes
- Multiple authentication methods
- Real-time synchronization
- External integrations
- AI-powered features

---

This architecture enables rapid development of new features while maintaining consistency and performance across the system.