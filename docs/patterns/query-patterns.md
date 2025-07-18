# Query Patterns

This document provides SQL query patterns and optimization strategies for the Federated Memory System.

## Table of Contents
1. [Query Strategy Decision Tree](#query-strategy-decision-tree)
2. [Basic SQL Patterns](#basic-sql-patterns)
3. [JSONB Query Patterns](#jsonb-query-patterns)
4. [Aggregation Patterns](#aggregation-patterns)
5. [Join-Like Patterns](#join-like-patterns)
6. [Performance Optimization](#performance-optimization)
7. [Database Functions](#database-functions)
8. [Index Strategies](#index-strategies)

## Query Strategy Decision Tree

```
┌─────────────────────────┐
│   Query Type?           │
└──────────┬──────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
Structured    Natural Language
    │             │
    ▼             ▼
Use SQL      Use Semantic
           
Structured Query Indicators:
- Exact field matches (status = 'active')
- Date ranges
- Counting/aggregation
- Sorting by fields
- Filtering by enums

Natural Language Indicators:
- Descriptive queries ("tasks about authentication")
- Similarity search
- Content-based search
- No exact field matches
```

## Basic SQL Patterns

### Pattern 1: Simple Metadata Query

```typescript
// Find all items of a specific type
const query = Prisma.sql`
  SELECT id, content, metadata, "createdAt", "updatedAt"
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = ${type}
  ORDER BY "createdAt" DESC
`;

const results = await prisma.$queryRaw(query);
```

### Pattern 2: Multi-Field Filter

```typescript
// Build dynamic query with multiple conditions
async function buildFilterQuery(userId: string, filters: any) {
  let query = Prisma.sql`
    SELECT id, content, metadata, "createdAt", "updatedAt"
    FROM work_memories
    WHERE "userId" = ${userId}
  `;
  
  // Add type filter
  if (filters.type) {
    query = Prisma.sql`${query} AND metadata->>'type' = ${filters.type}`;
  }
  
  // Add status filter
  if (filters.status) {
    query = Prisma.sql`${query} AND metadata->>'status' = ${filters.status}`;
  }
  
  // Add date range filter
  if (filters.startDate) {
    query = Prisma.sql`${query} AND (metadata->>'createdAt')::timestamp >= ${filters.startDate}`;
  }
  
  // Add ordering
  query = Prisma.sql`${query} ORDER BY metadata->>'createdAt' DESC`;
  
  return await prisma.$queryRaw(query);
}
```

### Pattern 3: Pagination

```typescript
async function paginatedQuery(userId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  
  // Get total count
  const countResult = await prisma.$queryRaw<[{count: bigint}]>`
    SELECT COUNT(*) as count
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'task'
  `;
  
  // Get paginated results
  const results = await prisma.$queryRaw`
    SELECT id, content, metadata, "createdAt", "updatedAt"
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'task'
    ORDER BY metadata->>'createdAt' DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;
  
  return {
    items: results,
    total: Number(countResult[0].count),
    page: page,
    pageSize: pageSize,
    totalPages: Math.ceil(Number(countResult[0].count) / pageSize)
  };
}
```

## JSONB Query Patterns

### Pattern 1: Nested Field Access

```typescript
// Access nested fields in metadata
const peopleWithEmail = await prisma.$queryRaw`
  SELECT id, metadata
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'person'
    AND metadata->'contact'->'emails'->0->>'address' IS NOT NULL
`;

// Access array elements
const peopleWithSkills = await prisma.$queryRaw`
  SELECT id, metadata
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'person'
    AND jsonb_array_length(metadata->'customFields'->'skills') > 0
`;
```

### Pattern 2: JSONB Contains

```typescript
// Check if JSONB contains specific values
const peopleWithTag = await prisma.$queryRaw`
  SELECT id, metadata
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'person'
    AND metadata->'tags' ? ${tag}
`;

// Check if JSONB contains object
const projectsWithTeamMember = await prisma.$queryRaw`
  SELECT id, metadata
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'project'
    AND metadata->'team' @> ${JSON.stringify([{userId: memberId}])}
`;
```

### Pattern 3: JSONB Array Operations

```typescript
// Expand JSONB arrays
const allTags = await prisma.$queryRaw`
  SELECT DISTINCT jsonb_array_elements_text(metadata->'tags') as tag
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'person'
    AND jsonb_typeof(metadata->'tags') = 'array'
  ORDER BY tag
`;

// Search within arrays
const peopleWithSkill = await prisma.$queryRaw`
  SELECT id, metadata
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'person'
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(metadata->'customFields'->'skills') skill
      WHERE skill ILIKE ${`%${searchTerm}%`}
    )
`;
```

## Aggregation Patterns

### Pattern 1: Count by Field

```typescript
// Count items by status
const statusCounts = await prisma.$queryRaw<Array<{status: string, count: bigint}>>`
  SELECT 
    metadata->>'status' as status,
    COUNT(*) as count
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'task'
  GROUP BY metadata->>'status'
  ORDER BY count DESC
`;

// Convert bigint to number
const results = statusCounts.map(row => ({
  status: row.status,
  count: Number(row.count)
}));
```

### Pattern 2: Date-Based Aggregation

```typescript
// Count by month
const monthlyStats = await prisma.$queryRaw`
  SELECT 
    DATE_TRUNC('month', (metadata->>'createdAt')::timestamp) as month,
    metadata->>'type' as type,
    COUNT(*) as count
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'createdAt' IS NOT NULL
  GROUP BY month, type
  ORDER BY month DESC, count DESC
`;

// Count by day of week
const weekdayActivity = await prisma.$queryRaw`
  SELECT 
    EXTRACT(DOW FROM (metadata->>'createdAt')::timestamp) as day_of_week,
    COUNT(*) as count
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'createdAt' > NOW() - INTERVAL '30 days'
  GROUP BY day_of_week
  ORDER BY day_of_week
`;
```

### Pattern 3: Complex Aggregations

```typescript
// Project statistics with task breakdowns
const projectStats = await prisma.$queryRaw`
  WITH project_tasks AS (
    SELECT 
      metadata->>'projectId' as project_id,
      metadata->>'status' as status,
      metadata->>'priority' as priority,
      CASE 
        WHEN metadata->>'status' IN ('done', 'completed') THEN 1 
        ELSE 0 
      END as is_completed
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'task'
      AND metadata->>'projectId' IS NOT NULL
  )
  SELECT 
    project_id,
    COUNT(*) as total_tasks,
    SUM(is_completed) as completed_tasks,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
    ROUND(100.0 * SUM(is_completed) / COUNT(*), 2) as completion_percentage
  FROM project_tasks
  GROUP BY project_id
`;
```

## Join-Like Patterns

### Pattern 1: Parent-Child Relationships

```typescript
// Get projects with task counts
const projectsWithTasks = await prisma.$queryRaw`
  WITH project_data AS (
    SELECT 
      id,
      metadata->>'id' as project_id,
      metadata->>'name' as project_name,
      metadata->>'status' as project_status
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'project'
  ),
  task_counts AS (
    SELECT 
      metadata->>'projectId' as project_id,
      COUNT(*) as task_count,
      COUNT(*) FILTER (WHERE metadata->>'status' = 'done') as completed_tasks
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'task'
    GROUP BY metadata->>'projectId'
  )
  SELECT 
    p.*,
    COALESCE(t.task_count, 0) as task_count,
    COALESCE(t.completed_tasks, 0) as completed_tasks
  FROM project_data p
  LEFT JOIN task_counts t ON p.project_id = t.project_id
  ORDER BY p.project_name
`;
```

### Pattern 2: Many-to-Many Relationships

```typescript
// Get people with their group memberships
const peopleWithGroups = await prisma.$queryRaw`
  WITH people AS (
    SELECT 
      id,
      metadata->>'id' as person_id,
      metadata->>'firstName' as first_name,
      metadata->>'lastName' as last_name
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'person'
  ),
  memberships AS (
    SELECT 
      metadata->>'personId' as person_id,
      metadata->>'groupId' as group_id,
      metadata->>'role' as role
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'group_membership'
  ),
  groups AS (
    SELECT 
      metadata->>'id' as group_id,
      metadata->>'name' as group_name
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'group'
  )
  SELECT 
    p.*,
    COALESCE(
      json_agg(
        json_build_object(
          'groupId', g.group_id,
          'groupName', g.group_name,
          'role', m.role
        ) 
      ) FILTER (WHERE g.group_id IS NOT NULL), 
      '[]'::json
    ) as groups
  FROM people p
  LEFT JOIN memberships m ON p.person_id = m.person_id
  LEFT JOIN groups g ON m.group_id = g.group_id
  GROUP BY p.id, p.person_id, p.first_name, p.last_name
`;
```

### Pattern 3: Hierarchical Data

```typescript
// Get categories with parent hierarchy
const categoryHierarchy = await prisma.$queryRaw`
  WITH RECURSIVE category_tree AS (
    -- Base case: root categories
    SELECT 
      metadata->>'name' as name,
      metadata->>'parentCategory' as parent,
      metadata->>'icon' as icon,
      0 as level,
      ARRAY[metadata->>'name'] as path
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'category'
      AND metadata->>'parentCategory' IS NULL
    
    UNION ALL
    
    -- Recursive case: child categories
    SELECT 
      c.metadata->>'name',
      c.metadata->>'parentCategory',
      c.metadata->>'icon',
      ct.level + 1,
      ct.path || (c.metadata->>'name')
    FROM work_memories c
    INNER JOIN category_tree ct ON c.metadata->>'parentCategory' = ct.name
    WHERE c."userId" = ${userId}
      AND c.metadata->>'type' = 'category'
  )
  SELECT * FROM category_tree
  ORDER BY path
`;
```

## Performance Optimization

### Pattern 1: Efficient Existence Checks

```typescript
// Bad: Fetching all data
const hasData = (await module.search(userId, query)).length > 0;

// Good: Using EXISTS
const exists = await prisma.$queryRaw<[{exists: boolean}]>`
  SELECT EXISTS (
    SELECT 1
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = ${type}
      AND metadata->>'id' = ${id}
  ) as exists
`;
const hasData = exists[0].exists;
```

### Pattern 2: Batch Operations

```typescript
// Bad: Multiple queries in a loop
for (const id of projectIds) {
  const count = await getTaskCount(id);
  // ...
}

// Good: Single query with aggregation
const allCounts = await prisma.$queryRaw`
  SELECT 
    metadata->>'projectId' as project_id,
    COUNT(*) as task_count
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'task'
    AND metadata->>'projectId' = ANY(${projectIds})
  GROUP BY metadata->>'projectId'
`;
```

### Pattern 3: Selective Field Loading

```typescript
// Bad: Loading everything when you only need IDs
const memories = await prisma.$queryRaw`
  SELECT * FROM work_memories WHERE ...
`;
const ids = memories.map(m => m.id);

// Good: Select only what you need
const ids = await prisma.$queryRaw<Array<{id: string}>>`
  SELECT id
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = ${type}
`;
```

## Database Functions

### Function 1: Get Category Counts

```sql
CREATE OR REPLACE FUNCTION get_category_counts(user_id TEXT)
RETURNS TABLE(
  category_name TEXT,
  memory_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    metadata->>'category' as category_name,
    COUNT(*)::BIGINT as memory_count
  FROM work_memories
  WHERE "userId" = user_id
    AND metadata->>'category' IS NOT NULL
  GROUP BY metadata->>'category'
  ORDER BY memory_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Usage in TypeScript
const categoryCounts = await prisma.$queryRaw`
  SELECT * FROM get_category_counts(${userId})
`;
```

### Function 2: Search with Relevance Ranking

```sql
CREATE OR REPLACE FUNCTION search_memories_ranked(
  user_id TEXT,
  search_term TEXT,
  memory_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.content,
    m.metadata,
    (
      CASE WHEN m.content ILIKE '%' || search_term || '%' THEN 1.0 ELSE 0.0 END +
      CASE WHEN m.metadata->>'name' ILIKE '%' || search_term || '%' THEN 0.8 ELSE 0.0 END +
      CASE WHEN m.metadata->>'description' ILIKE '%' || search_term || '%' THEN 0.6 ELSE 0.0 END +
      CASE WHEN m.metadata::text ILIKE '%' || search_term || '%' THEN 0.4 ELSE 0.0 END
    ) as relevance_score
  FROM work_memories m
  WHERE m."userId" = user_id
    AND (memory_type IS NULL OR m.metadata->>'type' = memory_type)
    AND (
      m.content ILIKE '%' || search_term || '%' OR
      m.metadata::text ILIKE '%' || search_term || '%'
    )
  ORDER BY relevance_score DESC, m."updatedAt" DESC;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Function 3: Get Related Items

```sql
CREATE OR REPLACE FUNCTION get_related_items(
  user_id TEXT,
  item_id TEXT,
  item_type TEXT,
  limit_count INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  relationship_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Direct relationships
  SELECT 
    m.id,
    m.content,
    m.metadata,
    'direct' as relationship_type
  FROM work_memories m
  WHERE m."userId" = user_id
    AND m.metadata->>'type' = item_type
    AND (
      m.metadata->>'parentId' = item_id OR
      m.metadata->>'projectId' = item_id OR
      m.metadata->'relatedIds' ? item_id
    )
  
  UNION
  
  -- Same category
  SELECT 
    m.id,
    m.content,
    m.metadata,
    'same_category' as relationship_type
  FROM work_memories m
  WHERE m."userId" = user_id
    AND m.metadata->>'type' = item_type
    AND m.metadata->>'category' = (
      SELECT metadata->>'category'
      FROM work_memories
      WHERE "userId" = user_id
        AND metadata->>'id' = item_id
      LIMIT 1
    )
    AND m.metadata->>'id' != item_id
  
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Index Strategies

### Essential Indexes

```sql
-- Type-based queries (most common)
CREATE INDEX idx_work_memories_type 
ON work_memories ((metadata->>'type'));

-- Status filtering
CREATE INDEX idx_work_memories_status 
ON work_memories ((metadata->>'status')) 
WHERE metadata->>'status' IS NOT NULL;

-- Date-based queries
CREATE INDEX idx_work_memories_metadata_created 
ON work_memories (((metadata->>'createdAt')::timestamp));

-- User + Type composite (very common pattern)
CREATE INDEX idx_work_memories_user_type 
ON work_memories ("userId", (metadata->>'type'));

-- Category searches
CREATE INDEX idx_work_memories_category 
ON work_memories ((metadata->>'category')) 
WHERE metadata->>'category' IS NOT NULL;

-- GIN index for JSONB contains queries
CREATE INDEX idx_work_memories_metadata_gin 
ON work_memories USING GIN (metadata);

-- Text search on content
CREATE INDEX idx_work_memories_content_trgm 
ON work_memories USING GIN (content gin_trgm_ops);
```

### Specialized Indexes

```sql
-- For project-task relationships
CREATE INDEX idx_work_memories_project_tasks 
ON work_memories ((metadata->>'projectId')) 
WHERE metadata->>'type' = 'task';

-- For person queries
CREATE INDEX idx_work_memories_person_email 
ON work_memories ((metadata->'contact'->'emails'->0->>'address')) 
WHERE metadata->>'type' = 'person';

-- For tag searches
CREATE INDEX idx_work_memories_tags 
ON work_memories USING GIN ((metadata->'tags')) 
WHERE jsonb_typeof(metadata->'tags') = 'array';
```

### Index Usage Verification

```sql
-- Check if indexes are being used
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM work_memories 
WHERE "userId" = 'user-123' 
  AND metadata->>'type' = 'task'
  AND metadata->>'status' = 'active';

-- Find missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  most_common_vals
FROM pg_stats
WHERE tablename = 'work_memories'
  AND attname LIKE 'metadata%';
```

## Query Performance Tips

1. **Use parameterized queries** with Prisma.sql to prevent SQL injection
2. **Avoid SELECT \*** - only fetch needed columns
3. **Use LIMIT** for large result sets
4. **Create indexes** for frequently queried fields
5. **Use EXISTS** instead of COUNT for existence checks
6. **Batch operations** instead of loops
7. **Consider materialized views** for complex aggregations
8. **Monitor slow queries** with pg_stat_statements
9. **Use EXPLAIN ANALYZE** to understand query plans
10. **Keep statistics updated** with ANALYZE command