# Search Strategy Architecture

## Overview

The Federated Memory system uses a hybrid search approach combining:
1. **Semantic Search** - For content-based queries using vector embeddings
2. **SQL Metadata Search** - For structured data queries on JSONB fields
3. **CMI Routing** - For intelligent module selection

## Current Implementation Analysis

### 🧠 Semantic Search (Via CMI)
Used for content-based, similarity, and natural language queries:

| Tool | Current Implementation | Appropriate? |
|------|----------------------|--------------|
| `searchMemory` | ✅ CMI semantic search | ✅ YES - Content similarity |
| `searchCategories` | ⚠️ CMI search + SQL | 🔄 MIXED - Should be SQL only |
| Registry lookups | ⚠️ CMI search | ❌ NO - Should be SQL |

### 📊 Direct SQL Queries
Used for structured metadata and exact matches:

| Tool | Current Implementation | Appropriate? |
|------|----------------------|--------------|
| `updateTaskStatus` | ✅ SQL query on metadata | ✅ YES - Exact ID lookup |
| `getTaskDependencies` | ✅ SQL query on metadata | ✅ YES - Relationship query |
| `searchCategories` (count) | ✅ SQL function | ✅ YES - Aggregation |
| `listProjects` | ⚠️ CMI search | ❌ NO - Should be SQL |
| `listTasks` | ⚠️ CMI search | ❌ NO - Should be SQL |

## Recommended Strategy

### When to Use Semantic Search (CMI)
- **Natural language queries**: "find memories about authentication"
- **Content similarity**: "similar to this code snippet"
- **Cross-module search**: When you don't know which module contains the data
- **Fuzzy matching**: When exact terms are unknown

### When to Use Direct SQL
- **Exact ID lookups**: Finding by memory ID or metadata.id
- **Type filtering**: `metadata->>'type' = 'task'`
- **Status queries**: All tasks with status='pending'
- **Aggregations**: Counts, averages, grouping
- **Relationships**: Dependencies, parent-child
- **Date ranges**: Created/updated within timeframe
- **Structured queries**: Any query on known metadata fields

### When to Use Hybrid
- **Category search with context**: SQL for list, semantic for related content
- **Project overview**: SQL for structure, semantic for documentation

## Performance Comparison

| Operation | Semantic Search | SQL Query |
|-----------|----------------|-----------|
| Exact ID lookup | ~100-200ms | ~5-10ms |
| Type filtering | ~150-300ms | ~10-20ms |
| Content similarity | ~50-100ms | N/A |
| Complex aggregation | ~500ms+ | ~20-50ms |
| Natural language | ~100ms | N/A |

## Optimization Opportunities

### 1. **High Priority - Fix List Operations**
```typescript
// Current (inefficient)
const projectMemories = await cmiService.search(userId, 'type:project', {...});

// Optimized (direct SQL)
const projectMemories = await prisma.$queryRaw`
  SELECT id, metadata, content
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'project'
    AND (metadata->>'isActive' IS NULL OR metadata->>'isActive' = 'true')
  ORDER BY metadata->>'createdAt' DESC
`;
```

### 2. **Medium Priority - Registry Queries**
```typescript
// Current (semantic search for exact match)
const registrySearch = await cmiService.search(userId, 
  `type:registry registryType:categories`, {...});

// Optimized (direct lookup)
const registry = await prisma.$queryRaw`
  SELECT metadata
  FROM personal_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'registry'
    AND metadata->>'registryType' = 'categories'
  LIMIT 1
`;
```

### 3. **Add Indexes for Common Queries**
```sql
-- Indexes for frequent metadata queries
CREATE INDEX idx_work_memories_type ON work_memories ((metadata->>'type'));
CREATE INDEX idx_work_memories_project ON work_memories ((metadata->>'projectId'));
CREATE INDEX idx_personal_memories_type ON personal_memories ((metadata->>'type'));
```

## Implementation Guidelines

### Rule 1: Query Type Determines Method
```typescript
// Structured query → SQL
if (queryInvolves(['id', 'type', 'status', 'date', 'count'])) {
  return useSQL();
}

// Content query → Semantic
if (queryInvolves(['similar', 'about', 'like', 'related'])) {
  return useSemantic();
}
```

### Rule 2: Metadata Fields = SQL
Any query filtering on metadata fields should use SQL:
- `type`, `status`, `category`, `projectId`
- Dates: `createdAt`, `updatedAt`, `dueDate`
- Relationships: `parentId`, `dependsOn`
- Flags: `isActive`, `isCompleted`

### Rule 3: Aggregations = SQL
- Counts, sums, averages
- Group by operations
- Distinct values
- Min/max queries

### Rule 4: Content Search = Semantic
- Full-text search in content
- Similarity matching
- Natural language queries
- Cross-module discovery

## Refactoring Priority

1. **🔴 Critical** - List operations (listProjects, listTasks)
2. **🟠 High** - Registry lookups
3. **🟡 Medium** - Category searches (except content search)
4. **🟢 Low** - Optimize hybrid queries

## Expected Performance Gains

After optimization:
- List operations: **10-30x faster** (200ms → 10ms)
- Registry lookups: **20x faster** (100ms → 5ms)
- Task queries: **15x faster** (150ms → 10ms)
- Overall API response: **50-70% reduction**