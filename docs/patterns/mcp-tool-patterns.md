# MCP Tool Patterns

This document provides templates and patterns for implementing MCP (Model Context Protocol) tools in the Federated Memory System.

## Table of Contents
1. [Tool Registration Pattern](#tool-registration-pattern)
2. [Authentication Patterns](#authentication-patterns)
3. [CRUD Tool Templates](#crud-tool-templates)
4. [Search Tool Patterns](#search-tool-patterns)
5. [Bulk Operation Tools](#bulk-operation-tools)
6. [Export/Import Tools](#exportimport-tools)
7. [Error Handling Patterns](#error-handling-patterns)

## Tool Registration Pattern

### Basic Tool Structure

```typescript
server.registerTool(
  'toolName',                    // Unique identifier
  {
    title: 'Tool Title',         // Human-readable name
    description: 'What this tool does and when to use it',
    inputSchema: {
      // Zod schema for parameters
      requiredParam: z.string().describe('Description for AI'),
      optionalParam: z.number().optional().describe('Optional parameter'),
      enumParam: z.enum(['option1', 'option2']).describe('Choose one'),
      arrayParam: z.array(z.string()).optional().describe('List of values')
    }
  },
  async (params) => {
    // Tool implementation
    try {
      const result = await doSomething(params);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
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

### Tool Registration Function Pattern

```typescript
function registerDomainTools(
  server: McpServer,
  service: DomainService,
  userContext?: UserContext
) {
  // Group related tools together
  
  // === Create Operations ===
  server.registerTool('createEntity', { /* ... */ }, async (params) => { /* ... */ });
  
  // === Read Operations ===
  server.registerTool('getEntity', { /* ... */ }, async (params) => { /* ... */ });
  server.registerTool('listEntities', { /* ... */ }, async (params) => { /* ... */ });
  
  // === Update Operations ===
  server.registerTool('updateEntity', { /* ... */ }, async (params) => { /* ... */ });
  
  // === Delete Operations ===
  server.registerTool('deleteEntity', { /* ... */ }, async (params) => { /* ... */ });
}
```

## Authentication Patterns

### Pattern 1: Required Authentication

```typescript
async (params) => {
  // Check for user context
  if (!userContext?.userId) {
    throwAuthRequired();  // Throws OAuth error
  }
  
  // Proceed with authenticated operation
  const result = await service.method(userContext.userId, params);
  // ...
}
```

### Pattern 2: Optional Authentication

```typescript
async (params) => {
  if (userContext?.userId) {
    // Authenticated: show user-specific data
    const result = await service.getUserData(userContext.userId, params);
    return formatResponse(result);
  } else {
    // Unauthenticated: show public data only
    const result = await service.getPublicData(params);
    return formatResponse(result);
  }
}
```

### Pattern 3: Permission Checks

```typescript
async (params) => {
  if (!userContext?.userId) {
    throwAuthRequired();
  }
  
  // Check permissions
  if (!userContext.permissions?.includes('admin')) {
    throw new Error('Admin permission required for this operation');
  }
  
  // Proceed with admin operation
  const result = await service.adminMethod(userContext.userId, params);
  // ...
}
```

## CRUD Tool Templates

### Create Tool Template

```typescript
server.registerTool(
  'createPerson',
  {
    title: 'Create Person',
    description: 'Create a new person record in the system',
    inputSchema: {
      firstName: z.string().describe('First name of the person'),
      lastName: z.string().describe('Last name of the person'),
      email: z.string().email().optional().describe('Email address'),
      phone: z.string().optional().describe('Phone number'),
      membershipStatus: z.enum(['guest', 'regular', 'member'])
        .optional()
        .describe('Membership status (defaults to guest)'),
      customFields: z.record(z.any()).optional()
        .describe('Custom fields as key-value pairs'),
      tags: z.array(z.string()).optional()
        .describe('Tags for categorization')
    }
  },
  async (params) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      // Input validation
      if (!params.firstName || !params.lastName) {
        throw new Error('First name and last name are required');
      }
      
      // Create entity
      const person = await service.createPerson(userContext.userId, {
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        phone: params.phone,
        membershipStatus: params.membershipStatus || 'guest',
        customFields: params.customFields || {},
        tags: params.tags || []
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            person: person,
            message: `Created person: ${person.firstName} ${person.lastName}`
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Create person error', { error, params });
      return {
        content: [{
          type: 'text',
          text: `Error creating person: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Read Tool Template

```typescript
server.registerTool(
  'getPerson',
  {
    title: 'Get Person',
    description: 'Retrieve a person by ID',
    inputSchema: {
      personId: z.string().describe('The ID of the person to retrieve')
    }
  },
  async ({ personId }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      const person = await service.getPerson(userContext.userId, personId);
      
      if (!person) {
        return {
          content: [{
            type: 'text',
            text: `Person not found with ID: ${personId}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(person, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Get person error', { error, personId });
      return {
        content: [{
          type: 'text',
          text: `Error retrieving person: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Update Tool Template

```typescript
server.registerTool(
  'updatePerson',
  {
    title: 'Update Person',
    description: 'Update an existing person record',
    inputSchema: {
      personId: z.string().describe('The ID of the person to update'),
      updates: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        membershipStatus: z.enum(['guest', 'regular', 'member']).optional(),
        customFields: z.record(z.any()).optional(),
        tags: z.array(z.string()).optional()
      }).describe('Fields to update')
    }
  },
  async ({ personId, updates }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      const updated = await service.updatePerson(
        userContext.userId,
        personId,
        updates
      );
      
      if (!updated) {
        return {
          content: [{
            type: 'text',
            text: `Person not found with ID: ${personId}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            person: updated,
            message: 'Person updated successfully'
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Update person error', { error, personId, updates });
      return {
        content: [{
          type: 'text',
          text: `Error updating person: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Delete Tool Template

```typescript
server.registerTool(
  'deletePerson',
  {
    title: 'Delete Person',
    description: 'Delete a person record (soft delete)',
    inputSchema: {
      personId: z.string().describe('The ID of the person to delete'),
      hardDelete: z.boolean().optional()
        .describe('Permanently delete (default: false)')
    }
  },
  async ({ personId, hardDelete }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      const deleted = await service.deletePerson(
        userContext.userId,
        personId,
        { hardDelete: hardDelete || false }
      );
      
      if (!deleted) {
        return {
          content: [{
            type: 'text',
            text: `Person not found with ID: ${personId}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: hardDelete 
              ? 'Person permanently deleted'
              : 'Person marked as deleted',
            personId: personId
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Delete person error', { error, personId });
      return {
        content: [{
          type: 'text',
          text: `Error deleting person: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

## Search Tool Patterns

### Basic Search Tool

```typescript
server.registerTool(
  'searchPeople',
  {
    title: 'Search People',
    description: 'Search for people using various filters or natural language',
    inputSchema: {
      query: z.string().optional()
        .describe('Search query (name, email, or natural language)'),
      filters: z.object({
        membershipStatus: z.enum(['guest', 'regular', 'member']).optional(),
        tags: z.array(z.string()).optional(),
        ministry: z.string().optional(),
        hasEmail: z.boolean().optional(),
        createdAfter: z.string().optional(),
        createdBefore: z.string().optional()
      }).optional().describe('Structured filters'),
      limit: z.number().min(1).max(100).optional().default(20)
        .describe('Maximum results to return'),
      offset: z.number().min(0).optional().default(0)
        .describe('Pagination offset')
    }
  },
  async ({ query, filters, limit, offset }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      let results;
      
      if (query && !filters) {
        // Natural language search
        results = await service.searchPeople(userContext.userId, query, {
          limit,
          offset
        });
      } else {
        // Structured search
        results = await service.listPeople(userContext.userId, {
          filters: filters || {},
          limit,
          offset
        });
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            results: results.items,
            total: results.total,
            limit: limit,
            offset: offset,
            hasMore: offset + results.items.length < results.total
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Search people error', { error, query, filters });
      return {
        content: [{
          type: 'text',
          text: `Error searching people: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Advanced Search with Aggregation

```typescript
server.registerTool(
  'analyzePeople',
  {
    title: 'Analyze People Data',
    description: 'Get statistics and insights about people in the system',
    inputSchema: {
      groupBy: z.enum(['membershipStatus', 'ministry', 'month', 'tags'])
        .describe('Field to group results by'),
      filters: z.object({
        dateRange: z.object({
          start: z.string().describe('Start date (ISO format)'),
          end: z.string().describe('End date (ISO format)')
        }).optional(),
        membershipStatus: z.array(z.string()).optional()
      }).optional().describe('Filters to apply before aggregation')
    }
  },
  async ({ groupBy, filters }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      const analysis = await service.analyzePeople(
        userContext.userId,
        groupBy,
        filters
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            analysis: analysis,
            groupBy: groupBy,
            filters: filters,
            generatedAt: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Analyze people error', { error, groupBy, filters });
      return {
        content: [{
          type: 'text',
          text: `Error analyzing people data: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

## Bulk Operation Tools

### Bulk Create Tool

```typescript
server.registerTool(
  'bulkCreatePeople',
  {
    title: 'Bulk Create People',
    description: 'Create multiple people records at once',
    inputSchema: {
      people: z.array(z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        membershipStatus: z.enum(['guest', 'regular', 'member']).optional(),
        customFields: z.record(z.any()).optional()
      })).describe('Array of people to create'),
      skipDuplicates: z.boolean().optional().default(true)
        .describe('Skip if email already exists')
    }
  },
  async ({ people, skipDuplicates }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      const results = {
        created: [],
        skipped: [],
        errors: []
      };
      
      // Process in batches for performance
      const batchSize = 10;
      for (let i = 0; i < people.length; i += batchSize) {
        const batch = people.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (person, index) => {
            try {
              // Check for duplicates if needed
              if (skipDuplicates && person.email) {
                const existing = await service.findByEmail(
                  userContext.userId,
                  person.email
                );
                if (existing) {
                  results.skipped.push({
                    index: i + index,
                    email: person.email,
                    reason: 'Email already exists'
                  });
                  return null;
                }
              }
              
              const created = await service.createPerson(
                userContext.userId,
                person
              );
              results.created.push(created);
              return created;
            } catch (error) {
              results.errors.push({
                index: i + index,
                person: person,
                error: error.message
              });
              return null;
            }
          })
        );
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            summary: {
              total: people.length,
              created: results.created.length,
              skipped: results.skipped.length,
              errors: results.errors.length
            },
            results: results
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Bulk create people error', { error });
      return {
        content: [{
          type: 'text',
          text: `Error in bulk create: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Bulk Update Tool

```typescript
server.registerTool(
  'bulkUpdatePeople',
  {
    title: 'Bulk Update People',
    description: 'Update multiple people based on criteria',
    inputSchema: {
      criteria: z.object({
        ids: z.array(z.string()).optional()
          .describe('Specific person IDs to update'),
        filter: z.object({
          membershipStatus: z.string().optional(),
          tags: z.array(z.string()).optional(),
          ministry: z.string().optional()
        }).optional().describe('Filter criteria')
      }).describe('Selection criteria'),
      updates: z.object({
        membershipStatus: z.string().optional(),
        addTags: z.array(z.string()).optional(),
        removeTags: z.array(z.string()).optional(),
        customFields: z.record(z.any()).optional()
      }).describe('Updates to apply'),
      dryRun: z.boolean().optional().default(false)
        .describe('Preview changes without applying')
    }
  },
  async ({ criteria, updates, dryRun }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      // Find people to update
      let peopleToUpdate;
      if (criteria.ids) {
        peopleToUpdate = await service.getByIds(userContext.userId, criteria.ids);
      } else if (criteria.filter) {
        const results = await service.listPeople(userContext.userId, {
          filters: criteria.filter
        });
        peopleToUpdate = results.items;
      } else {
        throw new Error('Either ids or filter must be provided');
      }
      
      if (dryRun) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dryRun: true,
              wouldUpdate: peopleToUpdate.length,
              people: peopleToUpdate.map(p => ({
                id: p.id,
                name: `${p.firstName} ${p.lastName}`,
                currentStatus: p.membershipStatus
              })),
              updates: updates
            }, null, 2)
          }]
        };
      }
      
      // Apply updates
      const results = await service.bulkUpdate(
        userContext.userId,
        peopleToUpdate.map(p => p.id),
        updates
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            updated: results.updated,
            failed: results.failed,
            message: `Updated ${results.updated} people`
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Bulk update people error', { error, criteria, updates });
      return {
        content: [{
          type: 'text',
          text: `Error in bulk update: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

## Export/Import Tools

### Export Tool

```typescript
server.registerTool(
  'exportPeople',
  {
    title: 'Export People Data',
    description: 'Export people data in various formats',
    inputSchema: {
      format: z.enum(['csv', 'json', 'xlsx'])
        .describe('Export format'),
      filters: z.object({
        membershipStatus: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        createdAfter: z.string().optional(),
        createdBefore: z.string().optional()
      }).optional().describe('Filters to apply'),
      fields: z.array(z.string()).optional()
        .describe('Specific fields to include (default: all)'),
      includeCustomFields: z.boolean().optional().default(true)
        .describe('Include custom fields in export')
    }
  },
  async ({ format, filters, fields, includeCustomFields }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      // Get data to export
      const data = await service.listPeople(userContext.userId, {
        filters: filters || {},
        limit: 10000 // Reasonable limit
      });
      
      let exportData;
      
      switch (format) {
        case 'csv':
          exportData = await service.exportToCSV(data.items, {
            fields,
            includeCustomFields
          });
          break;
          
        case 'json':
          exportData = JSON.stringify(data.items, null, 2);
          break;
          
        case 'xlsx':
          exportData = await service.exportToExcel(data.items, {
            fields,
            includeCustomFields
          });
          break;
      }
      
      // For this example, we'll return the data
      // In practice, you might save to a file or return a download URL
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            format: format,
            totalRecords: data.items.length,
            exportedAt: new Date().toISOString(),
            data: format === 'json' ? JSON.parse(exportData) : exportData,
            message: `Exported ${data.items.length} people records`
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Export people error', { error, format, filters });
      return {
        content: [{
          type: 'text',
          text: `Error exporting data: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

### Import Tool

```typescript
server.registerTool(
  'importPeople',
  {
    title: 'Import People Data',
    description: 'Import people from CSV or JSON data',
    inputSchema: {
      format: z.enum(['csv', 'json'])
        .describe('Import format'),
      data: z.string()
        .describe('The data to import (CSV string or JSON string)'),
      mappings: z.record(z.string()).optional()
        .describe('Field mappings (importField: systemField)'),
      options: z.object({
        updateExisting: z.boolean().optional().default(false)
          .describe('Update existing records by email'),
        skipInvalid: z.boolean().optional().default(true)
          .describe('Skip invalid records instead of failing'),
        dryRun: z.boolean().optional().default(false)
          .describe('Validate without importing')
      }).optional()
    }
  },
  async ({ format, data, mappings, options = {} }) => {
    if (!userContext?.userId) {
      throwAuthRequired();
    }
    
    try {
      // Parse data
      let records;
      if (format === 'csv') {
        records = await service.parseCSV(data, mappings);
      } else {
        records = JSON.parse(data);
      }
      
      // Validate records
      const validation = await service.validateImportData(records);
      
      if (options.dryRun) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dryRun: true,
              totalRecords: records.length,
              valid: validation.valid.length,
              invalid: validation.invalid.length,
              duplicates: validation.duplicates.length,
              validation: validation
            }, null, 2)
          }]
        };
      }
      
      // Import records
      const results = await service.importPeople(
        userContext.userId,
        validation.valid,
        options
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            imported: results.imported,
            updated: results.updated,
            skipped: results.skipped,
            errors: results.errors,
            summary: {
              total: records.length,
              successful: results.imported + results.updated,
              failed: results.errors.length
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Import people error', { error, format });
      return {
        content: [{
          type: 'text',
          text: `Error importing data: ${error.message}`
        }],
        isError: true
      };
    }
  }
);
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
async (params) => {
  // Input validation
  try {
    validateInput(params);
  } catch (validationError) {
    return {
      content: [{
        type: 'text',
        text: `Invalid input: ${validationError.message}`
      }],
      isError: true
    };
  }
  
  // Authentication check
  if (!userContext?.userId) {
    throwAuthRequired();
  }
  
  try {
    // Main operation
    const result = await service.operation(userContext.userId, params);
    
    // Success response
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
    
  } catch (error) {
    // Log error with context
    logger.error('Operation failed', {
      tool: 'toolName',
      userId: userContext.userId,
      params: params,
      error: error.message,
      stack: error.stack
    });
    
    // User-friendly error response
    let errorMessage = 'An unexpected error occurred';
    
    if (error.code === 'NOT_FOUND') {
      errorMessage = 'The requested resource was not found';
    } else if (error.code === 'PERMISSION_DENIED') {
      errorMessage = 'You do not have permission to perform this operation';
    } else if (error.code === 'VALIDATION_ERROR') {
      errorMessage = `Validation error: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: errorMessage,
          code: error.code,
          timestamp: new Date().toISOString()
        }, null, 2)
      }],
      isError: true
    };
  }
}
```

### Retry Pattern for Transient Errors

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Only retry on transient errors
      if (
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message.includes('temporarily unavailable')
      ) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
      }
      
      // Non-retryable error
      throw error;
    }
  }
  
  throw lastError;
}

// Usage in tool
async (params) => {
  try {
    const result = await withRetry(
      () => service.operation(userContext.userId, params)
    );
    return formatSuccess(result);
  } catch (error) {
    return formatError(error);
  }
}
```

## Best Practices

1. **Always validate input** using Zod schemas
2. **Check authentication** before any user-specific operations
3. **Return structured JSON** for easy parsing by AI
4. **Include success indicators** in responses
5. **Log errors with context** for debugging
6. **Use descriptive error messages** that help users
7. **Implement pagination** for list operations
8. **Support dry-run mode** for dangerous operations
9. **Include timestamps** in responses
10. **Follow consistent naming** conventions