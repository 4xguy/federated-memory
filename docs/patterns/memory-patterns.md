# Memory Patterns

This document provides detailed patterns and examples for working with memories in the Federated Memory System.

## Table of Contents
1. [Basic Memory Operations](#basic-memory-operations)
2. [Content Generation Strategies](#content-generation-strategies)
3. [Metadata Structure Patterns](#metadata-structure-patterns)
4. [Registry Pattern](#registry-pattern)
5. [Relationship Patterns](#relationship-patterns)
6. [Search Patterns](#search-patterns)

## Basic Memory Operations

### Creating a Memory

```typescript
// Basic memory creation
const memoryId = await module.store(
  userId,
  content,     // Human-readable description
  metadata     // Structured data as JSONB
);

// Full example with CMI integration
async function createMemory(userId: string, data: any, moduleId: string) {
  // 1. Generate content
  const content = generateContent(data);
  
  // 2. Structure metadata
  const metadata = {
    type: data.type,
    id: data.id || uuidv4(),
    ...data,
    createdAt: new Date().toISOString()
  };
  
  // 3. Store in module
  const memoryId = await module.store(userId, content, metadata);
  
  // 4. Index with CMI for cross-module search
  await cmiService.indexMemory(userId, moduleId, memoryId, content, metadata);
  
  return memoryId;
}
```

### Updating a Memory

```typescript
// Update pattern preserving history
async function updateMemory(userId: string, memoryId: string, updates: any) {
  // 1. Fetch existing memory
  const existing = await module.get(userId, memoryId);
  if (!existing) throw new Error('Memory not found');
  
  // 2. Merge updates
  const updatedMetadata = {
    ...existing.metadata,
    ...updates,
    updatedAt: new Date().toISOString(),
    version: (existing.metadata.version || 1) + 1
  };
  
  // 3. Regenerate content if needed
  const updatedContent = updates.name || updates.title
    ? generateContent(updatedMetadata)
    : existing.content;
  
  // 4. Update memory
  await module.update(userId, memoryId, {
    content: updatedContent,
    metadata: updatedMetadata
  });
  
  // 5. Update CMI index
  await cmiService.updateIndex(userId, moduleId, memoryId, updatedContent, updatedMetadata);
}
```

## Content Generation Strategies

### Pattern 1: Entity Description

```typescript
function generateEntityContent(entity: any): string {
  const parts = [];
  
  // Primary identifier
  parts.push(`${entity.type}: ${entity.name || entity.title}`);
  
  // Secondary description
  if (entity.description) {
    parts.push(entity.description);
  }
  
  // Key attributes
  const keyAttrs = [];
  if (entity.status) keyAttrs.push(`Status: ${entity.status}`);
  if (entity.priority) keyAttrs.push(`Priority: ${entity.priority}`);
  if (entity.assignee) keyAttrs.push(`Assigned to: ${entity.assignee}`);
  
  if (keyAttrs.length > 0) {
    parts.push(keyAttrs.join(', '));
  }
  
  return parts.join('\n');
}

// Example output:
// "Project: Website Redesign
// Complete redesign of company website with modern UI
// Status: active, Priority: high, Assigned to: John Doe"
```

### Pattern 2: Relationship Description

```typescript
function generateRelationshipContent(relationship: any): string {
  return `${relationship.sourceType} "${relationship.sourceName}" ${relationship.relationshipType} ${relationship.targetType} "${relationship.targetName}"`;
}

// Example output:
// "Task 'Update API docs' depends_on Task 'Complete API refactor'"
```

### Pattern 3: Activity/Event Description

```typescript
function generateActivityContent(activity: any): string {
  const parts = [
    `${activity.action} by ${activity.actor}`,
    `on ${activity.targetType}: ${activity.targetName}`,
    activity.details
  ].filter(Boolean);
  
  return parts.join(' ');
}

// Example output:
// "Updated by jane@example.com on Project: Q4 Planning Added 3 new milestones"
```

## Metadata Structure Patterns

### Pattern 1: Flat Entity

```typescript
// Simple entity with flat structure
const taskMetadata = {
  type: 'task',
  id: 'task-123',
  title: 'Implement search feature',
  description: 'Add full-text search to the application',
  status: 'in_progress',
  priority: 'high',
  assignee: 'developer@example.com',
  projectId: 'proj-456',
  dueDate: '2024-02-01',
  tags: ['feature', 'search', 'backend'],
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T15:30:00Z'
};
```

### Pattern 2: Nested Entity

```typescript
// Complex entity with nested structures
const personMetadata = {
  type: 'person',
  id: 'person-789',
  firstName: 'John',
  lastName: 'Smith',
  contact: {
    emails: [
      { type: 'primary', address: 'john@example.com' },
      { type: 'work', address: 'jsmith@company.com' }
    ],
    phones: [
      { type: 'mobile', number: '+1-555-0123', primary: true }
    ],
    address: {
      street: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701'
    }
  },
  customFields: {
    department: 'Engineering',
    startDate: '2020-03-15',
    skills: ['JavaScript', 'Python', 'SQL']
  },
  membershipStatus: 'active',
  tags: ['engineer', 'team-lead'],
  category: 'Staff'
};
```

### Pattern 3: Composite Entity

```typescript
// Entity that references other entities
const projectMetadata = {
  type: 'project',
  id: 'proj-456',
  name: 'Q4 Product Launch',
  description: 'Launch new product line for Q4',
  status: 'planning',
  team: [
    { userId: 'user-123', role: 'project_manager' },
    { userId: 'user-456', role: 'developer' },
    { userId: 'user-789', role: 'designer' }
  ],
  milestones: [
    { id: 'ms-1', title: 'Design Complete', dueDate: '2024-02-15', status: 'pending' },
    { id: 'ms-2', title: 'Development Complete', dueDate: '2024-03-15', status: 'pending' }
  ],
  budget: {
    allocated: 150000,
    spent: 45000,
    currency: 'USD'
  },
  metadata: {
    client: 'ACME Corp',
    contractId: 'contract-123',
    priority: 'high'
  }
};
```

## Registry Pattern

### Creating a Registry

```typescript
// Category registry example
const categoryRegistry = {
  type: 'registry',
  registryType: 'categories',
  name: 'category_registry',
  description: 'Master list of all categories',
  items: [
    {
      name: 'Projects',
      description: 'Project-related items',
      icon: '📁',
      color: '#4A90E2',
      parentCategory: null,
      sortOrder: 1,
      metadata: {
        isSystem: true,
        allowSubcategories: true
      }
    },
    {
      name: 'Active Projects',
      description: 'Currently active projects',
      icon: '🚀',
      color: '#7ED321',
      parentCategory: 'Projects',
      sortOrder: 1
    }
  ],
  metadata: {
    version: 1,
    lastUpdated: '2024-01-20T10:00:00Z',
    maintainer: 'system'
  }
};

// Store registry
const registryId = await module.store(
  userId,
  'Registry: Category Registry - Master list of all categories',
  categoryRegistry
);
```

### Updating a Registry

```typescript
async function addToRegistry(userId: string, registryType: string, newItem: any) {
  // 1. Find registry
  const registries = await module.searchByMetadata(userId, {
    type: 'registry',
    registryType: registryType
  });
  
  if (registries.length === 0) {
    throw new Error(`Registry ${registryType} not found`);
  }
  
  const registry = registries[0];
  
  // 2. Update items
  const updatedItems = [...(registry.metadata.items || []), newItem];
  
  // 3. Update registry
  await module.update(userId, registry.id, {
    metadata: {
      ...registry.metadata,
      items: updatedItems,
      lastUpdated: new Date().toISOString()
    }
  });
}
```

## Relationship Patterns

### One-to-Many Relationships

```typescript
// Project has many tasks
const projectWithTasks = {
  type: 'project',
  id: 'proj-123',
  name: 'Website Redesign',
  // Store task IDs
  taskIds: ['task-1', 'task-2', 'task-3']
};

// Each task references the project
const task = {
  type: 'task',
  id: 'task-1',
  title: 'Design mockups',
  projectId: 'proj-123'  // Reference to parent
};
```

### Many-to-Many Relationships

```typescript
// Use a junction memory type
const personGroupMembership = {
  type: 'group_membership',
  id: 'membership-123',
  personId: 'person-456',
  groupId: 'group-789',
  role: 'member',
  joinedAt: '2024-01-15',
  metadata: {
    invitedBy: 'person-123',
    permissions: ['read', 'comment']
  }
};

// Query memberships
const memberships = await prisma.$queryRaw`
  SELECT metadata
  FROM work_memories
  WHERE "userId" = ${userId}
    AND metadata->>'type' = 'group_membership'
    AND metadata->>'personId' = ${personId}
`;
```

### Dependency Relationships

```typescript
// Task dependency pattern
const taskDependency = {
  type: 'task_dependency',
  id: 'dep-123',
  taskId: 'task-456',        // Dependent task
  dependsOnTaskId: 'task-123', // Task it depends on
  dependencyType: 'blocks',    // blocks, depends_on, related
  metadata: {
    addedBy: 'user-123',
    reason: 'API must be complete before frontend work'
  }
};
```

## Search Patterns

### Metadata-Based Search

```typescript
// Search by exact metadata match
async function findByMetadata(userId: string, criteria: any) {
  const conditions = Object.entries(criteria)
    .map(([key, value]) => {
      return Prisma.sql`metadata->>${key} = ${value}`;
    });
  
  const query = Prisma.sql`
    SELECT id, content, metadata, "createdAt", "updatedAt"
    FROM work_memories
    WHERE "userId" = ${userId}
      AND ${Prisma.join(conditions, ' AND ')}
  `;
  
  return await prisma.$queryRaw(query);
}

// Usage
const activeTasks = await findByMetadata(userId, {
  type: 'task',
  status: 'active'
});
```

### Combined Semantic and Metadata Search

```typescript
async function hybridSearch(userId: string, query: string, filters: any) {
  // 1. Semantic search for relevant memories
  const semanticResults = await module.search(userId, query, {
    limit: 100,
    minScore: 0.7
  });
  
  // 2. Filter by metadata
  const filtered = semanticResults.filter(result => {
    return Object.entries(filters).every(([key, value]) => {
      return result.metadata[key] === value;
    });
  });
  
  // 3. Re-sort by relevance score
  return filtered.sort((a, b) => b.score - a.score);
}

// Usage
const results = await hybridSearch(
  userId,
  "authentication improvements",
  { type: 'task', status: 'open' }
);
```

### Aggregation Patterns

```typescript
// Count by category
async function countByCategory(userId: string) {
  const counts = await prisma.$queryRaw<Array<{category: string, count: bigint}>>`
    SELECT 
      metadata->>'category' as category,
      COUNT(*) as count
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'category' IS NOT NULL
    GROUP BY metadata->>'category'
    ORDER BY count DESC
  `;
  
  return counts.map(c => ({
    category: c.category,
    count: Number(c.count)
  }));
}

// Complex aggregation
async function getProjectStats(userId: string, projectId: string) {
  const stats = await prisma.$queryRaw<Array<any>>`
    SELECT 
      metadata->>'status' as status,
      metadata->>'priority' as priority,
      COUNT(*) as count,
      MIN(metadata->>'createdAt') as earliest,
      MAX(metadata->>'updatedAt') as latest
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'task'
      AND metadata->>'projectId' = ${projectId}
    GROUP BY 
      metadata->>'status',
      metadata->>'priority'
  `;
  
  return stats;
}
```

## Best Practices

1. **Always include type field** in metadata for efficient querying
2. **Use consistent ID formats** (prefer UUIDs)
3. **Timestamp everything** with createdAt/updatedAt
4. **Normalize category/tag names** to avoid duplicates
5. **Include search-friendly content** for better semantic search
6. **Version your metadata schemas** for future migrations
7. **Use registries for controlled vocabularies** (categories, tags, types)
8. **Implement soft deletes** by setting status/deletedAt rather than removing