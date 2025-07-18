# Church Module Troubleshooting Guide

This guide provides step-by-step troubleshooting for Church module issues discovered during testing.

## Issue 1: cmiService.updateIndex Function Missing

### Symptoms
```
Error: cmiService.updateIndex is not a function
```

### Affected Operations
- Updating person records
- Setting custom field values  
- Bulk people updates

### Root Cause Analysis

The Church service calls `cmiService.updateIndex()` when updating memory metadata:

```typescript
// In church.service.ts line ~200
await this.cmiService.updateIndex(userId, memory.id, {
  content: newContent,
  metadata: updatedMetadata
});
```

But this method doesn't exist in the CMI service implementation.

### Investigation Steps

1. **Check CMI Service Implementation**:
   ```bash
   find src/ -name "*.ts" -exec grep -l "updateIndex" {} \;
   ```

2. **Check Available CMI Methods**:
   ```typescript
   // Look at src/core/cmi/index.service.ts
   console.log(Object.getOwnPropertyNames(cmiService));
   ```

3. **Check Other Module Patterns**:
   ```bash
   grep -r "update.*memory" src/services/ --include="*.ts"
   ```

### Potential Solutions

#### Option A: Implement updateIndex Method
```typescript
// In CMI service
async updateIndex(userId: string, memoryId: string, updates: any) {
  // Find the memory in CMI index
  const indexEntry = await prisma.memoryIndex.findFirst({
    where: { userId, remoteMemoryId: memoryId }
  });
  
  if (!indexEntry) return false;
  
  // Update the module's memory
  const module = await moduleRegistry.getModule(indexEntry.moduleId);
  const success = await module.update(userId, memoryId, updates);
  
  // Update CMI index if needed
  if (success && updates.content) {
    await prisma.memoryIndex.update({
      where: { id: indexEntry.id },
      data: {
        title: updates.metadata?.name || updates.metadata?.firstName,
        summary: updates.content.substring(0, 200),
        lastAccessed: new Date()
      }
    });
  }
  
  return success;
}
```

#### Option B: Use Existing Update Pattern
```typescript
// In church.service.ts - modify update methods
async updatePerson(userId: string, personId: string, updates: any) {
  // Get the memory first
  const memory = await this.getPersonMemory(userId, personId);
  if (!memory) return null;
  
  // Update using module's update method instead of cmiService.updateIndex
  const success = await this.module.update(userId, memory.id, {
    content: this.generateUpdatedContent(memory.metadata, updates),
    metadata: { ...memory.metadata, ...updates, updatedAt: new Date().toISOString() }
  });
  
  return success ? { ...memory.metadata, ...updates } : null;
}
```

## Issue 2: searchPeople Memory Search Failure

### Symptoms
```
Error searching people: Failed to search memories
```

### Root Cause Analysis

The search is failing in the semantic search portion:

```typescript
// In church.service.ts
const results = await this.module.search(userId, query, { limit, minScore: 0.3 });
```

### Investigation Steps

1. **Test Module Search Directly**:
   ```typescript
   // In a test script
   const churchModule = new ChurchModule(config, embeddingService);
   const results = await churchModule.search(userId, "test query");
   console.log(results);
   ```

2. **Check Embedding Generation**:
   ```typescript
   // Test if embeddings are being generated
   const content = "Test person: John Doe";
   const embedding = await embeddingService.generateEmbedding(content);
   console.log('Embedding length:', embedding?.length);
   ```

3. **Check Database Storage**:
   ```sql
   SELECT id, content, embedding IS NOT NULL as has_embedding 
   FROM work_memories 
   WHERE "userId" = ? AND metadata->>'type' = 'person';
   ```

### Potential Solutions

#### Option A: Fix Embedding Storage
```typescript
// In ChurchModule.ts - ensure embeddings are stored
protected async storeInModule(
  userId: string,
  content: string,
  embedding: number[],
  metadata: Record<string, any>
): Promise<Memory> {
  // Verify embedding is valid
  if (!embedding || embedding.length !== 1536) {
    throw new Error('Invalid embedding provided');
  }
  
  // Store with proper vector type
  await this.prisma.$executeRaw`
    INSERT INTO work_memories (id, "userId", content, embedding, metadata, "accessCount", "lastAccessed", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${content}, ${JSON.stringify(embedding)}::vector, ${metadata}, 0, NOW(), NOW(), NOW())
  `;
}
```

#### Option B: Use SQL Fallback for Search
```typescript
// In church.service.ts - add fallback search
async searchPeople(userId: string, params: any) {
  try {
    // Try semantic search first
    const results = await this.module.search(userId, params.query, { limit: params.limit });
    return this.formatSearchResults(results);
  } catch (error) {
    logger.warn('Semantic search failed, using SQL fallback', { error });
    
    // Fallback to SQL search
    return await this.listPeople(userId, {
      filters: { searchTerm: params.query },
      limit: params.limit
    });
  }
}
```

## Issue 3: listMinistryMembers SQL Type Error

### Symptoms
```
operator does not exist: text = boolean
```

### Root Cause Analysis

SQL query is comparing incompatible types:

```sql
-- Likely problematic query in church-queries.ts
WHERE metadata->'ministryRoles' @> '[{"ministry": "name", "active": true}]'
-- But 'active' field might be stored as string "true" not boolean true
```

### Investigation Steps

1. **Check Ministry Data Format**:
   ```sql
   SELECT metadata->'ministryRoles' 
   FROM work_memories 
   WHERE metadata->>'type' = 'person' 
   AND metadata->'ministryRoles' IS NOT NULL;
   ```

2. **Test Query Parts**:
   ```sql
   -- Test individual query components
   SELECT id, metadata->'ministryRoles' as roles
   FROM work_memories 
   WHERE "userId" = 'test-user'
   AND metadata->>'type' = 'person';
   ```

### Solution

Fix the query to handle string/boolean type consistency:

```typescript
// In church-queries.ts
async listMinistryMembers(userId: string, ministryName: string) {
  return await prisma.$queryRaw`
    SELECT id, content, metadata, "createdAt", "updatedAt"
    FROM work_memories
    WHERE "userId" = ${userId}
      AND metadata->>'type' = 'person'
      AND EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(metadata->'ministryRoles') AS role
        WHERE role->>'ministry' = ${ministryName}
          AND (role->>'active' = 'true' OR role->'active' = true)
      )
    ORDER BY metadata->>'lastName', metadata->>'firstName'
  `;
}
```

## Testing Protocol

### 1. Unit Testing Each Fix

```typescript
// Create test file: src/tests/church-fixes.test.ts
describe('Church Module Fixes', () => {
  test('updatePerson should work', async () => {
    const person = await churchService.createPerson(userId, testPerson);
    const updated = await churchService.updatePerson(userId, person.id, {
      lastName: 'UpdatedName'
    });
    expect(updated.lastName).toBe('UpdatedName');
  });
  
  test('searchPeople should return results', async () => {
    await churchService.createPerson(userId, testPerson);
    const results = await churchService.searchPeople(userId, { query: 'test' });
    expect(results.items.length).toBeGreaterThan(0);
  });
  
  test('listMinistryMembers should work', async () => {
    const person = await churchService.createPerson(userId, testPerson);
    await churchService.assignMinistryRole(userId, person.id, 'TestMinistry', 'member');
    const members = await churchService.listMinistryMembers(userId, 'TestMinistry');
    expect(members.length).toBe(1);
  });
});
```

### 2. Integration Testing

```bash
# Test all church tools after fixes
npm run test:church-tools
```

### 3. Manual Testing Checklist

- [ ] Create person ✅ (already working)
- [ ] Update person last name
- [ ] Search for people by natural language
- [ ] List ministry members
- [ ] Set custom field values  
- [ ] Bulk update people
- [ ] All tools return proper JSON responses

## Priority Implementation Order

1. **Fix updateIndex** - Unblocks all update operations
2. **Fix searchPeople** - Enables natural language search  
3. **Fix listMinistryMembers** - Completes ministry management
4. **Update test data** - Fix César Omar's last name
5. **Add comprehensive tests** - Prevent regressions

---

*Use this guide to systematically address each issue and verify fixes through testing.*