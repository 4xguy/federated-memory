# MCP Server Technical Specification and Implementation Guide

## Architecture Overview

**Target**: Production-ready TypeScript MCP (Model Context Protocol) server with authentication, monitoring, and cloud deployment

**Core Technologies**:
- **Language**: TypeScript
- **Runtime**: Cloudflare Workers
- **Authentication**: GitHub OAuth
- **Database**: PostgreSQL
- **Monitoring**: Sentry
- **Transport Layers**: Streamable HTTP (primary), SSE (legacy support)
- **CLI Tool**: Wrangler (Cloudflare CLI)

## Project Structure

```
├── src/
│   ├── index.ts                 # Main MCP server implementation
│   ├── index_sentry.ts         # Sentry-enabled version
│   └── simple_math.ts          # Basic example implementation
├── wrangler.toml               # Cloudflare Worker configuration
├── .dev.vars.example          # Environment variables template
├── package.json               # Dependencies and scripts
└── README.md                  # Setup and deployment guide
```

## Environment Variables

Required environment variables (stored in `.dev.vars` for local, Cloudflare secrets for production):

```bash
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_secret
ENCRYPTION_KEY=your_custom_encryption_key
DATABASE_URL=postgresql://username:password@host:port/database
SENTRY_DSN=https://your_sentry_dsn (optional, for monitoring)
```

## Dependencies

**Core MCP Dependencies**:
```json
{
  "@cloudflare/workers-types": "latest",
  "@anthropic-ai/mcp-agent": "latest"
}
```

**Authentication Dependencies**:
- Cloudflare OAuth provider (built-in)
- GitHub OAuth integration

**Monitoring Dependencies**:
```json
{
  "@sentry/cloudflare": "latest"
}
```

## Core Implementation Patterns

### 1. Basic MCP Server Structure

```typescript
import { MCPAgent } from '@anthropic-ai/mcp-agent';

export default class MCPServer extends MCPAgent {
  constructor(props: any) {
    super(props);
    this.server = new Server(/* server config */);
    this.initializeTools();
  }

  private initializeTools() {
    // Tool registration pattern
    this.server.tool('tool_name', {
      description: 'Clear description for AI agent',
      parameters: {
        type: 'object',
        properties: {
          param_name: { type: 'string', description: 'Parameter description' }
        },
        required: ['param_name']
      }
    }, async (params) => {
      // Tool implementation
      return { result: 'formatted response' };
    });
  }
}
```

### 2. Database Lifecycle Management

**Critical Pattern**: Single database instance with proper lifecycle management

```typescript
class MCPServer extends MCPAgent {
  private db: any;

  async initialize() {
    // Create single database instance for server lifespan
    this.db = await createDatabaseConnection(process.env.DATABASE_URL);
  }

  async cleanup() {
    // Graceful shutdown - close database connections
    if (this.db) {
      await this.db.close();
    }
  }
}
```

### 3. Transport Layer Configuration

**Dual transport support**:

```typescript
// SSE endpoint (legacy support)
export const sseHandler = async (request: Request) => {
  // SSE transport implementation
};

// Streamable HTTP endpoint (primary)
export const mcpHandler = async (request: Request) => {
  // Streamable HTTP transport implementation
};

// Route configuration
export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/sse') {
      return sseHandler(request);
    }
    
    if (url.pathname === '/mcp') {
      return mcpHandler(request);
    }
    
    return new Response('404 Not Found', { status: 404 });
  }
};
```

## Authentication Implementation

### GitHub OAuth Integration

**Client-side OAuth flow**:
```typescript
import { OAuthProvider } from '@cloudflare/oauth';

const githubProvider = new OAuthProvider({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  scope: 'user:email'
});
```

**Authorization endpoints**:
- `/authorize` - OAuth authorization initiation
- `/register` - User registration flow
- `/token` - Token exchange endpoint

### Role-Based Access Control

```typescript
// Define allowed users (production: move to database)
const ALLOWED_GITHUB_USERS = ['username1', 'username2'];

// Tool-level authorization
this.server.tool('sensitive_tool', {
  // tool config
}, async (params) => {
  // Check user authorization
  if (!ALLOWED_GITHUB_USERS.includes(this.props.login)) {
    throw new Error('Unauthorized: User not in allowed list');
  }
  
  // Execute protected operation
  return await protectedOperation(params);
});
```

## Security Implementation

### 1. SQL Injection Prevention

**Query validation pattern**:
```typescript
function validateSQLQuery(query: string): void {
  const dangerousPatterns = [
    /\bDROP\b/i,
    /\bDELETE\b/i,
    /\bTRUNCATE\b/i,
    /\bALTER\b/i,
    /\bCREATE\b/i,
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /--/,
    /\/\*/,
    /\*\//,
    /;.*--;/,
    /\bunion\b/i,
    /\bexec\b/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      throw new Error(`Dangerous SQL pattern detected: ${pattern}`);
    }
  }
}
```

### 2. Input Sanitization

**Parameter validation**:
```typescript
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .trim()
    .substring(0, 1000); // Limit length
}
```

### 3. Error Handling

**Graceful error responses**:
```typescript
this.server.tool('database_tool', {
  // config
}, async (params) => {
  try {
    validateSQLQuery(params.query);
    const result = await this.db.query(params.query);
    return { 
      success: true, 
      data: formatResults(result),
      message: 'Query executed successfully'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      message: 'Query execution failed'
    };
  }
});
```

## Tool Implementation Patterns

### 1. Database Tools

**List Tables Tool**:
```typescript
this.server.tool('list_tables', {
  description: 'List all tables in the PostgreSQL database',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
}, async () => {
  const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  
  const result = await this.db.query(query);
  return {
    tables: result.rows.map(row => row.table_name),
    count: result.rows.length,
    formatted: JSON.stringify(result.rows, null, 2)
  };
});
```

**Read-Only Query Tool**:
```typescript
this.server.tool('execute_readonly_query', {
  description: 'Execute a read-only SQL query on the database',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'SQL SELECT query to execute' 
      }
    },
    required: ['query']
  }
}, async (params) => {
  validateSQLQuery(params.query);
  
  // Additional read-only validation
  if (!/^\s*SELECT\b/i.test(params.query.trim())) {
    throw new Error('Only SELECT queries are allowed');
  }
  
  const result = await this.db.query(params.query);
  return {
    query: params.query,
    rows: result.rows,
    count: result.rowCount,
    formatted: JSON.stringify(result.rows, null, 2)
  };
});
```

**Protected Write Tool**:
```typescript
this.server.tool('execute_write_query', {
  description: 'Execute a write SQL query (INSERT, UPDATE) - requires authorization',
  parameters: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'SQL write query to execute' 
      }
    },
    required: ['query']
  }
}, async (params) => {
  // Authorization check
  if (!ALLOWED_GITHUB_USERS.includes(this.props.login)) {
    throw new Error('Unauthorized: Write operations require special permissions');
  }
  
  validateSQLQuery(params.query);
  
  // Validate write operations only
  const writePattern = /^\s*(INSERT|UPDATE)\b/i;
  if (!writePattern.test(params.query.trim())) {
    throw new Error('Only INSERT and UPDATE queries are allowed');
  }
  
  const result = await this.db.query(params.query);
  return {
    query: params.query,
    affectedRows: result.rowCount,
    success: true,
    message: `Successfully executed write operation affecting ${result.rowCount} rows`
  };
});
```

### 2. Tool Description Best Practices

**Effective tool descriptions**:
- Clear, concise explanation of tool purpose
- Specify exact input/output formats
- Include usage examples where helpful
- Mention any restrictions or requirements
- Use language that helps AI agents understand when to use the tool

## Monitoring Integration (Sentry)

### 1. Sentry Configuration

```typescript
import * as Sentry from '@sentry/cloudflare';

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: 'production'
});
```

### 2. Error Tracking

```typescript
// Wrap MCP server with Sentry monitoring
export default Sentry.withSentry(MCPServer);

// Manual error reporting
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

### 3. Performance Monitoring

```typescript
// Transaction tracking for tool calls
const transaction = Sentry.startTransaction({
  name: 'mcp_tool_execution',
  op: 'tool.execute'
});

try {
  const result = await tool.execute(params);
  transaction.setStatus('ok');
  return result;
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

## Deployment Configuration

### 1. Wrangler Configuration (wrangler.toml)

```toml
name = "mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
NODE_ENV = "production"

[[kv_namespaces]]
binding = "OAUTH_KV"
id = "your_kv_namespace_id"

[build]
command = "npm run build"
```

### 2. Cloudflare KV Setup

**Create OAuth session storage**:
```bash
wrangler kv:namespace create "oauth_kv"
```

**KV usage pattern**:
```typescript
// Store OAuth session
await env.OAUTH_KV.put(sessionId, JSON.stringify(sessionData), {
  expirationTtl: 3600 // 1 hour
});

// Retrieve OAuth session
const sessionData = await env.OAUTH_KV.get(sessionId, 'json');
```

### 3. Environment Secret Management

**Local development**:
```bash
# .dev.vars file for local development
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
DATABASE_URL=your_database_url
ENCRYPTION_KEY=your_encryption_key
```

**Production deployment**:
```bash
# Set production secrets via Wrangler CLI
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put DATABASE_URL
wrangler secret put ENCRYPTION_KEY
wrangler secret put SENTRY_DSN  # if using Sentry
```

## MCP Client Configuration

### Claude Desktop Integration

**Configuration file location**: `~/.claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "database-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker.your-subdomain.workers.dev/mcp"
      ]
    }
  }
}
```

### Development vs Production URLs

**Local development**:
```bash
# Start local development server
wrangler dev --config wrangler.dev.toml
# Server runs on http://localhost:8788
```

**Production**:
```bash
# Deploy to Cloudflare
wrangler deploy
# Server runs on https://your-worker.your-subdomain.workers.dev
```

## Security Best Practices Checklist

### 1. Authentication & Authorization
- ✅ Implement OAuth flow for user authentication
- ✅ Role-based access control for sensitive tools
- ✅ Session management with secure token storage
- ✅ User allowlist for protected operations

### 2. Input Validation & Sanitization
- ✅ SQL injection prevention with pattern matching
- ✅ Input length limits and character filtering
- ✅ Query type validation (SELECT vs INSERT/UPDATE)
- ✅ Parameter type checking and validation

### 3. Resource Management
- ✅ Database connection lifecycle management
- ✅ Graceful server shutdown with cleanup
- ✅ Connection pooling for database efficiency
- ✅ Memory leak prevention

### 4. Error Handling
- ✅ Graceful error responses to AI agents
- ✅ Detailed logging without exposing sensitive data
- ✅ Production monitoring and alerting
- ✅ Fallback mechanisms for tool failures

### 5. Production Deployment
- ✅ Environment-specific configuration
- ✅ Secret management for sensitive data
- ✅ HTTPS enforcement for all endpoints
- ✅ Rate limiting and abuse prevention
- ✅ Monitoring and observability

## Development Workflow

### 1. Local Development Setup

```bash
# Clone template repository
git clone <repository-url>
cd mcp-server-template

# Install dependencies
npm install

# Setup environment variables
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your values

# Start development server
wrangler dev --config wrangler.dev.toml
```

### 2. Testing with MCP Clients

**Configure Claude Desktop**:
1. Edit `~/.claude/claude_desktop_config.json`
2. Add local development server URL
3. Restart Claude Desktop
4. Test tool functionality

### 3. Production Deployment

```bash
# Create KV namespace for OAuth
wrangler kv:namespace create "oauth_kv"

# Update wrangler.toml with KV namespace ID
# Set production environment variables
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put DATABASE_URL
wrangler secret put ENCRYPTION_KEY

# Deploy to Cloudflare
wrangler deploy

# Update MCP client configuration with production URL
```

## Performance Considerations

### 1. Database Optimization
- Use connection pooling for multiple concurrent requests
- Implement query result caching where appropriate
- Optimize SQL queries for better performance
- Consider read replicas for read-heavy workloads

### 2. Cloudflare Workers Optimization
- Minimize cold start times with efficient initialization
- Use Cloudflare KV for session storage
- Implement proper error boundaries to prevent worker crashes
- Monitor worker execution time and memory usage

### 3. Network Optimization
- Implement response compression where beneficial
- Use appropriate HTTP headers for caching
- Minimize payload sizes for tool responses
- Consider implementing request batching for multiple operations

## Extension Points

### 1. Additional OAuth Providers
- Google OAuth integration
- Microsoft Azure AD
- Custom OAuth implementations

### 2. Database Support
- MySQL/MariaDB support
- MongoDB integration
- Redis for caching layer

### 3. Advanced Security Features
- API rate limiting per user
- IP-based access control
- Audit logging for all operations
- Data encryption at rest

### 4. Monitoring Enhancements
- Custom metrics and dashboards
- Performance profiling
- User behavior analytics
- Cost monitoring and optimization