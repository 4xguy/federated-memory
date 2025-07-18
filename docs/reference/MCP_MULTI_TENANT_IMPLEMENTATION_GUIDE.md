# MCP Multi-Tenant Implementation Guide: Token-Based Authentication with SSE

## Overview

This guide documents the implementation pattern used by BigMemory for creating a multi-tenant Model Context Protocol (MCP) server. This approach enables multiple users to connect to a single MCP server instance while maintaining complete data isolation and security.

### Key Architecture Decisions

1. **UUID Token Authentication**: Each user receives a unique, unguessable UUID token instead of traditional username/password
2. **Single SSE Endpoint**: One endpoint serves all users with token-based routing (NOT unique endpoints per user)
3. **Multi-Transport Support**: SSE for server-to-client, REST API for client-to-server, optional WebSocket
4. **Complete User Isolation**: All data operations are scoped to the authenticated user at the database level

## 1. User Management and Authentication

### Database Schema

```typescript
// Essential User Model Fields
interface User {
  id: string;           // UUID, auto-generated (e.g., "550e8400-e29b-41d4-a716-446655440000")
  token: string;        // UUID, auto-generated, UNIQUE INDEX REQUIRED
  email?: string;       // Optional, for email-based features
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: object;    // Flexible JSON storage for user preferences
  subscriptionTier?: string;  // For feature gating
}

// Example Prisma Schema
model User {
  id              String   @id @default(uuid())
  token           String   @unique @default(uuid())
  email           String?  @unique
  emailVerified   Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  metadata        Json     @default("{}")
  
  // Relations
  memories        Memory[]
  sessions        Session[]
  
  @@index([token])  // Critical for performance
}
```

### User Registration Implementation

```typescript
// POST /api/auth/register
import { randomUUID } from 'crypto';

async function registerUser(req: Request, res: Response) {
  try {
    // Generate unique token
    const token = randomUUID();
    
    // Create user with minimal required data
    const user = await prisma.user.create({
      data: {
        token,
        email: req.body.email,  // Optional
        metadata: {
          source: 'api',
          version: '1.0'
        }
      }
    });
    
    // Return token immediately - this is the user's permanent credential
    return res.status(201).json({
      success: true,
      data: {
        token: user.token,
        userId: user.id,
        // IMPORTANT: Never return sensitive data
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {  // Unique constraint violation
      return res.status(409).json({
        error: 'Email already registered'
      });
    }
    throw error;
  }
}

// Alternative: CLI-friendly registration (no email required)
// POST /api/auth/register-cli
async function registerCLIUser(req: Request, res: Response) {
  const token = randomUUID();
  const user = await prisma.user.create({
    data: { token }
  });
  
  // Simple response for CLI parsing
  return res.json({ token: user.token });
}
```

### Authentication Middleware

```typescript
// CRITICAL: This middleware must be applied to ALL protected routes
async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Support both header and query parameter authentication
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || 
                  req.query.token as string;
    
    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided',
        code: 'NO_TOKEN'
      });
    }
    
    // Validate token format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return res.status(401).json({
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    // Look up user by token
    const user = await prisma.user.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        email: true,
        metadata: true,
        subscriptionTier: true
      }
    });
    
    if (!user) {
      return res.status(401).json({
        error: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }
    
    // Attach user to request for downstream use
    req.user = user;
    req.userId = user.id;  // Convenience property
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

// TypeScript augmentation for request
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}
```

### Token Rotation (Security Feature)

```typescript
// POST /api/auth/rotate
async function rotateToken(req: Request, res: Response) {
  const oldToken = req.user.token;
  const newToken = randomUUID();
  
  await prisma.user.update({
    where: { id: req.userId },
    data: { 
      token: newToken,
      metadata: {
        ...req.user.metadata,
        lastTokenRotation: new Date().toISOString(),
        previousToken: oldToken.substring(0, 8) + '...' // Log prefix only
      }
    }
  });
  
  return res.json({
    success: true,
    data: { token: newToken }
  });
}
```

## 2. SSE (Server-Sent Events) Implementation

### CRITICAL UNDERSTANDING: Single Endpoint Architecture

**IMPORTANT**: BigMemory uses a SINGLE SSE endpoint (`/api/mcp/sse`) that serves ALL users. Authentication happens via token, NOT via unique URLs per user.

```typescript
// ❌ WRONG APPROACH - Do NOT create unique endpoints per userId
app.get('/api/mcp/sse/:userId', handler);  // DON'T DO THIS

// ✅ CORRECT APPROACH - Token in URL path (BigMemory pattern)
app.get('/api/sse/:token', handler);  // DO THIS
```

### SSE Endpoint Implementation

```typescript
// Connection tracking
const activeConnections = new Map<string, SSEConnection>();

interface SSEConnection {
  userId: string;
  response: Response;
  lastActivity: number;
  heartbeatInterval: NodeJS.Timer;
}

// GET /api/sse/:token
app.get('/api/sse/:token', async (req: Request, res: Response) => {
  const token = req.params.token;
  
  // Validate token
  const user = await prisma.user.findUnique({
    where: { token, isActive: true }
  });
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // Set SSE headers - CRITICAL for proper operation
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',  // Disable Nginx buffering
    'Access-Control-Allow-Origin': '*',  // Adjust for security
  });
  
  // Generate connection ID
  const connectionId = randomUUID();
  
  // Send initial connection confirmation
  sendSSEMessage(res, {
    type: 'connection',
    connectionId,
    userId: req.userId
  });
  
  // Send MCP capabilities
  sendSSEMessage(res, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {
      protocolVersion: '2024-11-05',
      serverName: 'your-mcp-server',
      capabilities: {
        tools: getToolsForUser(req.user),
        resources: getResourcesForUser(req.user)
      }
    }
  });
  
  // Heartbeat to prevent timeout (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch (error) {
      // Connection closed, cleanup will handle
    }
  }, 30000);
  
  // Store connection
  activeConnections.set(connectionId, {
    userId: req.userId,
    response: res,
    lastActivity: Date.now(),
    heartbeatInterval
  });
  
  // CRITICAL: Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    activeConnections.delete(connectionId);
    console.log(`SSE connection closed for user ${req.userId}`);
  });
  
  // Handle connection errors
  req.on('error', (error) => {
    console.error(`SSE connection error for user ${req.userId}:`, error);
    clearInterval(heartbeatInterval);
    activeConnections.delete(connectionId);
  });
});

// Helper function to send SSE messages
function sendSSEMessage(res: Response, data: any) {
  try {
    // SSE format: "data: <json>\n\n"
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    res.flush?.();  // Force send if available
  } catch (error) {
    console.error('Failed to send SSE message:', error);
  }
}

// Broadcast to specific user (used by other parts of the system)
function broadcastToUser(userId: string, message: any) {
  for (const [connId, conn] of activeConnections.entries()) {
    if (conn.userId === userId) {
      sendSSEMessage(conn.response, message);
    }
  }
}
```

### Connection Management Best Practices

```typescript
// Periodic cleanup of stale connections
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000;  // 5 minutes
  
  for (const [connId, conn] of activeConnections.entries()) {
    if (now - conn.lastActivity > timeout) {
      try {
        conn.response.end();
      } catch (e) {
        // Already closed
      }
      clearInterval(conn.heartbeatInterval);
      activeConnections.delete(connId);
    }
  }
}, 60000);  // Check every minute

// Graceful shutdown
process.on('SIGTERM', () => {
  // Close all SSE connections
  for (const [connId, conn] of activeConnections.entries()) {
    sendSSEMessage(conn.response, {
      type: 'server_shutdown',
      message: 'Server is shutting down'
    });
    conn.response.end();
    clearInterval(conn.heartbeatInterval);
  }
  activeConnections.clear();
});
```

## 3. MCP Protocol Implementation

### Multi-Transport Architecture

BigMemory implements three transport methods for maximum compatibility:

1. **SSE**: Server-to-client notifications
2. **REST API**: Client-to-server tool calls
3. **WebSocket**: Optional bidirectional communication

### REST API for Tool Execution

```typescript
// POST /api/mcp/tools/call
app.post('/api/mcp/tools/call', authenticate, async (req: Request, res: Response) => {
  const { tool, arguments: args } = req.body;
  
  try {
    // Validate tool exists and user has access
    const toolDef = getToolDefinition(tool);
    if (!toolDef) {
      return res.status(404).json({
        error: 'Tool not found',
        code: 'TOOL_NOT_FOUND'
      });
    }
    
    // Check user permissions for this tool
    if (!canUserAccessTool(req.user, tool)) {
      return res.status(403).json({
        error: 'Access denied to this tool',
        code: 'ACCESS_DENIED'
      });
    }
    
    // Execute tool with user context
    const result = await executeToolForUser(tool, args, req.userId);
    
    // Send success notification via SSE
    broadcastToUser(req.userId, {
      type: 'tool_executed',
      tool,
      success: true
    });
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Send error notification via SSE
    broadcastToUser(req.userId, {
      type: 'tool_error',
      tool,
      error: error.message
    });
    
    throw error;
  }
});

// Tool execution with user scoping
async function executeToolForUser(toolName: string, args: any, userId: string) {
  // CRITICAL: All database operations must include userId
  switch (toolName) {
    case 'memory/create':
      return await prisma.memory.create({
        data: {
          ...args,
          userId  // ALWAYS include userId
        }
      });
      
    case 'memory/search':
      return await prisma.memory.findMany({
        where: {
          userId,  // ALWAYS filter by user
          content: {
            search: args.query
          }
        }
      });
      
    case 'memory/delete':
      // Verify ownership before deletion
      const memory = await prisma.memory.findFirst({
        where: {
          id: args.id,
          userId  // Ensures user owns this memory
        }
      });
      
      if (!memory) {
        throw new Error('Memory not found or access denied');
      }
      
      return await prisma.memory.delete({
        where: { id: args.id }
      });
      
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

### MCP Message Handler

```typescript
// POST /api/mcp/messages - Alternative to direct tool calls
app.post('/api/mcp/messages', authenticate, async (req: Request, res: Response) => {
  const { jsonrpc, method, params, id } = req.body;
  
  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request'
      },
      id: id || null
    });
  }
  
  try {
    let result;
    
    switch (method) {
      case 'tools/list':
        result = getToolsForUser(req.user);
        break;
        
      case 'tools/call':
        result = await executeToolForUser(
          params.name,
          params.arguments,
          req.userId
        );
        break;
        
      case 'resources/list':
        result = await getResourcesForUser(req.userId);
        break;
        
      case 'resources/read':
        result = await readResourceForUser(params.uri, req.userId);
        break;
        
      default:
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found'
          },
          id
        });
    }
    
    return res.json({
      jsonrpc: '2.0',
      result,
      id
    });
  } catch (error) {
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id
    });
  }
});
```

## 4. Database Operations and User Isolation

### CRITICAL: User Scoping Pattern

Every database operation MUST include the userId to ensure data isolation:

```typescript
// ❌ WRONG - No user isolation
const getAllMemories = async () => {
  return await prisma.memory.findMany();
};

// ✅ CORRECT - User-scoped query
const getUserMemories = async (userId: string) => {
  return await prisma.memory.findMany({
    where: { userId }
  });
};

// ❌ WRONG - Trusting client-provided ID
const updateMemory = async (memoryId: string, data: any, clientUserId: string) => {
  return await prisma.memory.update({
    where: { 
      id: memoryId,
      userId: clientUserId  // Never trust client-provided user ID
    },
    data
  });
};

// ✅ CORRECT - Using authenticated user ID
const updateMemory = async (memoryId: string, data: any, req: Request) => {
  return await prisma.memory.update({
    where: { 
      id: memoryId,
      userId: req.userId  // From authentication middleware
    },
    data
  });
};
```

### Common Patterns for User Isolation

```typescript
// 1. Create operations
async function createResource(data: any, userId: string) {
  return await prisma.resource.create({
    data: {
      ...data,
      userId,  // Always set owner
      createdAt: new Date()
    }
  });
}

// 2. Read operations with ownership check
async function getResource(resourceId: string, userId: string) {
  const resource = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      userId  // Ensures user owns this resource
    }
  });
  
  if (!resource) {
    throw new Error('Resource not found or access denied');
  }
  
  return resource;
}

// 3. Update with ownership verification
async function updateResource(resourceId: string, updates: any, userId: string) {
  // First verify ownership
  const existing = await prisma.resource.findFirst({
    where: { id: resourceId, userId }
  });
  
  if (!existing) {
    throw new Error('Resource not found or access denied');
  }
  
  return await prisma.resource.update({
    where: { id: resourceId },
    data: updates
  });
}

// 4. Delete with cascading user check
async function deleteResource(resourceId: string, userId: string) {
  // Use deleteMany with user filter to ensure ownership
  const result = await prisma.resource.deleteMany({
    where: {
      id: resourceId,
      userId
    }
  });
  
  if (result.count === 0) {
    throw new Error('Resource not found or access denied');
  }
  
  return { success: true };
}

// 5. Search/list operations
async function searchResources(query: string, userId: string, options?: any) {
  return await prisma.resource.findMany({
    where: {
      userId,  // ALWAYS first
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } }
      ]
    },
    take: options?.limit || 50,
    skip: options?.offset || 0,
    orderBy: { createdAt: 'desc' }
  });
}
```

## 5. Client Implementation

### MCP Client Adapter

```typescript
// mcp-client-adapter.js
const WebSocket = require('ws');
const EventSource = require('eventsource');
const fetch = require('node-fetch');

class MCPClient {
  constructor(config) {
    this.token = config.token || process.env.MCP_TOKEN;
    this.baseUrl = config.baseUrl || process.env.MCP_BASE_URL;
    
    if (!this.token) {
      throw new Error('MCP_TOKEN environment variable is required');
    }
    
    this.sseUrl = `${this.baseUrl}/api/mcp/sse?token=${this.token}`;
    this.apiUrl = `${this.baseUrl}/api/mcp`;
  }
  
  async connect() {
    // Establish SSE connection for server notifications
    this.eventSource = new EventSource(this.sseUrl);
    
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleServerMessage(data);
    };
    
    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Implement reconnection logic
      setTimeout(() => this.connect(), 5000);
    };
    
    console.log('Connected to MCP server');
  }
  
  async callTool(toolName, args) {
    const response = await fetch(`${this.apiUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: toolName,
        arguments: args
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Tool execution failed');
    }
    
    return await response.json();
  }
  
  handleServerMessage(message) {
    // Handle different message types
    switch (message.type || message.method) {
      case 'notifications/initialized':
        this.capabilities = message.params.capabilities;
        break;
      case 'tool_executed':
        console.log(`Tool ${message.tool} executed successfully`);
        break;
      default:
        console.log('Server message:', message);
    }
  }
  
  async disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// Export for use with Claude Desktop or other MCP clients
module.exports = MCPClient;
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "your-server": {
      "command": "node",
      "args": ["/path/to/mcp-client-adapter.js"],
      "env": {
        "MCP_TOKEN": "your-uuid-token-here",
        "MCP_BASE_URL": "https://your-server.com"
      }
    }
  }
}
```

## 6. Installation Guide for End Users

### Step 1: Get Authentication Token

```bash
# Option 1: Using curl
curl -X POST https://your-server.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{}' \
  | jq -r '.data.token'

# Option 2: Using provided script
npm install -g @your-org/mcp-client
mcp-client register --server https://your-server.com

# Save the token securely - this is your permanent credential
```

### Step 2: Configure MCP Client

For Claude Desktop:
1. Open Claude Desktop settings
2. Navigate to MCP Servers section
3. Add configuration:

```json
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": ["@your-org/mcp-client", "connect"],
      "env": {
        "MCP_TOKEN": "paste-your-token-here",
        "MCP_BASE_URL": "https://your-server.com"
      }
    }
  }
}
```

### Step 3: Verify Connection

```bash
# Test via API
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-server.com/api/mcp/tools/list

# Should return available tools
```

## 7. Common Implementation Pitfalls

### Pitfall 1: Creating Unique Endpoints Per User

```typescript
// ❌ WRONG - Don't create dynamic routes
app.get('/api/users/:userId/sse', (req, res) => {
  // This approach doesn't scale and complicates client configuration
});

// ✅ CORRECT - Token in URL path
app.get('/api/sse/:token', (req, res) => {
  // Token validation and user context
});
```

### Pitfall 2: Forgetting User Scope in Queries

```typescript
// ❌ WRONG - Missing user filter
const memory = await prisma.memory.findUnique({
  where: { id: memoryId }
});

// ✅ CORRECT - Include user check
const memory = await prisma.memory.findFirst({
  where: { 
    id: memoryId,
    userId: req.userId 
  }
});
```

### Pitfall 3: Trusting Client-Provided User IDs

```typescript
// ❌ WRONG - Never trust client for user ID
const userId = req.body.userId || req.headers['x-user-id'];

// ✅ CORRECT - Only use authenticated user
const userId = req.userId;  // From auth middleware
```

### Pitfall 4: Not Handling Connection Cleanup

```typescript
// ❌ WRONG - Memory leak
app.get('/sse', (req, res) => {
  setInterval(() => {
    res.write('ping\n');
  }, 30000);
  // No cleanup!
});

// ✅ CORRECT - Proper cleanup
app.get('/sse', (req, res) => {
  const interval = setInterval(() => {
    res.write('ping\n');
  }, 30000);
  
  req.on('close', () => {
    clearInterval(interval);
    // Additional cleanup
  });
});
```

### Pitfall 5: Exposing Internal IDs

```typescript
// ❌ WRONG - Exposing database IDs
return res.json({
  id: memory.id,
  internalUserId: memory.userId,
  databaseId: memory._id
});

// ✅ CORRECT - Only necessary data
return res.json({
  id: memory.id,
  content: memory.content,
  createdAt: memory.createdAt
});
```

## 8. Security Checklist

- [ ] UUID tokens are generated using crypto.randomUUID()
- [ ] Tokens are stored securely (consider hashing in production)
- [ ] All endpoints require authentication middleware
- [ ] Database queries always include userId filter
- [ ] No client-provided user IDs are trusted
- [ ] SSE connections are cleaned up on disconnect
- [ ] Rate limiting is implemented per user
- [ ] Sensitive data is never logged
- [ ] CORS is configured appropriately
- [ ] Connection limits per user are enforced
- [ ] Token rotation endpoint is available
- [ ] Error messages don't leak sensitive information

## 9. Testing Considerations

### Unit Test Example

```typescript
describe('User Isolation', () => {
  it('should not allow access to other users data', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    const memory = await createMemory(user1.token, {
      content: 'User 1 memory'
    });
    
    // Attempt to access with user2's token
    const response = await request(app)
      .get(`/api/memories/${memory.id}`)
      .set('Authorization', `Bearer ${user2.token}`);
    
    expect(response.status).toBe(404);
    expect(response.body.error).toContain('not found');
  });
});
```

### Integration Test Example

```typescript
describe('SSE Connection', () => {
  it('should maintain user context throughout connection', (done) => {
    const token = 'test-token';
    const eventSource = new EventSource(`/api/mcp/sse?token=${token}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      expect(data.userId).toBe(expectedUserId);
      eventSource.close();
      done();
    };
  });
});
```

## 10. Migration Guide for Existing MCP Servers

### Step 1: Add User Table

```sql
-- PostgreSQL migration
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_users_token ON users(token);
```

### Step 2: Add userId to Existing Tables

```sql
-- Add user foreign key to existing tables
ALTER TABLE your_resources ADD COLUMN user_id UUID REFERENCES users(id);

-- For existing single-user data, create default user
INSERT INTO users (id) VALUES ('00000000-0000-0000-0000-000000000000');
UPDATE your_resources SET user_id = '00000000-0000-0000-0000-000000000000';

-- Make user_id required
ALTER TABLE your_resources ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX idx_resources_user_id ON your_resources(user_id);
```

### Step 3: Update Application Code

```typescript
// Before: Global queries
app.get('/api/resources', async (req, res) => {
  const resources = await db.resources.findAll();
  res.json(resources);
});

// After: User-scoped queries
app.get('/api/resources', authenticate, async (req, res) => {
  const resources = await db.resources.findAll({
    where: { userId: req.userId }
  });
  res.json(resources);
});
```

### Step 4: Update Client Configuration

Provide migration instructions to users:

```markdown
## Migration Instructions

1. Get your new authentication token:
   ```
   curl -X POST https://server.com/api/auth/migrate \
     -H "X-Old-API-Key: your-old-key"
   ```

2. Update your MCP configuration with the new token
3. Verify your data migrated correctly
```

## Conclusion

This implementation pattern provides a secure, scalable way to add multi-tenancy to MCP servers. The key principles are:

1. Use UUID tokens for simple, secure authentication
2. Implement a single SSE endpoint with token-based routing
3. Always scope database operations to the authenticated user
4. Never trust client-provided user identifiers
5. Properly manage connection lifecycle and cleanup

By following this guide, you can transform any single-user MCP server into a multi-tenant system that maintains complete user isolation while providing a seamless experience for end users.